import type { DurableObjectState } from "@cloudflare/workers-types";
import { MAX_PARALLEL_GENERATIONS } from "@lexiro/ai-contract";
import type { Env } from "./env";
import { reserve, BillingError, type Reservation } from "./billing";
import { GENERATION_TIMEOUT_MS } from "./generation-timing";
import type { PreparedGeneration } from "./generation";
import { sanitizeResponseStream, type StreamTerminal } from "./response-stream";
import { settleGeneration, outputText } from "./settlement";
import { createUsageRecovery } from "./usage-recovery";
import { upstreamDiagnostic, UpstreamError } from "./upstream-error";
import { ProviderWebSocket, recoverProviderStream, TransportError, providerFrame, type ProviderSender } from "./provider-websocket";
import { fingerprint, HttpError } from "./http";

export { GENERATION_TIMEOUT_MS };
export const RESULT_TTL_MS = 1_800_000;
interface Job {
  id: string; signature: string; startedAt: number; expiresAt: number;
  uid: string; admin: boolean; prepared: PreparedGeneration; reservation: Reservation;
  text: string; responseId?: string; terminal?: string;
}
export type RoomState = Pick<DurableObjectState, "storage" | "waitUntil">;
const encoder = new TextEncoder();

/** Authenticated session actor: a browser subscription never owns the provider request. */
export class GenerationRoom {
  private jobs = new Map<string, Job>();
  private creating = new Map<string, Promise<Job>>();
  private running = new Set<string>();
  private listeners = new Map<string, Set<ReadableStreamDefaultController<Uint8Array>>>();
  private socket: ProviderWebSocket;
  private sender: ProviderSender;
  constructor(private ctx: RoomState, private env: Env, sender?: ProviderSender, private fetcher: typeof fetch = fetch) {
    this.socket = new ProviderWebSocket(env, fetcher);
    this.sender = sender ?? this.socket.send;
  }
  async fetch(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url), id = url.pathname.slice(1);
      let job = this.jobs.get(id) ?? await this.ctx.storage.get<Job>(id);
      const stored = !!job && !this.jobs.has(id);
      if (request.method === "POST") {
        const input = await request.json() as { uid: string; admin: boolean; prepared: PreparedGeneration };
        const signature = await fingerprint(JSON.stringify(input.prepared.request));
        if (job && job.signature !== signature) throw new HttpError(409, "generation_conflict");
        if (!job) {
          if (!this.creating.has(id) && this.running.size + this.creating.size >= MAX_PARALLEL_GENERATIONS) throw new HttpError(409, "generation_in_progress");
          let creating = this.creating.get(id);
          if (!creating) {
            creating = this.create(id, signature, input);
            this.creating.set(id, creating);
          }
          try { job = await creating; } finally { this.creating.delete(id); }
          if (job.signature !== signature) throw new HttpError(409, "generation_conflict");
        }
      }
      if (!job || job.expiresAt <= Date.now()) throw new HttpError(404, "generation_expired");
      this.jobs.set(id, job);
      if (!job.terminal && !this.running.has(id)) this.start(job, stored);
      return this.subscribe(job);
    } catch (reason) {
      const error = reason instanceof HttpError ? reason : reason instanceof BillingError ? new HttpError(reason.status, reason.message) : new HttpError(500, "generation_failed");
      return Response.json({ error: { code: error.code } }, { status: error.status });
    }
  }
  private async create(id: string, signature: string, input: { uid: string; admin: boolean; prepared: PreparedGeneration }): Promise<Job> {
    const reservation = input.admin ? { uid: input.uid, attempt: crypto.randomUUID(), charges: [] } : await reserve(this.env.DB, input.uid, input.prepared.units, input.prepared.halfRate, input.prepared.request.session);
    const job: Job = { ...input, id, signature, startedAt: Date.now(), expiresAt: Date.now() + RESULT_TTL_MS, reservation, text: "" };
    this.jobs.set(id, job);
    await this.save(job);
    await this.ctx.storage.setAlarm(job.expiresAt);
    return job;
  }
  private async save(job: Job) {
    // Images and private instructions are only held in memory while the request runs.
    await this.ctx.storage.put(job.id, { ...job, prepared: { request: job.prepared.request, units: job.prepared.units } });
  }
  private subscribe(job: Job) {
    let controller: ReadableStreamDefaultController<Uint8Array>;
    const listeners = this.listeners.get(job.id) ?? new Set<ReadableStreamDefaultController<Uint8Array>>();
    this.listeners.set(job.id, listeners);
    const body = new ReadableStream<Uint8Array>({
      start: (value) => {
        controller = value;
        value.enqueue(providerFrame({ type: "lexiro.job", jobId: job.id, startedAt: job.startedAt, transport: "websocket" }));
        if (job.responseId) value.enqueue(providerFrame({ type: "response.created", response: { id: job.responseId, model: job.prepared.request.model } }));
        if (job.text) value.enqueue(providerFrame({ type: "response.output_text.delta", delta: job.text }));
        if (job.terminal) { value.enqueue(encoder.encode(job.terminal)); value.close(); }
        else listeners.add(value);
      },
      cancel: () => { listeners.delete(controller); },
    });
    const heartbeat = setInterval(() => {
      if (job.terminal || !listeners.has(controller)) { clearInterval(heartbeat); return; }
      controller.enqueue(encoder.encode(": heartbeat\n\n"));
    }, 15_000);
    return new Response(body, { headers: { "Content-Type": "text/event-stream", "X-Generation-Id": job.id } });
  }
  private publish(job: Job, chunk: Uint8Array) {
    for (const listener of this.listeners.get(job.id) ?? []) listener.enqueue(chunk);
  }
  private start(job: Job, restore: boolean) {
    this.running.add(job.id);
    this.ctx.waitUntil(this.run(job, restore).finally(() => {
      this.running.delete(job.id);
      for (const listener of this.listeners.get(job.id) ?? []) listener.close();
      this.listeners.delete(job.id);
    }));
  }
  private async restoredStream(job: Job, signal: AbortSignal) {
    if (!job.responseId) throw new TransportError("worker_restarted_before_identity", "Worker restarted before the provider returned a response identity");
    for (;;) {
      signal.throwIfAborted();
      const fetcher = this.fetcher;
      const response = await fetcher(`${this.env.OPENAI_BASE_URL}/responses/${encodeURIComponent(job.responseId)}`, { headers: { Authorization: `Bearer ${this.env.OPENAI_API_KEY}` }, signal });
      if (!response.ok) throw new TransportError("stored_response_unavailable", "The provider could not retrieve the original response", { status: response.status });
      const result = await response.json() as Record<string, unknown>;
      if (result.id !== job.responseId) throw new TransportError("recovery_identity_changed", "Provider returned a different response identity");
      if (["queued", "in_progress"].includes(String(result.status))) { await new Promise((resolve) => setTimeout(resolve, 2000)); continue; }
      const text = outputText(result);
      if (!text.startsWith(job.text)) throw new TransportError("recovery_text_changed", "Stored response did not match the received text");
      const suffix = text.slice(job.text.length);
      return new ReadableStream<Uint8Array>({ start(controller) {
        controller.enqueue(providerFrame({ type: "response.created", response: { id: result.id, model: result.model } }));
        if (suffix) controller.enqueue(providerFrame({ type: "response.output_text.delta", delta: suffix }));
        controller.enqueue(providerFrame({ type: result.status === "completed" ? "response.completed" : result.status === "incomplete" ? "response.incomplete" : "response.failed", response: result }));
        controller.close();
      } });
    }
  }
  private async run(job: Job, restore: boolean) {
    const model = job.prepared.request.model;
    const signal = AbortSignal.timeout(Math.max(1, job.startedAt + GENERATION_TIMEOUT_MS - Date.now()));
    let settled = false, lastSave = 0;
    const diagnostic = (reason: unknown) => upstreamDiagnostic(reason instanceof UpstreamError ? { error: reason.diagnostic.provider } : reason && typeof reason === "object" && !(reason instanceof Error) ? { error: { ...reason, ...(signal.aborted ? { code: "generation_timeout" } : {}) } } : { error: { message: reason instanceof Error ? reason.message : String(reason), code: signal.aborted ? "generation_timeout" : reason instanceof TransportError ? reason.code : "generation_failed" } }, {
      phase: "generate", transport: "websocket", jobId: job.id, responseId: job.responseId, model,
      elapsedMs: Date.now() - job.startedAt, timeoutMs: GENERATION_TIMEOUT_MS,
      ...(reason instanceof TransportError ? reason.details : reason instanceof UpstreamError ? reason.diagnostic : {}),
      ...(reason && typeof reason === "object" && "details" in reason && typeof reason.details === "object" ? reason.details : {}),
    }, this.env.OPENAI_API_KEY);
    const finish = async (terminal: StreamTerminal) => {
      const credits = await settleGeneration(this.env.DB, job.reservation, job.prepared, terminal, model, createUsageRecovery(this.env, this.fetcher));
      settled = true;
      return job.admin ? { ...(credits !== undefined ? { credits } : {}), ...(terminal.status !== "complete" ? { diagnostic: diagnostic(terminal.response?.error ?? new Error("Provider response did not complete")) } : {}) } : undefined;
    };
    try {
      const upstream = restore ? await this.restoredStream(job, signal) : recoverProviderStream(await this.sender(job.prepared, undefined, signal, job.id), this.env, signal, this.fetcher);
      const stream = sanitizeResponseStream(upstream, { model, onTerminal: finish });
      const reader = stream.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read(); if (done) break;
          const frame = new TextDecoder().decode(value);
          const data = frame.split("\n").find((line) => line.startsWith("data:"));
          if (data) {
            const event = JSON.parse(data.slice(5));
            if (event.type === "response.created") {
              if (restore && job.responseId === event.response.id) continue;
              job.responseId = event.response.id;
            }
            if (event.type === "response.output_text.delta") job.text += event.delta;
            if (["response.completed", "response.incomplete", "response.failed", "error"].includes(event.type)) job.terminal = frame;
          }
          if (job.terminal || Date.now() - lastSave >= 1000 || frame.includes("response.created")) { await this.save(job); lastSave = Date.now(); }
          this.publish(job, value);
        }
      } finally { reader.releaseLock(); }
      if (!job.terminal) throw new TransportError("missing_terminal_event", "No provider completion event was received");
    } catch (reason) {
      const detail = diagnostic(reason);
      if (!settled) await finish({ cursor: job.responseId, status: "failed", response: { error: { message: "Generation interrupted" } } });
      job.terminal = new TextDecoder().decode(providerFrame({ type: "error", error: { code: "upstream_unavailable", message: "Generation interrupted", ...(job.admin ? { diagnostic: detail } : {}) } }));
      await this.save(job);
      this.publish(job, encoder.encode(job.terminal));
    }
  }
  async alarm() {
    if (!this.running.size) this.socket.close();
    const stored = await this.ctx.storage.list<Job>();
    let next = Infinity;
    for (const [id, job] of stored) {
      if (job.expiresAt <= Date.now()) { await this.ctx.storage.delete(id); this.jobs.delete(id); }
      else next = Math.min(next, job.expiresAt);
    }
    if (Number.isFinite(next)) await this.ctx.storage.setAlarm(next);
  }
}

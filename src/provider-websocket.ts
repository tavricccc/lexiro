import type { Env } from "./env";
import { upstreamBody, type PreparedGeneration } from "./generation";
import { upstreamFailure } from "./upstream-error";

export class TransportError extends Error {
  constructor(public code: string, message: string, public details: Record<string, unknown> = {}) { super(message); }
}
export type ProviderSender = (prepared: PreparedGeneration, cursor: string | undefined, signal: AbortSignal, streamId: string) => Promise<ReadableStream<Uint8Array>>;
const encoder = new TextEncoder();
const terminalEvents = new Set(["response.completed", "response.incomplete", "response.failed", "error"]);
export const providerFrame = (event: Record<string, unknown>) => encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);

/** One socket and reusable independent lanes; no conversation history is shared. */
export class ProviderWebSocket {
  private socket?: WebSocket;
  private connecting?: Promise<WebSocket>;
  private lanes = new Map<string, { event(value: Record<string, unknown>): void; fail(reason: Error): void }>();
  private idleStreamIds: string[] = [];
  private retiringStreamIds = new Set<string>();
  private idle?: ReturnType<typeof setTimeout>;
  constructor(private env: Env, private fetcher: typeof fetch = fetch) {}
  close() {
    clearTimeout(this.idle);
    const socket = this.socket;
    this.socket = undefined;
    this.idleStreamIds = [];
    this.retiringStreamIds.clear();
    socket?.close(1000, "Session idle");
  }
  private async connect(prepared: PreparedGeneration, signal: AbortSignal) {
    const fetcher = this.fetcher;
    const response = await fetcher(`${this.env.OPENAI_BASE_URL}/responses`, { headers: { Upgrade: "websocket", Authorization: `Bearer ${this.env.OPENAI_API_KEY}` }, signal });
    const upgraded = response as Response & { webSocket?: WebSocket };
    if (response.status !== 101 || !upgraded.webSocket)
      throw await upstreamFailure(response, { phase: "connect", transport: "websocket", model: prepared.request.model }, this.env.OPENAI_API_KEY);
    const socket = upgraded.webSocket;
    (socket as WebSocket & { accept(): void }).accept();
    this.socket = socket;
    socket.addEventListener("message", (event: MessageEvent) => {
      if (this.socket !== socket) return;
      try {
        const item = JSON.parse(String(event.data)) as Record<string, unknown>;
        if (typeof item.stream_id !== "string") throw new TransportError("missing_stream_identity", "Provider event did not identify its multiplexed stream");
        const lane = this.lanes.get(item.stream_id);
        if (lane) lane.event(item);
        else if (terminalEvents.has(String(item.type)) && this.retiringStreamIds.delete(item.stream_id))
          this.idleStreamIds.push(item.stream_id);
      } catch (reason) { this.failAll(reason instanceof Error ? reason : new Error(String(reason))); }
    });
    socket.addEventListener("close", (event: CloseEvent) => {
      if (this.socket === socket) this.failAll(new TransportError("upstream_socket_closed", "Provider WebSocket closed before completion", { closeCode: event.code, closeReason: event.reason }));
    });
    socket.addEventListener("error", () => {
      if (this.socket === socket) this.failAll(new TransportError("upstream_socket_error", "Provider WebSocket connection failed"));
    });
    return socket;
  }
  private failAll(reason: Error) {
    for (const lane of this.lanes.values()) lane.fail(reason);
    this.close();
  }
  send: ProviderSender = async (prepared, cursor, signal, streamId) => {
    clearTimeout(this.idle);
    signal.throwIfAborted();
    if (!this.socket || this.socket.readyState !== 1) {
      this.connecting ??= this.connect(prepared, signal).finally(() => { this.connecting = undefined; });
      await this.connecting;
    }
    const socket = this.socket!;
    // Provider stream names belong to a connection, while operation IDs belong
    // to retained jobs. Reuse a finished lane instead of consuming one new name
    // per batch and eventually reaching the provider's 32-name limit.
    const laneId = this.idleStreamIds.pop() ?? streamId;
    let value: string;
    try {
      const body = upstreamBody(prepared, cursor, true, laneId);
      value = typeof body === "string" ? body : await new Response(body).text();
      signal.throwIfAborted();
    } catch (reason) {
      this.idleStreamIds.push(laneId);
      throw reason;
    }
    const stream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        let ended = false;
        const cleanup = (reusable = false) => {
          ended = true;
          this.lanes.delete(laneId);
          if (reusable) this.idleStreamIds.push(laneId);
          else this.retiringStreamIds.add(laneId);
          signal.removeEventListener("abort", abort);
          if (!this.lanes.size) this.idle = setTimeout(() => this.close(), 60_000);
        };
        const fail = (reason: Error) => { if (ended) return; cleanup(); controller.error(reason); };
        const message = (item: Record<string, unknown>) => {
          try {
            controller.enqueue(providerFrame(item));
            if (terminalEvents.has(String(item.type))) {
              cleanup(true); controller.close();
            }
          } catch (reason) { fail(reason instanceof Error ? reason : new Error(String(reason))); }
        };
        const abort = () => fail(signal.reason instanceof Error ? signal.reason : new TransportError("generation_cancelled", "Generation cancelled"));
        this.lanes.set(laneId, { event: message, fail });
        signal.addEventListener("abort", abort, { once: true });
        try { socket.send(value); }
        catch (reason) { fail(reason instanceof Error ? reason : new Error(String(reason))); }
      },
    });
    return stream;
  };
}

/** Recover the same stored response after an upstream disconnect; never create another response. */
export function recoverProviderStream(stream: ReadableStream<Uint8Array>, env: Env, signal: AbortSignal, fetcher: typeof fetch = fetch) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "", id: string | undefined, text = "";
  const scan = (chunk: Uint8Array) => {
    buffer += decoder.decode(chunk, { stream: true });
    let at: number;
    while ((at = buffer.indexOf("\n\n")) >= 0) {
      const frame = buffer.slice(0, at); buffer = buffer.slice(at + 2);
      const data = frame.split("\n").find((line) => line.startsWith("data:"));
      if (!data) continue;
      const event = JSON.parse(data.slice(5));
      if (event.type === "response.created") id = event.response.id;
      if (event.type === "response.output_text.delta") text += event.delta;
    }
  };
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        try {
          for (;;) { const { done, value } = await reader.read(); if (done) break; scan(value); controller.enqueue(value); }
        } catch (reason) {
          if (!id || signal.aborted) throw reason;
          controller.enqueue(providerFrame({ type: "lexiro.recovering", responseId: id }));
          for (;;) {
            signal.throwIfAborted();
            const response = await fetcher(`${env.OPENAI_BASE_URL}/responses/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` }, signal });
            if (!response.ok) { await response.body?.cancel(); throw reason; }
            const result = await response.json() as Record<string, unknown>;
            if (result.id !== id) throw new TransportError("recovery_identity_changed", "Provider returned a different response identity");
            if (result.status === "queued" || result.status === "in_progress") { await new Promise((resolve) => setTimeout(resolve, 2000)); continue; }
            const { outputText } = await import("./settlement");
            const full = outputText(result);
            if (!full.startsWith(text)) throw new TransportError("recovery_text_changed", "Stored response did not match the received text");
            if (full.length > text.length) controller.enqueue(providerFrame({ type: "response.output_text.delta", delta: full.slice(text.length) }));
            controller.enqueue(providerFrame({ type: result.status === "completed" ? "response.completed" : result.status === "incomplete" ? "response.incomplete" : "response.failed", response: result }));
            break;
          }
        }
        controller.close();
      } catch (reason) { controller.error(reason); }
      finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
    },
  });
}

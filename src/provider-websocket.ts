import type { Env } from "./env";
import { upstreamBody, type PreparedGeneration } from "./generation";
import { upstreamFailure } from "./upstream-error";

export class TransportError extends Error {
  constructor(public code: string, message: string, public details: Record<string, unknown> = {}) { super(message); }
}
export type ProviderSender = (prepared: PreparedGeneration, cursor: string | undefined, signal: AbortSignal) => Promise<ReadableStream<Uint8Array>>;
const encoder = new TextEncoder();
export const providerFrame = (event: Record<string, unknown>) => encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);

/** One socket per authenticated session; each turn completes before the next starts. */
export class ProviderWebSocket {
  private socket?: WebSocket;
  private idle?: ReturnType<typeof setTimeout>;
  constructor(private env: Env, private fetcher: typeof fetch = fetch) {}
  close() { clearTimeout(this.idle); this.socket?.close(1000, "Session idle"); this.socket = undefined; }
  send: ProviderSender = async (prepared, cursor, signal) => {
    clearTimeout(this.idle);
    signal.throwIfAborted();
    if (!this.socket || this.socket.readyState !== 1) {
      const fetcher = this.fetcher;
      const response = await fetcher(`${this.env.OPENAI_BASE_URL}/responses`, {
        headers: { Upgrade: "websocket", Authorization: `Bearer ${this.env.OPENAI_API_KEY}` }, signal,
      });
      const upgraded = response as Response & { webSocket?: WebSocket };
      if (response.status !== 101 || !upgraded.webSocket)
        throw await upstreamFailure(response, { phase: "connect", transport: "websocket", model: prepared.request.model }, this.env.OPENAI_API_KEY);
      this.socket = upgraded.webSocket;
      (this.socket as WebSocket & { accept(): void }).accept();
    }
    const socket = this.socket;
    const body = upstreamBody(prepared, cursor, true);
    const value = typeof body === "string" ? body : await new Response(body).text();
    const stream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        let ended = false;
        const cleanup = () => {
          ended = true;
          socket.removeEventListener("message", message);
          socket.removeEventListener("close", close);
          socket.removeEventListener("error", error);
          signal.removeEventListener("abort", abort);
        };
        const fail = (reason: Error) => { if (ended) return; cleanup(); controller.error(reason); this.close(); };
        const message = (event: MessageEvent) => {
          try {
            const item = JSON.parse(String(event.data));
            controller.enqueue(providerFrame(item));
            if (["response.completed", "response.incomplete", "response.failed", "error"].includes(item.type)) {
              cleanup(); controller.close();
              this.idle = setTimeout(() => this.close(), 15_000);
            }
          } catch (reason) { fail(reason instanceof Error ? reason : new Error(String(reason))); }
        };
        const close = (event: CloseEvent) => fail(new TransportError("upstream_socket_closed", "Provider WebSocket closed before completion", { closeCode: event.code, closeReason: event.reason }));
        const error = () => fail(new TransportError("upstream_socket_error", "Provider WebSocket connection failed"));
        const abort = () => fail(signal.reason instanceof Error ? signal.reason : new TransportError("generation_cancelled", "Generation cancelled"));
        socket.addEventListener("message", message);
        socket.addEventListener("close", close);
        socket.addEventListener("error", error);
        signal.addEventListener("abort", abort, { once: true });
        socket.send(value);
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

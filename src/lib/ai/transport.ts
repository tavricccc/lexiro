import type { AiProtocol, AiTurnOptions, AiTurnResult } from "@/src/types/ai";
import { t } from "@/lib/i18n";
import { isRecord } from "../schema";
import { AiRequestError } from "./errors";
import { consumeEvent, emptyReply, readReply } from "./reply";

export const AI_IDLE_TIMEOUT_MS = 120_000;
export const AI_TURN_TIMEOUT_MS = 600_000;
function detail(body: string) {
  try {
    const data: unknown = JSON.parse(body);
    if (!isRecord(data)) return { message: "" };
    const error = isRecord(data.error) ? data.error : data;
    return {
      message: typeof error.message === "string" ? error.message : "",
      code: typeof error.code === "string" ? error.code : undefined,
    };
  } catch {
    return {
      message: body
        .replace(/<[^>]*>/gu, " ")
        .replace(/\s+/gu, " ")
        .slice(0, 200),
    };
  }
}
function retryAfter(response: Response) {
  const header = response.headers.get("retry-after");
  if (!header) return undefined;
  const seconds = Number(header);
  return Number.isFinite(seconds)
    ? Math.max(0, seconds * 1000)
    : Math.max(0, Date.parse(header) - Date.now()) || undefined;
}
export async function readSse(
  body: ReadableStream<Uint8Array>,
  consume: (data: string) => void,
) {
  const reader = body.getReader(),
    decoder = new TextDecoder();
  let buffer = "",
    lines: string[] = [];
  const flush = () => {
    if (lines.length) consume(lines.join("\n"));
    lines = [];
  };
  const line = (value: string) => {
    if (!value) flush();
    else if (value.startsWith("data:"))
      lines.push(value.slice(5).replace(/^ /u, ""));
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let at: number;
      while ((at = buffer.indexOf("\n")) >= 0) {
        line(buffer.slice(0, at).replace(/\r$/u, ""));
        buffer = buffer.slice(at + 1);
      }
      if (done) {
        if (buffer) line(buffer.replace(/\r$/u, ""));
        flush();
        break;
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
export async function sendRequest(
  request: {
    url: string;
    headers: Record<string, string>;
    body: Record<string, unknown>;
  },
  protocol: AiProtocol,
  options: AiTurnOptions,
): Promise<AiTurnResult> {
  options.signal?.throwIfAborted();
  const controller = new AbortController();
  const abort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", abort, { once: true });
  let timedOut = false,
    idle: ReturnType<typeof setTimeout>;
  const expire = () => {
    timedOut = true;
    controller.abort();
  };
  const bump = () => {
    clearTimeout(idle);
    idle = setTimeout(expire, AI_IDLE_TIMEOUT_MS);
  };
  const total = setTimeout(expire, AI_TURN_TIMEOUT_MS);
  bump();
  const reply = emptyReply();
  try {
    options.onPhase?.("connecting");
    const response = await fetch(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify(request.body),
      signal: controller.signal,
    });
    reply.requestId =
      response.headers.get("x-request-id") ??
      response.headers.get("request-id") ??
      undefined;
    if (!response.ok) {
      const error = detail(await response.text());
      throw new AiRequestError(
        t("ai.httpError", { status: response.status, detail: error.message }),
        {
          status: response.status,
          code: error.code,
          retryAfterMs: retryAfter(response),
          retryable:
            response.status === 429 ||
            response.status === 408 ||
            response.status >= 500,
        },
      );
    }
    if (
      response.body &&
      response.headers.get("content-type")?.includes("text/event-stream")
    ) {
      await readSse(response.body, (frame) => {
        if (frame === "[DONE]") return;
        const data: unknown = JSON.parse(frame);
        if (!isRecord(data))
          throw new AiRequestError(t("ai.invalidReply"), { retryable: false });
        const event = String(data.type ?? data.event_type ?? "");
        if (data.error || /(?:failed|error)$/u.test(event)) {
          const error = detail(JSON.stringify(data.error ?? data));
          throw new AiRequestError(error.message || t("ai.streamFailed"), {
            retryable: true,
            code: error.code,
          });
        }
        bump();
        consumeEvent(protocol, data, reply);
        options.onPhase?.(reply.text ? "generating" : "thinking");
        options.onCharacters?.(reply.text.length);
      });
    } else {
      const data: unknown = JSON.parse(await response.text());
      if (!isRecord(data))
        throw new AiRequestError(t("ai.invalidReply"), { retryable: false });
      Object.assign(reply, readReply(protocol, data));
      options.onCharacters?.(reply.text.length);
    }
    options.onUsage?.(reply.usage);
    if (!reply.complete)
      throw new AiRequestError(t("ai.streamFailed"), {
        retryable: true,
        streamBroken: true,
      });
    if (reply.stopReason === "truncated")
      throw new AiRequestError(t("ai.truncated"), {
        retryable: false,
        code: "truncated",
      });
    if (reply.stopReason === "blocked")
      throw new AiRequestError(t("ai.blocked"), {
        retryable: false,
        code: "blocked",
      });
    if (!reply.text.trim())
      throw new AiRequestError(t("ai.emptyReply"), { retryable: false });
    return reply;
  } catch (reason) {
    if (options.signal?.aborted) throw options.signal.reason;
    if (timedOut)
      throw new AiRequestError(t("ai.timeout"), { retryable: true });
    if (reason instanceof AiRequestError) throw reason;
    throw new AiRequestError(
      reason instanceof SyntaxError
        ? t("ai.invalidReply")
        : t("ai.networkError"),
      { retryable: !(reason instanceof SyntaxError) },
    );
  } finally {
    clearTimeout(idle!);
    clearTimeout(total);
    options.signal?.removeEventListener("abort", abort);
    controller.abort();
  }
}

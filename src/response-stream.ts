export interface StreamTerminal {
  cursor?: string;
  status: "complete" | "truncated" | "failed" | "cancelled";
  /** Original server-side response for settlement, before public redaction. */
  response?: Record<string, unknown>;
}
export interface StreamOptions {
  model: string;
  onTerminal: (
    result: StreamTerminal,
  ) => Promise<Record<string, unknown> | undefined>;
}

const encoder = new TextEncoder();
const MAX_EVENT_CHARACTERS = 1_048_576;
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const encodeEvent = (event: string, value: Record<string, unknown>) =>
  encoder.encode(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`);
const failure = (metadata?: Record<string, unknown>) =>
  encodeEvent("error", { type: "error", code: "upstream_unavailable", ...(metadata?.diagnostic ? { diagnostic: metadata.diagnostic } : {}) });
const TEXT_EVENTS = new Set([
  "response.output_text.delta",
  "response.output_text.done",
]);
const RESPONSE_EVENTS = new Set([
  "response.created",
  "response.in_progress",
  "response.completed",
  "response.incomplete",
  "response.failed",
]);

interface Frame {
  event: string;
  data: string;
  raw: string;
}

/** Keep UTF-8/text frames intact; parse JSON only for Response metadata events. */
async function* frames(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<Frame> {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let pieces: string[] = [],
    lines: string[] = [],
    data: string[] = [];
  let event = "",
    size = 0;
  const line = (raw: string): Frame | undefined => {
    lines.push(raw);
    const text = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    if (text === "") {
      const result = data.length
        ? { event, data: data.join("\n"), raw: `${lines.join("\n")}\n` }
        : undefined;
      lines = [];
      data = [];
      event = "";
      size = 0;
      return result;
    }
    if (text.startsWith("data:")) {
      const value = text.slice(5);
      data.push(value.startsWith(" ") ? value.slice(1) : value);
    } else if (text.startsWith("event:")) event = text.slice(6).trim();
  };
  for (;;) {
    const { value, done } = await reader.read();
    const text = decoder.decode(value, { stream: !done });
    let offset = 0,
      end: number;
    while ((end = text.indexOf("\n", offset)) !== -1) {
      const part = text.slice(offset, end);
      size += part.length;
      if (size > MAX_EVENT_CHARACTERS) throw new Error("Event exceeds limit");
      pieces.push(part);
      const result = line(pieces.join(""));
      pieces = [];
      if (result) yield result;
      offset = end + 1;
    }
    if (offset < text.length) {
      const part = text.slice(offset);
      size += part.length;
      if (size > MAX_EVENT_CHARACTERS) throw new Error("Event exceeds limit");
      pieces.push(part);
    }
    if (done) {
      if (pieces.length || data.length) throw new Error("Truncated SSE frame");
      return;
    }
  }
}

const USAGE_FIELDS = ["input_tokens", "output_tokens", "total_tokens"] as const;

/**
 * Rebuilds the public `response` object out of the few fields the client reads.
 *
 * An allowlist rather than a denylist: the provider may add a field that echoes
 * the prompt at any time, and a forwarder that only knows the names it must
 * remove would pass that straight through to the browser.
 */
function publicResponse(
  response: Record<string, unknown>,
  model: string,
): Record<string, unknown> {
  const clean: Record<string, unknown> = { id: response.id, model };
  if (typeof response.status === "string") clean.status = response.status;
  if (record(response.usage)) {
    const usage: Record<string, unknown> = {};
    for (const field of USAGE_FIELDS)
      if (typeof response.usage[field] === "number")
        usage[field] = response.usage[field];
    const input = response.usage.input_tokens_details;
    if (record(input)) {
      const details: Record<string, number> = {};
      if (typeof input.cached_tokens === "number")
        details.cached_tokens = input.cached_tokens;
      if (typeof input.cache_write_tokens === "number")
        details.cache_write_tokens = input.cache_write_tokens;
      if (Object.keys(details).length) usage.input_tokens_details = details;
    }
    const output = response.usage.output_tokens_details;
    if (record(output) && typeof output.reasoning_tokens === "number")
      usage.output_tokens_details = {
        reasoning_tokens: output.reasoning_tokens,
      };
    clean.usage = usage;
  }
  // Only the reason survives: the provider's explanation can quote the prompt.
  if (
    record(response.incomplete_details) &&
    typeof response.incomplete_details.reason === "string"
  )
    clean.incomplete_details = { reason: response.incomplete_details.reason };
  if (response.error !== null && response.error !== undefined)
    clean.error = {
      code: "upstream_unavailable",
      message: "Generation failed.",
    };
  return clean;
}

/**
 * Keep the Responses wire protocol and generated text, but rebuild every
 * metadata event from an allowlist so no prompt echo can ride along.
 */
export function sanitizeResponseStream(
  upstream: ReadableStream<Uint8Array>,
  options: StreamOptions,
): ReadableStream<Uint8Array> {
  const reader = upstream.getReader();
  let cursor: string | undefined,
    cancelled = false,
    notified = false,
    terminalMetadata: Record<string, unknown> | undefined;
  const finish = async (result: StreamTerminal) => {
    if (notified) return terminalMetadata;
    notified = true;
    terminalMetadata = await options.onTerminal(result);
    return terminalMetadata;
  };
  async function* events(): AsyncGenerator<Uint8Array> {
    try {
      for await (const frame of frames(reader)) {
        if (cancelled) return;
        if (TEXT_EVENTS.has(frame.event)) {
          if (!cursor) throw new Error("Text arrived before response identity");
          yield encoder.encode(frame.raw);
          continue;
        }
        if (frame.event === "error") {
          const event: unknown = JSON.parse(frame.data);
          await finish({ cursor, status: "failed", response: { error: record(event) && event.error ? event.error : event } });
          if (!cancelled) yield failure(terminalMetadata);
          return;
        }
        // Only known events are forwarded; unexpected metadata cannot bypass redaction.
        if (!RESPONSE_EVENTS.has(frame.event)) continue;
        const event: unknown = JSON.parse(frame.data);
        if (
          !record(event) ||
          event.type !== frame.event ||
          !record(event.response)
        )
          throw new Error("Invalid Response event");
        const response = event.response;
        if (
          typeof response.id !== "string" ||
          !/^resp_[A-Za-z0-9_-]{1,200}$/.test(response.id)
        )
          throw new Error("Invalid response identity");
        if (frame.event === "response.created") {
          if (cursor) throw new Error("Duplicate response identity");
          cursor = response.id;
        } else if (cursor !== response.id)
          throw new Error("Response identity changed");

        const terminal = [
          "response.completed",
          "response.incomplete",
          "response.failed",
        ].includes(frame.event);
        let metadata: Record<string, unknown> | undefined;
        if (terminal) {
          const truncated =
            frame.event === "response.incomplete" &&
            record(response.incomplete_details) &&
            response.incomplete_details.reason === "max_output_tokens";
          metadata = await finish({
            cursor,
            status:
              frame.event === "response.completed"
                ? "complete"
                : truncated
                  ? "truncated"
                  : "failed",
            response,
          });
          if (cancelled) return;
        }

        // Never mutate the private response retained by the settlement callback.
        const clean = publicResponse(response, options.model);
        if (metadata) clean.lexiro = metadata;
        // Project envelope fields too: a new top-level echo must not expose a prompt.
        yield encodeEvent(frame.event, {
          type: frame.event,
          ...(typeof event.sequence_number === "number"
            ? { sequence_number: event.sequence_number }
            : {}),
          response: clean,
        });
        if (terminal) return;
      }
      if (!cancelled) throw new Error("Stream ended before terminal event");
    } catch (reason) {
      try {
        await finish({ cursor, status: cancelled ? "cancelled" : "failed", response: { error: { message: reason instanceof Error ? reason.message : String(reason), ...(record(reason) && typeof reason.code === "string" ? { code: reason.code } : {}), ...(record(reason) && record(reason.details) ? { details: reason.details } : {}) } } });
      } catch {
        /* Settlement errors must not become public provider details. */
      }
      if (!cancelled) yield failure(terminalMetadata);
    } finally {
      try {
        await reader.cancel();
      } finally {
        reader.releaseLock();
      }
    }
  }
  const iterator = events();
  return new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        const next = await iterator.next();
        if (cancelled) return;
        if (next.done) controller.close();
        else controller.enqueue(next.value);
      },
      async cancel() {
        cancelled = true;
        try {
          await reader.cancel();
          await iterator.return(undefined);
        } finally {
          reader.releaseLock();
          await finish({ cursor, status: "cancelled" });
        }
      },
    },
    { highWaterMark: 0 },
  );
}

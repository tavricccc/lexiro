import { describe, expect, it, vi } from "vitest";
import { sanitizeResponseStream, type StreamTerminal } from "../src/response-stream";

const encoder = new TextEncoder();
const event = (type: string, value: Record<string, unknown>, newline = "\n") =>
  `event: ${type}${newline}data: ${JSON.stringify({ type, ...value })}${newline}${newline}`;
const response = {
  id: "resp_test_123",
  instructions: "PRIVATE_PROMPT_DO_NOT_EXPOSE",
  input: [{ role: "developer", content: "PRIVATE_INPUT" }],
  prompt: { id: "PRIVATE_TEMPLATE" },
  model: "test-model",
  usage: { input_tokens: 123, output_tokens: 10 },
  output: [{ type: "message", content: [{ type: "output_text", text: "測試結果" }] }],
};
const start = event("response.created", { response });
const end = event("response.completed", { response });
function stream(text: string, chunkSize = 37) {
  const bytes = encoder.encode(text);
  let offset = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.length) controller.close();
      else { controller.enqueue(bytes.slice(offset, offset + chunkSize)); offset += chunkSize; }
    },
  }, { highWaterMark: 0 });
}
async function read(text: string, chunkSize?: number) {
  const outcomes: StreamTerminal[] = [];
  const body = sanitizeResponseStream(stream(text, chunkSize), {
    model: "gpt-6-luna",
    onTerminal: async (result) => {
      outcomes.push(result);
      return undefined;
    },
  });
  return { text: await new Response(body).text(), outcomes };
}
function payloads(text: string): Record<string, unknown>[] {
  return text.split("\n").filter((line) => line.startsWith("data: ")).map((line) => JSON.parse(line.slice(6)));
}

describe("Responses prompt redaction", () => {
  it("rebuilds the public response from an allowlist and keeps the private one whole", async () => {
    const delta = event("response.output_text.delta", { delta: "測試結果" });
    const result = await read(start + delta + event("response.in_progress", { response }) + end);
    expect(result.text).not.toContain("PRIVATE_");
    const publicResponse = payloads(result.text).at(-1)?.response;
    // `output` is deliberately absent: the client reads the deltas, and the
    // generated text is the one thing an echo could hide behind.
    expect(publicResponse).toEqual({ id: response.id, model: "gpt-6-luna", usage: response.usage });
    expect(result.outcomes).toEqual([{ cursor: response.id, status: "complete", response }]);
    expect(result.text).toContain(delta);
  });

  it("drops a field the provider adds later, without being told its name", async () => {
    const leaky = { ...response, developer_prompt: "PRIVATE_SYSTEM_RULES", reasoning: { summary: "PRIVATE_" } };
    const result = await read(start + event("response.completed", { response: leaky }));
    expect(result.text).not.toContain("PRIVATE_");
    expect(payloads(result.text).at(-1)?.response).not.toHaveProperty("developer_prompt");
  });

  it.each([1, 2, 7, 65_536])("preserves escaped text and split Unicode with %i-byte chunks", async (size) => {
    const delta = event("response.output_text.delta", { delta: '繁體字🌲\n"instructions":這是產出的文字' }, "\r\n");
    const result = await read(start + delta + end, size);
    expect(result.text).toContain(delta);
    expect(payloads(result.text)[1]).toEqual({ type: "response.output_text.delta", delta: '繁體字🌲\n"instructions":這是產出的文字' });
    expect(result.outcomes[0].status).toBe("complete");
  });

  it("does not forward new event types or private envelope fields", async () => {
    const first = event("response.created", { response, private_context: "PRIVATE_ENVELOPE", sequence_number: 2 });
    const unknown = event("response.new_metadata", { instructions: "PRIVATE_NEW_EVENT" });
    const result = await read(first + unknown + end);
    expect(result.text).not.toContain("PRIVATE_");
    expect(payloads(result.text)).toHaveLength(2);
    expect(payloads(result.text)[0].sequence_number).toBe(2);
  });

  it.each(["response.failed", "error"])("neutralizes upstream errors in %s", async (type) => {
    const failure = type === "error"
      ? event(type, { message: "PRIVATE_UPSTREAM_ERROR" })
      : event(type, { response: { ...response, error: { code: "secret", message: "PRIVATE_UPSTREAM_ERROR" } } });
    const result = await read(start + failure);
    expect(result.text).not.toContain("PRIVATE_");
    expect(result.text).toContain("upstream_unavailable");
    expect(result.outcomes).toHaveLength(1);
    expect(result.outcomes[0].status).toBe("failed");
  });

  it("keeps truncation available to the frontend split/retry logic", async () => {
    const terminal = { ...response, incomplete_details: { reason: "max_output_tokens" } };
    const result = await read(start + event("response.incomplete", { response: terminal }));
    expect(result.outcomes[0].status).toBe("truncated");
    expect(payloads(result.text).at(-1)).toMatchObject({ response: { incomplete_details: { reason: "max_output_tokens" } } });
  });

  it.each([
    start,
    start + "event: response.completed\ndata: {",
    start + event("response.completed", { response: { ...response, id: "resp_other" } }),
    start + "event: response.completed\ndata: not-json\n\n",
    start + "event: response.completed\ndata: " + "x".repeat(1_048_577),
  ])("returns a neutral failure for an incomplete or invalid upstream", async (input) => {
    const result = await read(input, 4096);
    expect(payloads(result.text).at(-1)).toEqual({ type: "error", code: "upstream_unavailable" });
    expect(result.outcomes).toHaveLength(1);
    expect(result.outcomes[0].status).toBe("failed");
  });

  it("waits for settlement before publishing completion", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const onTerminal = vi.fn(async () => {
      await gate;
      return { credits: 3 };
    });
    const reader = sanitizeResponseStream(stream(start + end, 65_536), { model: "gpt-6-luna", onTerminal }).getReader();
    await reader.read();
    let completed = false;
    const pending = reader.read().then((result) => { completed = true; return result; });
    await vi.waitFor(() => expect(onTerminal).toHaveBeenCalledOnce());
    expect(completed).toBe(false);
    release();
    const result = await pending;
    expect(new TextDecoder().decode(result.value)).toContain("response.completed");
    expect(new TextDecoder().decode(result.value)).toContain(
      '"lexiro":{"credits":3}',
    );
    await reader.read();
  });

  it("honors backpressure and cancels upstream exactly once before any read", async () => {
    const pull = vi.fn(), cancel = vi.fn(), onTerminal = vi.fn(async () => undefined);
    const upstream = new ReadableStream<Uint8Array>({ pull, cancel }, { highWaterMark: 0 });
    const output = sanitizeResponseStream(upstream, { model: "gpt-6-luna", onTerminal });
    await Promise.resolve();
    expect(pull).not.toHaveBeenCalled();
    await output.cancel();
    expect(cancel).toHaveBeenCalledOnce();
    expect(onTerminal).toHaveBeenCalledExactlyOnceWith({ cursor: undefined, status: "cancelled" });
    expect(upstream.locked).toBe(false);
  });

  it("cancels a pending read without treating user cancellation as an upstream failure", async () => {
    const cancel = vi.fn(), onTerminal = vi.fn(async () => undefined);
    const upstream = new ReadableStream<Uint8Array>({ cancel }, { highWaterMark: 0 });
    const reader = sanitizeResponseStream(upstream, { model: "gpt-6-luna", onTerminal }).getReader();
    const pending = reader.read();
    await reader.cancel();
    expect((await pending).done).toBe(true);
    expect(cancel).toHaveBeenCalledOnce();
    expect(onTerminal).toHaveBeenCalledExactlyOnceWith({ cursor: undefined, status: "cancelled" });
    expect(upstream.locked).toBe(false);
  });
});

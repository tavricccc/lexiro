import type { AiSettings } from "@/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AiRequestError,
  generateWithAi,
  defaultAiSettings,
} from "@/src/lib/ai-provider";

const settings = (patch: Partial<AiSettings> = {}): AiSettings => ({
  ...defaultAiSettings,
  protocol: "chat",
  apiKey: "key",
  baseUrl: "",
  batchSize: 20,
  enabled: true,
  model: "gpt-4o-mini",
  provider: "openai",
  ...patch,
});

function reply(
  body: string,
  init: { headers?: Record<string, string>; status?: number } = {},
) {
  const status = init.status ?? 200;
  return {
    headers: {
      get: (name: string) => init.headers?.[name.toLowerCase()] ?? null,
    },
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  } as unknown as Response;
}

const chatReply = (content: string, finishReason = "stop") =>
  reply(
    JSON.stringify({
      choices: [{ finish_reason: finishReason, message: { content } }],
    }),
  );

function sseReply(chunks: string[]) {
  const encoder = new TextEncoder();
  return {
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    }),
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "content-type" ? "text/event-stream" : null,
    },
    ok: true,
    status: 200,
    text: async () => chunks.join(""),
  } as unknown as Response;
}

/** One SSE frame: a `data:` line, then the blank line that ends the event. */
const sseFrame = (data: string) => `data: ${data}

`;

const openAiChunk = (payload: Record<string, unknown>) =>
  sseFrame(JSON.stringify(payload));

function stubFetch(...responses: Response[]) {
  const fetchMock = vi.fn(
    async (_url: string, _init: RequestInit) =>
      responses.shift() ?? chatReply("{}"),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("generateWithAi", () => {
  it("keeps the detail from an error body that is not JSON", async () => {
    stubFetch(reply("<html><body>Bad gateway</body></html>", { status: 502 }));

    await expect(generateWithAi(settings(), "prompt")).rejects.toMatchObject({
      message: expect.stringContaining("Bad gateway"),
      retryable: true,
      status: 502,
    });
  });

  it("passes the provider's Retry-After on to the batch runner", async () => {
    stubFetch(
      reply(JSON.stringify({ error: { message: "slow down" } }), {
        headers: { "retry-after": "2" },
        status: 429,
      }),
    );

    const reason = await generateWithAi(settings(), "prompt").catch(
      (error: unknown) => error,
    );
    expect(reason).toBeInstanceOf(AiRequestError);
    expect(reason).toMatchObject({ retryAfterMs: 2_000, retryable: true });
  });

  it("does not mark a rejected key as worth retrying", async () => {
    stubFetch(
      reply(JSON.stringify({ error: { message: "invalid api key" } }), {
        status: 401,
      }),
    );

    await expect(generateWithAi(settings(), "prompt")).rejects.toMatchObject({
      retryable: false,
    });
  });

  it("reports a reply cut short by the token ceiling instead of half a JSON", async () => {
    stubFetch(chatReply('{"words":[{"word":"ab', "length"));

    await expect(generateWithAi(settings(), "prompt")).rejects.toMatchObject({
      message: expect.stringContaining("截斷"),
      retryable: false,
    });
  });

  it("sends the request again without response_format when the gateway rejects it", async () => {
    const fetchMock = stubFetch(
      reply(
        JSON.stringify({
          error: { message: "unknown parameter: response_format" },
        }),
        { status: 400 },
      ),
      chatReply('{"ok":true}'),
    );

    await expect(
      generateWithAi(
        settings({ provider: "custom", baseUrl: "https://proxy.example/v1" }),
        "prompt",
      ),
    ).resolves.toBe('{"ok":true}');
    const [first, second] = fetchMock.mock.calls.map(
      ([, init]: [string, RequestInit]) =>
        JSON.parse(String(init.body)) as Record<string, unknown>,
    );
    expect(first.response_format).toBeDefined();
    expect(second.response_format).toBeUndefined();
  });

  it("keeps the chosen model in the URL when Google runs through a proxy", async () => {
    const fetchMock = stubFetch(
      reply(
        JSON.stringify({
          candidates: [
            { content: { parts: [{ text: "{}" }] }, finishReason: "STOP" },
          ],
        }),
      ),
    );

    await generateWithAi(
      settings({
        baseUrl: "https://proxy.example/v1beta",
        model: "gemini-2.5-flash",
        provider: "google",
        protocol: "generateContent",
      }),
      "prompt",
    );

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://proxy.example/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse",
    );
  });

  it("times out a server that sends headers and then stalls on the body", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (_url: string, init: RequestInit) =>
          ({
            headers: { get: () => null },
            ok: true,
            status: 200,
            text: () =>
              new Promise<string>((_resolve, reject) => {
                init.signal?.addEventListener("abort", () =>
                  reject(new Error("aborted")),
                );
              }),
          }) as unknown as Response,
      ),
    );

    const pending = generateWithAi(settings(), "prompt").catch(
      (error: unknown) => error,
    );
    await vi.advanceTimersByTimeAsync(200_000);

    expect(await pending).toMatchObject({
      message: expect.stringContaining("等候過久"),
      retryable: true,
    });
  });

  it("assembles a streamed reply and counts the characters as they arrive", async () => {
    const fetchMock = stubFetch(
      sseReply([
        openAiChunk({ choices: [{ delta: { content: '{"a":' } }] }),
        openAiChunk({ choices: [{ delta: { content: "1}" } }] }),
        openAiChunk({ choices: [{ delta: {}, finish_reason: "stop" }] }),
        sseFrame("[DONE]"),
      ]),
    );
    const onCharacters = vi.fn();

    await expect(
      generateWithAi(settings(), "prompt", { onCharacters }),
    ).resolves.toBe('{"a":1}');
    expect(onCharacters.mock.calls.at(-1)).toEqual([7]);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body)).stream).toBe(
      true,
    );
  });

  it("reports a broken stream without silently changing protocol or sending another charged request", async () => {
    const fetchMock = stubFetch(
      sseReply([openAiChunk({ choices: [{ delta: { content: '{"a":' } }] })]),
      chatReply('{"a":1}'),
    );

    await expect(generateWithAi(settings(), "prompt")).rejects.toMatchObject({
      streamBroken: true,
      retryable: true,
    });
    const bodies = fetchMock.mock.calls.map(
      ([, init]: [string, RequestInit]) =>
        JSON.parse(String(init.body)) as Record<string, unknown>,
    );
    expect(bodies[0].stream).toBe(true);
    expect(bodies).toHaveLength(1);
  });

  it("stops waiting when a stream goes quiet, and says the reply stalled", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (_url: string, init: RequestInit) =>
          ({
            body: new ReadableStream<Uint8Array>({
              start(controller) {
                controller.enqueue(
                  new TextEncoder().encode(
                    openAiChunk({ choices: [{ delta: { content: "half" } }] }),
                  ),
                );
                init.signal?.addEventListener("abort", () =>
                  controller.error(new Error("aborted")),
                );
              },
            }),
            headers: {
              get: (name: string) =>
                name.toLowerCase() === "content-type"
                  ? "text/event-stream"
                  : null,
            },
            ok: true,
            status: 200,
          }) as unknown as Response,
      ),
    );

    const pending = generateWithAi(settings(), "prompt", {
      stream: true,
    }).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(121_000);

    expect(await pending).toMatchObject({
      message: expect.stringContaining("等候過久"),
      retryable: true,
    });
  });
});

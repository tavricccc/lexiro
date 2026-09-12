import { afterEach, describe, expect, it, vi } from "vitest";
import {
  defaultAiSettings,
  normalizeShareableAiSettings,
  parseAiSettingsJson,
} from "@/src/lib/ai-provider";
import {
  createAiSession,
  generateTurn,
  commitTurn,
} from "@/src/lib/ai/session";
import { buildRequest } from "@/src/lib/ai/request";
import { consumeEvent, emptyReply } from "@/src/lib/ai/reply";
import { readSse } from "@/src/lib/ai/transport";
import type { AiSettings } from "@/types";

const settings = (patch: Partial<AiSettings> = {}): AiSettings => ({
  ...defaultAiSettings,
  enabled: true,
  apiKey: "test-only",
  ...patch,
});
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
const response = (id: string) => ({
  id,
  status: "completed",
  output: [{ type: "message", content: [{ type: "output_text", text: "{}" }] }],
  usage: {
    input_tokens: 2000,
    output_tokens: 20,
    input_tokens_details: { cached_tokens: 1000, cache_write_tokens: 1000 },
  },
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("native AI protocols", () => {
  it("uses Responses and chains only committed replies while preserving schema and usage", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json(response("r1")))
      .mockResolvedValueOnce(json(response("r2")));
    vi.stubGlobal("fetch", fetch);
    const session = createAiSession(settings(), "stable source context");
    const schema = {
      type: "object",
      properties: {},
      additionalProperties: false,
    };
    const first = await generateTurn(session, "first", { schema });
    expect(session.cursor).toBeUndefined();
    commitTurn(session, "first", first);
    await generateTurn(session, "next", { schema });
    const request = JSON.parse(fetch.mock.calls[1][1].body);
    expect(fetch.mock.calls[0][0]).toBe("https://api.openai.com/v1/responses");
    expect(request.previous_response_id).toBe("r1");
    expect(request.input).toEqual([{ role: "user", content: "next" }]);
    expect(request.text.format.schema).toEqual(schema);
    expect(request.max_output_tokens).toBe(8192);
    expect(session.usage.cacheReadTokens).toBe(2000);
  });
  it("does not create explicit cache writes for a one-shot modern OpenAI request", () => {
    const request = buildRequest(
      createAiSession(settings(), "context", false),
      "one",
      {},
    );
    expect(request.body.prompt_cache_options).toMatchObject({
      mode: "explicit",
    });
  });
  it("rebuilds an expired native ID with the original context and complete history reset", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        json({ error: { message: "previous_response_id expired" } }, 404),
      )
      .mockResolvedValueOnce(json(response("fresh")));
    vi.stubGlobal("fetch", fetch);
    const session = createAiSession(settings(), "all original sources");
    session.cursor = "old";
    await generateTurn(session, "only remaining ref", {});
    const body = JSON.parse(fetch.mock.calls[1][1].body);
    expect(body.previous_response_id).toBeUndefined();
    expect(body.instructions).toContain("all original sources");
    expect(body.input[0].content).toContain("remaining");
    expect(session.notices.length).toBe(1);
  });
  it("keeps Anthropic history and applies a stable system cache boundary", () => {
    const session = createAiSession(
      settings({
        provider: "anthropic",
        protocol: "messages",
        model: "claude-sonnet-5",
      }),
      "context",
    );
    session.history = [
      { role: "user", content: "first" },
      { role: "assistant", content: "result" },
    ];
    const request = buildRequest(session, "second", {
      schema: { type: "object" },
    });
    expect(request.body.messages).toHaveLength(3);
    expect(request.body.system).toEqual([
      {
        type: "text",
        text: "context",
        cache_control: { type: "ephemeral", ttl: "5m" },
      },
    ]);
    expect(request.body.output_config).toHaveProperty("format");
    expect(request.headers["anthropic-dangerous-direct-browser-access"]).toBe(
      "true",
    );
  });
  it("uses Gemini Interactions with current schema and continuation fields", () => {
    const session = createAiSession(
      settings({
        provider: "google",
        protocol: "interactions",
        model: "gemini-3.8-flash",
      }),
      "context",
    );
    session.cursor = "i1";
    const request = buildRequest(session, "next", {
      schema: { type: "object" },
    });
    expect(request.url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
    );
    expect(request.body).toMatchObject({
      previous_interaction_id: "i1",
      input: "next",
      system_instruction: "context",
      response_format: { mime_type: "application/json" },
      generation_config: { max_output_tokens: 8192 },
    });
  });
  it("parses thought events, initial Gemini text, terminal status and usage separately", () => {
    const reply = emptyReply();
    consumeEvent(
      "interactions",
      {
        event_type: "step.delta",
        delta: { type: "thought_signature", signature: "hidden" },
      },
      reply,
    );
    consumeEvent(
      "interactions",
      {
        event_type: "step.start",
        step: { type: "model_output", content: [{ type: "text", text: "{" }] },
      },
      reply,
    );
    consumeEvent(
      "interactions",
      { event_type: "step.delta", delta: { type: "text", text: "}" } },
      reply,
    );
    consumeEvent(
      "interactions",
      {
        event_type: "interaction.completed",
        interaction: {
          id: "i1",
          status: "completed",
          usage: {
            total_input_tokens: 100,
            total_cached_tokens: 50,
            total_output_tokens: 2,
          },
        },
      },
      reply,
    );
    expect(reply).toMatchObject({
      text: "{}",
      id: "i1",
      complete: true,
      usage: { cacheReadTokens: 50 },
    });
  });
  it("honors a custom model and full endpoint without guessing its capabilities", () => {
    const session = createAiSession(
      settings({
        provider: "custom",
        model: "mine",
        protocol: "responses",
        baseUrl: "https://gateway.example/proxy/responses?route=a",
      }),
      "context",
    );
    const request = buildRequest(session, "next", {});
    expect(request.url).toBe(session.settings.baseUrl);
    expect(request.body.model).toBe("mine");
    expect(request.body.prompt_cache_options).toBeUndefined();
  });
  it("handles CRLF framing, UTF-8 chunk splits and multiline SSE data", async () => {
    const bytes = new TextEncoder().encode(
      ':ping\r\ndata: {"text":\r\ndata: "中文"}\r\n\r\n',
    );
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < bytes.length; i++)
          controller.enqueue(bytes.slice(i, i + 1));
        controller.close();
      },
    });
    const frames: string[] = [];
    await readSse(stream, (frame) => frames.push(frame));
    expect(frames.map((f) => JSON.parse(f))).toEqual([{ text: "中文" }]);
  });
  it("does not issue a request after cancellation", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const controller = new AbortController();
    controller.abort();
    await expect(
      generateTurn(createAiSession(settings(), "context"), "next", {
        signal: controller.signal,
      }),
    ).rejects.toBeDefined();
    expect(fetch).not.toHaveBeenCalled();
  });
});
describe("settings migration", () => {
  const legacy = {
    enabled: true,
    provider: "openai",
    baseUrl: "https://proxy.example/v1/chat/completions",
    model: "my-model",
    batchSize: 8,
  };
  it("explicitly migrates v1 while retaining custom model, endpoint and segment size", () => {
    expect(normalizeShareableAiSettings(legacy)).toMatchObject({
      ...legacy,
      version: 2,
      protocol: "chat",
    });
    const imported = parseAiSettingsJson(
      JSON.stringify({
        version: 1,
        exportedAt: "2026-09-12",
        settings: legacy,
      }),
    );
    expect(imported.apiKey).toBe("");
    expect(imported.model).toBe("my-model");
  });
  it("rejects unknown future structures and secrets in shareable settings", () => {
    expect(() =>
      normalizeShareableAiSettings({ ...legacy, version: 3 }),
    ).toThrow();
    expect(() =>
      normalizeShareableAiSettings({ ...legacy, apiKey: "secret" }),
    ).toThrow();
  });
});

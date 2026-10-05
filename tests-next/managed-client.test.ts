import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addUsage,
  managedFetch,
  managedTurn,
  readManagedStream,
} from "@/lib/managed-client";
import { responseCost } from "@lexiro/ai-contract";
import type { AiSession } from "@/src/types/ai";

const auth = vi.hoisted(() => ({
  currentUser: { uid: "a", getIdToken: vi.fn() },
  authStateReady: vi.fn(async () => {}),
}));
vi.mock("@/src/lib/firebase", () => ({ getFirebaseAuth: () => auth }));
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_AI_WORKER_URL", "https://worker.example");
  auth.currentUser.uid = "a";
  auth.currentUser.getIdToken
    .mockReset()
    .mockResolvedValueOnce("initial")
    .mockResolvedValue("fresh");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("managed AI boundary", () => {
  it("preserves administrator diagnostics from failed question streams", async () => {
    const diagnostic = { phase: "draft", status: 400, requestId: "req_test", provider: { code: "unsupported_parameter", param: "reasoning.effort" } };
    const stream = new Response(`data: ${JSON.stringify({ type: "error", code: "upstream_unavailable", diagnostic })}\n\n`);
    await expect(readManagedStream(stream, {})).rejects.toMatchObject({ code: "upstream_unavailable", debugMessage: JSON.stringify(diagnostic) });
  });
  it("declares the reviewed question contract only for question requests", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response([
      'data: {"type":"response.output_text.delta","delta":"{}"}\n\n',
      'data: {"type":"response.completed","response":{}}\n\n',
    ].join("")));
    vi.stubGlobal("fetch", fetcher);
    const session: AiSession = {model:"gpt-6-luna",tier:"lite",sessionId:crypto.randomUUID(),context:"",notices:[],usage:{}};
    await managedTurn(session, {kind:"vocabulary",sources:[],difficulty:2});
    await managedTurn(session, {kind:"explain",raw:"test"});
    expect(new Headers(fetcher.mock.calls[0][1]!.headers).get("X-Question-Contract")).toBe("single-pass-v1");
    expect(new Headers(fetcher.mock.calls[1][1]!.headers).has("X-Question-Contract")).toBe(false);
  });
  it("reports review progress and rejects unapproved work without retrying", async () => {
    const phases = vi.fn();
    const characters = vi.fn();
    const frames = [
      { type: "lexiro.question.progress", phase: "draft", characters: 100 },
      { type: "lexiro.question.progress", phase: "review", characters: 20 },
      { type: "error", code: "question_quality_rejected", response: {
        model: "gpt-6-luna", lexiro: { usageParts: [
          { model: "gpt-6-luna", input: 200_000, output: 1_000 },
          { model: "gpt-6-luna", input: 200_000, output: 1_000 },
        ] },
      } },
    ].map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");
    const result = readManagedStream(new Response(frames), { onPhase: phases, onCharacters: characters });
    await expect(result).rejects.toMatchObject({ code: "question_quality_rejected", retryable: false });
    expect(phases.mock.calls).toEqual([["generating"], ["reviewing"]]);
    expect(characters.mock.calls).toEqual([[0], [100], [20]]);
    try { await result; } catch (error) {
      expect(addUsage({}, (error as {usage: Parameters<typeof addUsage>[1]}).usage).costUsd).toBeCloseTo(0.041);
    }
  });
  it("prices each review response individually before summing", () => {
    const parts = [
      {model: "gpt-6-luna", input: 200_000, output: 1_000, cached: 50_000},
      {model: "gpt-6-luna", input: 200_000, output: 1_000},
    ];
    const usage = addUsage({}, {model: "gpt-6-luna", input: 400_000, output: 2_000, parts});
    expect(usage.costUsd).toBeCloseTo(0.0365);
    expect(usage.uncachedCostUsd).toBeCloseTo(0.041);
    expect(responseCost({parts: [parts[0], {model: "gpt-6-luna"}]})).toBeNull();
    addUsage(usage, {model: "gpt-6-luna", parts: [{model: "gpt-6-luna"}]});
    addUsage(usage, parts[1]);
    expect(usage.costUsd).toBeUndefined();
  });
  it("reports stale admin edits and management failures in the correct action context", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({ error: { code: "stale_account" } }, { status: 409 }),
        )
        .mockResolvedValueOnce(
          Response.json(
            { error: { code: "upstream_unavailable" } },
            { status: 500 },
          ),
        ),
    );
    await expect(managedFetch("/admin/accounts/u")).rejects.toMatchObject({
      code: "stale_account",
      message: "帳號資料已變動。請重新載入帳號，確認最新內容後再調整。",
    });
    await expect(managedFetch("/admin/settings")).rejects.toThrow(
      "管理操作暫時無法完成",
    );
  });
  it("refreshes Firebase once on 401 and authenticates the second request", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(new Response("{}"));
    vi.stubGlobal("fetch", fetcher);
    await managedFetch("/me");
    expect(auth.currentUser.getIdToken.mock.calls).toEqual([[false], [true]]);
    expect(
      new Headers(fetcher.mock.calls[1][1].headers).get("Authorization"),
    ).toBe("Bearer fresh");
  });
  it("does not loop after a second unauthorized response", async () => {
    const fetcher = vi.fn(async () => new Response("", { status: 401 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(managedFetch("/me")).rejects.toMatchObject({ status: 401 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("discards an old account's in-flight response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        auth.currentUser.uid = "b";
        return new Response("{}");
      }),
    );
    await expect(managedFetch("/me")).rejects.toMatchObject({
      name: "AbortError",
    });
  });
  it("keeps upstream error text out of the public message but exposes it for photo debugging", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: { code: "upstream", message: "provider image failure" },
            }),
            { status: 500 },
          ),
      ),
    );
    const request = managedFetch("/generate");
    await expect(request).rejects.not.toThrow("provider image failure");
    await expect(request).rejects.toMatchObject({
      debugMessage: "provider image failure",
    });
  });
  it("reads UTF-8 SSE in byte-sized chunks and keeps model and usage", async () => {
    const events = [
      {
        type: "response.created",
        response: { id: "resp_test", model: "internal" },
      },
      { type: "response.output_text.delta", delta: "中文 🌲" },
      {
        type: "response.completed",
        response: {
          usage: {
            input_tokens: 40,
            output_tokens: 12,
            input_tokens_details: { cached_tokens: 32 },
          },
          lexiro: { credits: 3 },
        },
      },
    ]
      .map((e) => `data: ${JSON.stringify(e)}\r\n\r\n`)
      .join("");
    const bytes = new TextEncoder().encode(events);
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        for (const byte of bytes) c.enqueue(new Uint8Array([byte]));
        c.close();
      },
    });
    const result = await readManagedStream(new Response(stream), {});
    expect(result).toEqual({
      text: "中文 🌲",
      id: "resp_test",
      complete: true,
      stopReason: "complete",
      usage: {
        model: "internal",
        input: 40,
        cached: 32,
        output: 12,
        credits: 3,
      },
    });
  });
  it("accumulates cache-write tokens for the displayed provider cost", () => {
    const total = addUsage(
      { model: "gpt-6-luna", input: 40, cacheWrite: 10 },
      {
        model: "gpt-6-luna",
        input: 60,
        cached: 20,
        cacheWrite: 15,
        output: 12,
      },
    );
    expect(total).toMatchObject({
      model: "gpt-6-luna",
      input: 100,
      cached: 20,
      cacheWrite: 25,
      output: 12,
    });
  });
  it("adds each response's real token cost, including cache writes and net savings", () => {
    const usage = addUsage(
      addUsage(
        {},
        {
          model: "gpt-6-luna",
          input: 10_000,
          cacheWrite: 2_000,
          output: 1_000,
        },
      ),
      { model: "gpt-6-luna", input: 10_000, cached: 6_000, output: 1_000 },
    );
    expect(usage).toMatchObject({
      input: 20_000,
      cached: 6_000,
      cacheWrite: 2_000,
    });
    expect(usage.costUsd).toBeCloseTo(0.00251);
    expect(usage.uncachedCostUsd).toBeCloseTo(0.003);
    expect(
      responseCost({
        model: "gpt-6-luna",
        input: 300_000,
        output: 100_000,
      }),
    ).toBeCloseTo(0.135);
  });
  it("keeps reported cost when a response is truncated", async () => {
    const frames = [
      {
        type: "response.created",
        response: { id: "resp_truncated", model: "gpt-6-luna" },
      },
      {
        type: "response.incomplete",
        response: {
          incomplete_details: { reason: "max_output_tokens" },
          usage: {
            input_tokens: 10_000,
            output_tokens: 1_000,
            input_tokens_details: {
              cached_tokens: 6_000,
              cache_write_tokens: 2_000,
            },
          },
        },
      },
    ]
      .map((event) => `data: ${JSON.stringify(event)}\n\n`)
      .join("");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(frames)),
    );
    const session: AiSession = {
      model: "gpt-6-luna",
      tier: "lite",
      context: "",
      sessionId: crypto.randomUUID(),
      notices: [],
      usage: {},
    };
    await expect(
      managedTurn(session, { kind: "explain", raw: "test" }),
    ).rejects.toMatchObject({
      code: "truncated",
    });
    expect(session.usage).toMatchObject({
      input: 10_000,
      cached: 6_000,
      cacheWrite: 2_000,
    });
    expect(session.usage.costUsd).toBeCloseTo(0.00101);
  });
  it("does not accept a disconnected stream as completed content", async () => {
    await expect(
      readManagedStream(
        new Response(
          'data: {"type":"response.output_text.delta","delta":"partial"}\n\n',
        ),
        {},
      ),
    ).rejects.toMatchObject({ streamBroken: true });
  });
});

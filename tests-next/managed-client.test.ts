import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addUsage, managedFetch, readManagedStream } from "@/lib/managed-client";

const auth = vi.hoisted(() => ({ currentUser: { uid: "a", getIdToken: vi.fn() }, authStateReady: vi.fn(async () => {}) }));
vi.mock("@/src/lib/firebase", () => ({ getFirebaseAuth: () => auth }));
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_AI_WORKER_URL", "https://worker.example");
  auth.currentUser.uid = "a";
  auth.currentUser.getIdToken.mockReset().mockResolvedValueOnce("initial").mockResolvedValue("fresh");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("managed AI boundary", () => {
  it("refreshes Firebase once on 401 and authenticates the second request", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response("", { status: 401 })).mockResolvedValueOnce(new Response("{}"));
    vi.stubGlobal("fetch", fetcher);
    await managedFetch("/me");
    expect(auth.currentUser.getIdToken.mock.calls).toEqual([[false], [true]]);
    expect(new Headers(fetcher.mock.calls[1][1].headers).get("Authorization")).toBe("Bearer fresh");
  });
  it("does not loop after a second unauthorized response", async () => {
    const fetcher = vi.fn(async () => new Response("", { status: 401 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(managedFetch("/me")).rejects.toMatchObject({ status: 401 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("discards an old account's in-flight response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { auth.currentUser.uid = "b"; return new Response("{}"); }));
    await expect(managedFetch("/me")).rejects.toMatchObject({ name: "AbortError" });
  });
  it("keeps upstream error text out of the public message but exposes it for photo debugging", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { code: "upstream", message: "provider image failure" } }), { status: 500 })));
    const request = managedFetch("/generate");
    await expect(request).rejects.not.toThrow("provider image failure");
    await expect(request).rejects.toMatchObject({
      debugMessage: "provider image failure",
    });
  });
  it("reads UTF-8 SSE in byte-sized chunks and keeps model and usage", async () => {
    const events = [
      { type: "response.created", response: { id: "resp_test", model: "internal" } },
      { type: "response.output_text.delta", delta: "中文 🌲" },
      { type: "response.completed", response: { usage: { input_tokens: 40, output_tokens: 12, input_tokens_details: { cached_tokens: 32 } }, lexiro: { credits: 3 } } },
    ].map((e) => `data: ${JSON.stringify(e)}\r\n\r\n`).join("");
    const bytes = new TextEncoder().encode(events);
    const stream = new ReadableStream<Uint8Array>({ start(c) { for (const byte of bytes) c.enqueue(new Uint8Array([byte])); c.close(); } });
    const result = await readManagedStream(new Response(stream), {});
    expect(result).toEqual({ text: "中文 🌲", id: "resp_test", complete: true, stopReason: "complete", usage: { model: "internal", input: 40, cached: 32, output: 12, credits: 3 } });
  });
  it("accumulates cache-write tokens for the displayed provider cost", () => {
    const total = addUsage(
      { model: "gpt-6-luna", input: 40, cacheWrite: 10 },
      { model: "gpt-6-luna", input: 60, cached: 20, cacheWrite: 15, output: 12 },
    );
    expect(total).toMatchObject({
      model: "gpt-6-luna",
      input: 100,
      cached: 20,
      cacheWrite: 25,
      output: 12,
    });
  });
  it("does not accept a disconnected stream as completed content", async () => {
    await expect(readManagedStream(new Response('data: {"type":"response.output_text.delta","delta":"partial"}\n\n'), {})).rejects.toMatchObject({ streamBroken: true });
  });
});

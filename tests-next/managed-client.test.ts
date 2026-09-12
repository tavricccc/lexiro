import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { managedFetch, readManagedStream } from "@/lib/managed-client";

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
  it("never displays upstream error text", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { code: "upstream", message: "private prompt" } }), { status: 500 })));
    await expect(managedFetch("/generate")).rejects.not.toThrow("private prompt");
  });
  it("reads UTF-8 SSE in byte-sized chunks and ignores model and usage", async () => {
    const events = [
      { type: "response.created", response: { id: "resp_test", model: "internal" } },
      { type: "response.output_text.delta", delta: "中文 🌲" },
      { type: "response.completed", response: { usage: { output_tokens: 12 } } },
    ].map((e) => `data: ${JSON.stringify(e)}\r\n\r\n`).join("");
    const bytes = new TextEncoder().encode(events);
    const stream = new ReadableStream<Uint8Array>({ start(c) { for (const byte of bytes) c.enqueue(new Uint8Array([byte])); c.close(); } });
    const result = await readManagedStream(new Response(stream), {});
    expect(result).toEqual({ text: "中文 🌲", id: "resp_test", complete: true, stopReason: "complete" });
  });
  it("does not accept a disconnected stream as completed content", async () => {
    await expect(readManagedStream(new Response('data: {"type":"response.output_text.delta","delta":"partial"}\n\n'), {})).rejects.toMatchObject({ streamBroken: true });
  });
});

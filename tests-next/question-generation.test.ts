import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExecutionContext } from "@cloudflare/workers-types";
import { QUESTION_GENERATION_CONTRACT } from "@lexiro/ai-contract";
import { testDatabase } from "./database";
import { createWorker } from "../src/index";
import type { Env } from "../src/env";
import { roomFixture } from "./room-fixture";
let fixture: Awaited<ReturnType<typeof testDatabase>>;
let env: Env;
beforeEach(async () => {
  fixture = await testDatabase();
  env = { DB: fixture.db, FIREBASE_PROJECT_ID: "test", ADMIN_EMAILS: "", OPENAI_API_KEY: "synthetic", OPENAI_BASE_URL: "https://provider.test/v1", ALLOWED_ORIGIN: "https://lexiro.test" };
});
afterEach(async () => { await fixture.runtime.dispose(); });
const verify = async () => ({ uid: "u", email: "u@example.test", emailVerified: true });
const item = { sentence: "After missing several weeks of school because of a serious illness, Leo followed his doctor's plan and gradually began to recover; soon he could attend classes without feeling weak.", usage: "recover", answer: "recover", distractors: ["decline", "collapse", "worsen"], explanation: "身體恢復。", whyWrong: ["衰退", "倒下", "變差"] };
const request = (contract: string = QUESTION_GENERATION_CONTRACT) => new Request("https://worker.test/generate", { method: "POST", headers: { origin: "https://lexiro.test", "content-type": "application/json", "x-question-contract": contract }, body: JSON.stringify({ kind: "vocabulary", model: "gpt-6-luna", tier: "lite", session: crypto.randomUUID(), difficulty: 2, sources: [{ ref: "s1", word: "recover", pos: "v.", meaningZh: "康復" }] }) });
const frame = (type: string, value: object) => `event: ${type}\ndata: ${JSON.stringify({ type, ...value })}\n\n`;
function start(req: Request, fetcher: typeof fetch) {
  const pending: Promise<unknown>[] = [];
  const context = { waitUntil: (promise: Promise<unknown>) => pending.push(promise) } as unknown as ExecutionContext;
  req.headers.set("x-generation-id", crypto.randomUUID());
  return { pending, response: createWorker(verify, fetcher, roomFixture(env, fetcher, pending)).fetch(req, env, context) };
}
describe("single-pass question HTTP pipeline", () => {
  it("uses one native-compatible provider call and forwards content before completion", async () => {
    const release = Promise.withResolvers<void>();
    const text = JSON.stringify({ items: [item] });
    const response = { id: "resp_single", model: "gpt-6-luna", status: "completed", output: [{ content: [{ type: "output_text", text }] }], usage: { input_tokens: 1500, output_tokens: 400, input_tokens_details: { cached_tokens: 1100, cache_write_tokens: 400 } } };
    const upstream = vi.fn<typeof fetch>(async function (this: unknown) {
      expect(this).toBeUndefined();
      return new Response(new ReadableStream({ start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(frame("response.created", { response }) + frame("response.output_text.delta", { delta: text.slice(0, -2) })));
        void release.promise.then(() => { controller.enqueue(encoder.encode(frame("response.output_text.delta", { delta: text.slice(-2) }) + frame("response.completed", { response }))); controller.close(); });
      } }));
    });
    const operation = start(request(), upstream);
    const reader = (await operation.response).body!.getReader();
    const decoder = new TextDecoder();
    let output = decoder.decode((await reader.read()).value);
    while (!output.includes("response.output_text.delta")) output += decoder.decode((await reader.read()).value);
    expect(output).toContain("response.output_text.delta");
    expect(output).not.toContain("response.completed");
    release.resolve();
    for (;;) { const next = await reader.read(); if (next.done) break; output += decoder.decode(next.value); }
    await Promise.all(operation.pending);
    expect(upstream).toHaveBeenCalledOnce();
    expect(output).toContain("response.completed");
    expect(output).not.toContain("lexiro.question.progress");
    expect((await env.DB.prepare("SELECT status,units FROM usage_log").first())).toEqual({ status: "complete", units: 1 });
  });
  it("rejects the retired reviewed contract before calling the provider", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const response = await start(request("reviewed-v1"), fetcher).response;
    expect(response.status).toBe(426);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([false, true])("keeps provider diagnostics administrator-only (admin=%s)", async (admin) => {
    if (admin) env.ADMIN_EMAILS = "u@example.test";
    const upstream = vi.fn<typeof fetch>(async () => Response.json({ error: { code: "unsupported_parameter", param: "reasoning.effort", message: `Rejected ${env.OPENAI_API_KEY}` }, instructions: "private prompt" }, { status: 400, headers: { "x-request-id": "req_test" } }));
    const operation = start(request(), upstream);
    const response = await operation.response;
    const body = await response.text();
    await Promise.all(operation.pending);
    expect(response.status).toBe(200);
    if (admin) expect(body).toContain('"message":"Rejected [redacted]"');
    else expect(body).not.toContain("diagnostic");
    expect(body).not.toContain("private prompt");
    expect(body).not.toContain(env.OPENAI_API_KEY);
  });
});

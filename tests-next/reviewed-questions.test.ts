import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExecutionContext } from "@cloudflare/workers-types";
import { testDatabase } from "./database";
import { createWorker } from "../src/index";
import { account } from "../src/billing";
import { creditsFromUsage } from "../src/credits";
import { reconcileUsage } from "../src/usage-recovery";
import { adminUsage } from "../src/admin-usage";
import type { Env } from "../src/env";

let fixture: Awaited<ReturnType<typeof testDatabase>>;
let env: Env;
beforeEach(async () => {
  fixture = await testDatabase();
  env = { DB: fixture.db, FIREBASE_PROJECT_ID: "test", ADMIN_EMAILS: "", OPENAI_API_KEY: "synthetic",
    OPENAI_BASE_URL: "https://provider.test/v1", ALLOWED_ORIGIN: "https://lexiro.test" };
});
afterEach(async () => { await fixture.runtime.dispose(); });
const verify = async () => ({ uid: "u", email: "u@example.test", emailVerified: true });
const draft = { items: [{ sentence: "After missing several weeks of school because of a serious illness, Leo followed his doctor's plan and gradually began to recover; soon he could attend classes without feeling weak.",
  usage: "recover", answer: "recover", distractors: ["rest", "improve", "return"] }] };
const corrected = { items: [{ ...draft.items[0], distractors: ["decline", "collapse", "worsen"],
  explanation: "回到學校且不再虛弱表示健康逐漸恢復，recover 符合前後的改善結果。",
  whyWrong: ["decline 指健康衰退，和恢復上課的結果相反。", "collapse 指倒下，和能正常上課的結果相反。", "worsen 指變差，和不再虛弱的結果相反。"] }] };
const approved = { approved: true, unresolvedIssues: [], sourceRefs: ["s1"], issues: ["improve 也能成立，已更換干擾項。"], corrected };
const frame = (type: string, value: object) => `event: ${type}\ndata: ${JSON.stringify({ type, ...value })}\n\n`;
const usage = { input_tokens: 200_000, output_tokens: 1000, input_tokens_details: { cached_tokens: 100_000, cache_write_tokens: 20_000 } };
function reply(id: string, result: unknown, tokens: unknown = usage) {
  const text = JSON.stringify(result);
  const response = { id, status: "completed", model: "gpt-6-luna",
    output: [{ content: [{ type: "output_text", text }] }], ...(tokens ? { usage: tokens } : {}) };
  return new Response(frame("response.created", { response }) + frame("response.output_text.delta", { delta: text }) +
    frame("response.completed", { response }), { headers: { "content-type": "text/event-stream" } });
}
const request = (session: string, signal?: AbortSignal) => new Request("https://worker.test/generate", {
  method: "POST", signal, headers: { origin: "https://lexiro.test", authorization: "Bearer test", "content-type": "application/json", "x-question-contract": "reviewed-v1" },
  body: JSON.stringify({ kind: "vocabulary", model: "gpt-6-luna", tier: "lite", session, difficulty: 2,
    sources: [{ ref: "s1", word: "recover", pos: "v.", meaningZh: "康復" }] }),
});
function start(req: Request, fetcher: typeof fetch) {
  const pending: Promise<unknown>[] = [];
  const context = { waitUntil: (promise: Promise<unknown>) => pending.push(promise), passThroughOnException() {} } as unknown as ExecutionContext;
  return { pending, response: createWorker(verify, fetcher).fetch(req, env, context) };
}
function events(text: string) {
  return text.trim().split(/\n\n/).map((event) => JSON.parse(event.split("data: ")[1]) as Record<string, unknown>);
}

describe("reviewed question HTTP pipeline", () => {
  it.each([false, true])("reports provider parameter failures only to administrators (admin=%s)", async (admin) => {
    if (admin) env.ADMIN_EMAILS = "u@example.test";
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ error: { code: "unsupported_parameter", param: "reasoning.effort", type: "invalid_request_error", message: `Rejected reasoning parameter; key=${env.OPENAI_API_KEY}` }, instructions: "private prompt" }, { status: 400, headers: { "x-request-id": "req_test" } }));
    const operation = start(request(crypto.randomUUID()), fetcher);
    const text = await (await operation.response).text();
    await Promise.all(operation.pending);
    const failure = events(text).find((event) => event.type === "error")!;
    expect(failure.code).toBe("upstream_unavailable");
    if (admin) expect(failure.diagnostic).toMatchObject({ phase: "draft", status: 400, requestId: "req_test", provider: { code: "unsupported_parameter", param: "reasoning.effort", message: "Rejected reasoning parameter; key=[redacted]" } });
    else expect(failure).not.toHaveProperty("diagnostic");
    expect(text).not.toContain(env.OPENAI_API_KEY);
    expect(text).not.toContain("private prompt");
    expect((await account(env.DB, "u"))!.points).toBe(100);
  });
  it("rejects the removed grammar format before reserving or calling the provider", async () => {
    const original = request(crypto.randomUUID());
    const payload = await original.json() as Record<string, unknown>;
    const req = new Request(original.url, { method: "POST", headers: original.headers, body: JSON.stringify({ ...payload, kind: "grammar" }) });
    const fetcher = vi.fn<typeof fetch>();
    const response = await start(req, fetcher).response;
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: { code: "invalid_input" } });
    expect(fetcher).not.toHaveBeenCalled();
    expect((await env.DB.prepare("SELECT id FROM charges").all()).results).toEqual([]);
  });
  it("rejects an old question client before reserving points or calling the provider", async () => {
    const req = request(crypto.randomUUID());
    req.headers.delete("x-question-contract");
    const fetcher = vi.fn<typeof fetch>();
    const operation = start(req, fetcher);
    const response = await operation.response;
    expect(response.status).toBe(426);
    expect(await response.json()).toEqual({error:{code:"question_update_required"}});
    expect(fetcher).not.toHaveBeenCalled();
    expect((await account(env.DB,"u"))!.points).toBe(100);
    expect((await env.DB.prepare("SELECT id FROM charges").all()).results).toEqual([]);
  });
  it("replaces an ambiguous draft through an independent reviewer, settles both calls once, and makes retries free", async () => {
    await env.DB.prepare("UPDATE accounts SET points=1000 WHERE uid='u'").run();
    const calls: Record<string, unknown>[] = [];
    const fetcher = vi.fn<typeof fetch>(async function (this: unknown, _url, options) {
      expect(this).toBeUndefined();
      calls.push(await new Response(options!.body as BodyInit).json() as Record<string, unknown>);
      return calls.length % 2 ? reply("resp_draft", draft) : reply("resp_review", approved);
    });
    const session = crypto.randomUUID();
    const operation = start(request(session), fetcher);
    const text = await (await operation.response).text();
    await Promise.all(operation.pending);
    const output = events(text);
    expect(output.filter((event) => event.type === "lexiro.question.progress").map((event) => event.phase)).toContain("review");
    const publicText = output.filter((event) => event.type === "response.output_text.delta").map((event) => event.delta).join("");
    expect(JSON.parse(publicText)).toEqual(corrected);
    expect(publicText).not.toContain('"improve"');
    expect(calls[0].reasoning).toEqual({ effort: "low" });
    expect(calls[1].reasoning).toEqual({ effort: "medium" });
    expect(calls[1]).not.toHaveProperty("previous_response_id");
    expect(calls[1].input).not.toEqual(calls[0].input);
    const partCost = creditsFromUsage({ model: "gpt-6-luna", input: 200_000, output: 1000, cached: 100_000, cacheWrite: 20_000 })!;
    expect((await account(env.DB, "u"))!.points).toBe(1000 - 2 * partCost);
    const rows = (await env.DB.prepare("SELECT points,credits,usage_parts FROM usage_log").all()).results;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ points: 2 * partCost, credits: 2 * partCost });
    expect(JSON.parse(rows[0].usage_parts as string)).toHaveLength(2);
    const report = await (await adminUsage(new Request("https://worker.test/admin/usage"), env.DB)).json() as { entries: { costUsd: number }[] };
    expect(report.entries[0].costUsd).toBeCloseTo(0.024);
    const retry = start(request(session), fetcher);
    await (await retry.response).text();
    await Promise.all(retry.pending);
    expect((await account(env.DB, "u"))!.points).toBe(1000 - 2 * partCost);
  });

  it("completes drafting and reviewing under one hold even when the estimate exceeds the remaining balance", async () => {
    await env.DB.prepare("UPDATE accounts SET points=1 WHERE uid='u'").run();
    let calls = 0;
    const fetcher = vi.fn<typeof fetch>(async () => ++calls === 1 ? reply("resp_draft", draft) : reply("resp_review", approved));
    const operation = start(request(crypto.randomUUID()), fetcher);
    const text = await (await operation.response).text();
    await Promise.all(operation.pending);
    expect(calls).toBe(2);
    expect(text).toContain("response.completed");
    expect((await account(env.DB, "u"))!.points).toBe(0);
  });

  it.each([false, true])("withholds rejected or structurally invalid approval and refunds the reservation (%s)", async (claimedApproved) => {
    let calls = 0;
    const fetcher = vi.fn<typeof fetch>(async () => ++calls === 1 ? reply("resp_draft", draft) :
      reply("resp_review", { ...approved, approved: claimedApproved, ...(claimedApproved ? { corrected: draft } : {}) }));
    const operation = start(request(crypto.randomUUID()), fetcher);
    const text = await (await operation.response).text();
    await Promise.all(operation.pending);
    expect(events(text).filter((event) => event.type === "response.output_text.delta")).toEqual([]);
    expect(text).not.toContain(draft.items[0].sentence);
    expect(text).toContain("question_quality_rejected");
    expect((await account(env.DB, "u"))!.points).toBe(100);
    expect((await env.DB.prepare("SELECT points,credits,status FROM usage_log").first())).toMatchObject({ points: 0, status: "question_quality_rejected" });
    expect((await env.DB.prepare("SELECT id FROM charges").all()).results).toEqual([]);
  });

  it("persists each missing usage cursor and reconciles the complete operation without a partial debit", async () => {
    let calls = 0;
    const fetcher = vi.fn<typeof fetch>(async () => ++calls === 1 ? reply("resp_draft", draft, null) : reply("resp_review", approved, null));
    const operation = start(request(crypto.randomUUID()), fetcher);
    await (await operation.response).text();
    await Promise.all(operation.pending);
    const row = await env.DB.prepare("SELECT usage_parts,chargeable FROM pending_usage").first<{ usage_parts: string; chargeable: number }>();
    expect(JSON.parse(row!.usage_parts).map((part: { cursor: string }) => part.cursor)).toEqual(["resp_draft", "resp_review"]);
    expect(row!.chargeable).toBe(1);
    const recover = vi.fn(async (cursor: string) => cursor === "resp_draft" ? { id: cursor, usage } : undefined);
    await reconcileUsage(env.DB, recover, "u");
    expect((await env.DB.prepare("SELECT usage_state FROM usage_log").first())).toMatchObject({ usage_state: "pending" });
    await reconcileUsage(env.DB, async (cursor) => ({ id: cursor, usage }), "u");
    expect((await env.DB.prepare("SELECT * FROM pending_usage").all()).results).toEqual([]);
    expect((await env.DB.prepare("SELECT usage_state FROM usage_log").first())).toMatchObject({ usage_state: "reported" });
  });

  it("cancels during review without exposing the draft and retains unknown provider cost for reconciliation", async () => {
    const aborted = new AbortController();
    let calls = 0;
    const enteredReview = Promise.withResolvers<void>();
    const fetcher = vi.fn<typeof fetch>(async () => {
      if (++calls === 1) return reply("resp_draft", draft);
      return new Response(new ReadableStream({ start(controller) {
        controller.enqueue(new TextEncoder().encode(frame("response.created", { response: { id: "resp_review", model: "gpt-6-luna" } })));
        enteredReview.resolve();
      } }), { headers: { "content-type": "text/event-stream" } });
    });
    const operation = start(request(crypto.randomUUID(), aborted.signal), fetcher);
    const response = await operation.response;
    const reading = response.text();
    await enteredReview.promise;
    // Let the identity frame reach the collector before aborting the request.
    await new Promise((resolve) => setTimeout(resolve, 0));
    aborted.abort();
    const text = await reading;
    await Promise.all(operation.pending);
    expect(text).not.toContain(draft.items[0].sentence);
    expect((await account(env.DB, "u"))!.points).toBe(100);
    const row = await env.DB.prepare("SELECT chargeable,usage_parts FROM pending_usage").first<{ chargeable: number; usage_parts: string }>();
    expect(row!.chargeable).toBe(0);
    expect(JSON.parse(row!.usage_parts)).toHaveLength(2);
    await reconcileUsage(env.DB, async (cursor) => ({ id: cursor, usage }), "u");
    expect((await account(env.DB, "u"))!.points).toBe(100);
  });
});

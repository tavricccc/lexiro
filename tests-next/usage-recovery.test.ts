import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testDatabase } from "./database";
import { account, nowSeconds, reserve, scheduledMaintenance, settle } from "../src/billing";
import { prepareGeneration } from "../src/generation";
import { settleGeneration } from "../src/settlement";
import { createUsageRecovery, reconcileUsage, reportedUsage } from "../src/usage-recovery";
import type { Env } from "../src/env";

let fixture: Awaited<ReturnType<typeof testDatabase>>;
beforeEach(async () => { fixture = await testDatabase(); });
afterEach(async () => { await fixture.runtime.dispose(); });
const complete = () => ({
  id: "resp_pending", status: "completed",
  output: [{ content: [{ type: "output_text", text: JSON.stringify({ items: [
    { senses: [{ pos: "n.", meaningZh: "蘋果", example: "I ate an apple." }] },
  ] }) }] }],
});
const usage = { input_tokens: 900, output_tokens: 60 };
async function start() {
  const prepared = await prepareGeneration({ kind: "words", raw: "apple n. 蘋果", tier: "lite", session: crypto.randomUUID() }, "u");
  const hold = await reserve(fixture.db, "u", prepared.units, prepared.halfRate);
  return { prepared, hold };
}
const ledger = (id: string) => fixture.db.prepare(
  "SELECT points,credits,usage_state,debit_verified,status FROM usage_log WHERE id=?",
).bind(id).first();

describe("unknown provider usage", () => {
  it("recovers usage even when the terminal response object exists", async () => {
    const { prepared, hold } = await start();
    const recover = vi.fn(async () => ({ ...complete(), usage }));
    await settleGeneration(fixture.db, hold, prepared, { status: "complete", cursor: "resp_pending", response: complete() }, "gpt-5.6-luna", recover);
    expect(recover).toHaveBeenCalledExactlyOnceWith("resp_pending");
    expect(await ledger(hold.attempt)).toMatchObject({ credits: 2, points: 2, usage_state: "reported" });
    expect((await account(fixture.db, "u"))!.points).toBe(98);
  });

  it("retains unknown charges through maintenance, then reconciles exactly once", async () => {
    const { prepared, hold } = await start();
    await settleGeneration(fixture.db, hold, prepared, { status: "complete", cursor: "resp_pending", response: complete() }, "gpt-5.6-luna", async () => undefined);
    expect(await ledger(hold.attempt)).toMatchObject({ credits: null, points: 0, usage_state: "pending", debit_verified: 0 });
    await fixture.db.prepare("UPDATE charges SET created_at=? WHERE attempt_id=?").bind(nowSeconds() - 200, hold.attempt).run();
    await fixture.db.prepare("UPDATE accounts SET inflight_at=? WHERE uid='u'").bind(nowSeconds() - 200).run();
    await scheduledMaintenance(fixture.db);
    expect((await account(fixture.db, "u"))!.points).toBe(99);
    await expect(reserve(fixture.db, "u", prepared.units, prepared.halfRate)).rejects.toMatchObject({ status: 409 });
    const recover = async () => ({ ...complete(), usage });
    await Promise.all([reconcileUsage(fixture.db, recover, "u"), reconcileUsage(fixture.db, recover, "u")]);
    expect((await account(fixture.db, "u"))!.points).toBe(98);
    expect(await ledger(hold.attempt)).toMatchObject({ points: 2, credits: 2, debit_verified: 1, usage_state: "reported" });
    expect((await fixture.db.prepare("SELECT * FROM pending_usage").all()).results).toEqual([]);
    const retry = await reserve(fixture.db, "u", prepared.units, prepared.halfRate);
    expect(retry.charges).toEqual([]);
    await settle(fixture.db, retry, [], { model: "test" });
  });

  it("releases cancelled holds without claiming that provider cost was zero", async () => {
    const { prepared, hold } = await start();
    await settleGeneration(fixture.db, hold, prepared, { status: "cancelled", cursor: "resp_pending" }, "gpt-5.6-luna", async () => undefined);
    expect((await account(fixture.db, "u"))!.points).toBe(100);
    expect(await ledger(hold.attempt)).toMatchObject({ points: 0, credits: null, usage_state: "pending", status: "cancelled" });
    const next = await reserve(fixture.db, "u", [{ id: "next", limitId: "next" }], 2);
    await reconcileUsage(fixture.db, async () => ({ ...complete(), usage }), "u");
    expect((await account(fixture.db, "u"))!.points).toBe(99);
    expect(await ledger(hold.attempt)).toMatchObject({ points: 0, credits: 2, usage_state: "reported" });
    await settle(fixture.db, next, next.charges, { model: "test" });
  });

  it("records unavailable cost when no response identity exists", async () => {
    const { prepared, hold } = await start();
    await settleGeneration(fixture.db, hold, prepared, { status: "failed" }, "gpt-5.6-luna");
    expect(await ledger(hold.attempt)).toMatchObject({ credits: null, points: 0, usage_state: "unavailable" });
    expect((await account(fixture.db, "u"))!.points).toBe(100);
    expect((await fixture.db.prepare("SELECT * FROM pending_usage").all()).results).toEqual([]);
  });

  it("accepts explicit zero usage rather than confusing it with missing usage", async () => {
    const { prepared, hold } = await start();
    await settleGeneration(fixture.db, hold, prepared, { status: "complete", cursor: "resp_pending", response: { ...complete(), usage: { input_tokens: 0, output_tokens: 0 } } }, "gpt-5.6-luna");
    expect(await ledger(hold.attempt)).toMatchObject({ credits: 0, usage_state: "reported", debit_verified: 1 });
  });

  it("rejects incomplete, fractional and inconsistent usage", () => {
    for (const invalid of [{}, { input_tokens: 1 }, { input_tokens: -1, output_tokens: 1 },
      { input_tokens: 1.5, output_tokens: 1 }, { input_tokens: 2, output_tokens: 1, input_tokens_details: { cached_tokens: 3 } },
      { input_tokens: 2, output_tokens: 1, input_tokens_details: { cached_tokens: "1" } }]) {
      expect(reportedUsage({ usage: invalid }, "gpt-5.6-luna")).toBeUndefined();
    }
  });

  it("does not accept another response's usage or an unfinished stored response", async () => {
    const env = { OPENAI_BASE_URL: "https://provider.test/v1", OPENAI_API_KEY: "synthetic" } as Env;
    for (const value of [{ ...complete(), id: "resp_other", usage }, { ...complete(), status: "in_progress", usage }]) {
      const fetcher = vi.fn<typeof fetch>(async () => Response.json(value));
      expect(await createUsageRecovery(env, fetcher)("resp_pending")).toBeUndefined();
    }
  });
});

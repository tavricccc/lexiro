import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { Miniflare } from "miniflare";
import type { D1Database } from "@cloudflare/workers-types";
import { account, BillingError, ensureTrial, nextRenewal, ownsCursor, reserve, scheduledMaintenance, settle } from "../src/billing";

let mf: Miniflare, db: D1Database;
beforeEach(async () => {
  mf = new Miniflare({ workers: [{ config: {
    type: "worker", name: "billing-test", compatibilityDate: "2026-09-12",
    manifest: { mainModule: "index.js", modules: { "index.js": { type: "esm", contents: "export default {fetch(){return new Response('local test')}}" } } },
    env: { DB: { type: "d1" } },
  } }] });
  db = await mf.getD1Database("DB");
  const migration = await readFile(new URL("../migrations/0001_billing.sql", import.meta.url), "utf8");
  await db.batch(migration.split(";").map((sql) => sql.trim()).filter(Boolean).map((sql) => db.prepare(sql)));
  await db.prepare("INSERT INTO accounts(uid,email,points,monthly,renews_at,updated_at) VALUES('u','u@example.test',100,1000,?,'now')").bind(Math.floor(Date.now()/1000)+86400).run();
});
afterEach(async () => { await mf.dispose(); });
const balance = async () => (await account(db, "u"))!.points;

describe("D1 atomic credit ledger", () => {
  it("rounds the total and leaves retries free, including a split retry", async () => {
    const first = await reserve(db, "u", ["a", "b", "c"], 3, 300);
    expect(await balance()).toBe(95);
    await settle(db, first, [], { model: "test" }, "resp_first");
    const retry = await reserve(db, "u", ["b", "c"], 3, 300);
    expect(retry.charges).toEqual([]);
    expect(await balance()).toBe(95);
    await settle(db, retry, [], { model: "test" });
    expect(await ownsCursor(db, "u", "resp_first")).toBe(true);
    expect(await ownsCursor(db, "other", "resp_first")).toBe(false);
  });
  it("charges the rounded cost of new units when the request mixes old and new units", async () => {
    const first = await reserve(db, "u", ["a", "b"], 3, 300);
    await settle(db, first, [], { model: "test" });
    const next = await reserve(db, "u", ["b", "c"], 3, 300);
    expect(next.charges).toEqual([{ id: "c", points: 2 }]);
    expect(await balance()).toBe(95);
  });
  it("rolls all inserts back when a request exceeds the overdraft boundary", async () => {
    await expect(reserve(db, "u", ["expensive"], 1000, 300)).rejects.toMatchObject({ status: 402 });
    expect(await balance()).toBe(100);
    expect(await db.prepare("SELECT COUNT(*) AS n FROM charges").first("n")).toBe(0);
    const retry = await reserve(db, "u", ["affordable"], 2, 300);
    expect(retry.charges).toHaveLength(1);
  });
  it("allows bounded debt and rejects the next debit at its boundary", async () => {
    const first = await reserve(db, "u", ["large"], 800, 300);
    await settle(db, first, [], { model: "test" });
    expect(await balance()).toBe(-300);
    await expect(reserve(db, "u", ["one-more"], 2, 300)).rejects.toBeInstanceOf(BillingError);
    expect(await balance()).toBe(-300);
  });
  it("has one winner for concurrent requests from the same account", async () => {
    const results = await Promise.allSettled([reserve(db, "u", ["a"], 2, 300), reserve(db, "u", ["b"], 2, 300)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const failed = results.find((result) => result.status === "rejected");
    expect(failed).toMatchObject({ reason: { status: 409 } });
    expect(await balance()).toBe(99);
  });
  it("refunds missing units once and charges them again only on repair", async () => {
    const first = await reserve(db, "u", ["a", "b"], 2, 300);
    const refunds = first.charges.filter((charge) => charge.id === "b");
    await settle(db, first, refunds, { model: "test", input: 100, output: 20 });
    await settle(db, first, refunds, { model: "test" });
    expect(await balance()).toBe(99);
    const repair = await reserve(db, "u", ["a", "b"], 2, 300);
    expect(repair.charges.map((charge) => charge.id)).toEqual(["b"]);
    expect(await balance()).toBe(98);
  });
  it("does not refund previous successes when a retry fails", async () => {
    const first = await reserve(db, "u", ["a"], 2, 300);
    await settle(db, first, [], { model: "test" });
    const retry = await reserve(db, "u", ["a", "b"], 2, 300);
    await settle(db, retry, retry.charges, { model: "test" });
    expect(await balance()).toBe(99);
  });
  it("trial registration is off by default and never refills an existing trial", async () => {
    await ensureTrial(db, "new", "new@example.test");
    expect(await account(db, "new")).toBeNull();
    await db.prepare("UPDATE settings SET value='true' WHERE key='free_trial'").run();
    await ensureTrial(db, "new", "new@example.test");
    expect(await account(db, "new")).toMatchObject({ points: 500, monthly: 0 });
    await db.prepare("UPDATE accounts SET points=0 WHERE uid='new'").run();
    await ensureTrial(db, "new", "new@example.test");
    expect((await account(db, "new"))!.points).toBe(0);
  });
  it("renews each paid account separately and preserves one-time credits for monthly=0", async () => {
    const now = Math.floor(Date.now()/1000);
    await db.prepare("UPDATE accounts SET renews_at=?,points=5 WHERE uid='u'").bind(now-1).run();
    await db.prepare("INSERT INTO accounts(uid,email,points,monthly,renews_at,updated_at) VALUES('trial','t@example.test',400,0,?,'now')").bind(now-1).run();
    await scheduledMaintenance(db, now);
    expect(await balance()).toBe(1000);
    expect((await account(db,"u"))!.renews_at).toBeGreaterThan(now);
    expect((await account(db,"trial"))!.points).toBe(400);
  });
  it("clamps month end rather than skipping February", () => {
    expect(new Date(nextRenewal(Date.parse("2028-01-31T08:00:00Z")/1000)*1000).toISOString()).toBe("2028-02-29T08:00:00.000Z");
  });
});

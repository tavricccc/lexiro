import { beforeEach, afterEach, describe, expect, it } from "vitest";
import type { Miniflare } from "miniflare";
import { testDatabase } from "./database";
import type { D1Database } from "@cloudflare/workers-types";
import {
  account,
  BillingError,
  ensureTrial,
  nextRenewal,
  ownsCursor,
  reserve,
  scheduledMaintenance,
  settle,
} from "../src/billing";
import { creditsFromUsage } from "../src/credits";

let mf: Miniflare, db: D1Database;
beforeEach(async () => {
  const fixture = await testDatabase();
  mf = fixture.runtime;
  db = fixture.db;
});
afterEach(async () => {
  await mf.dispose();
});
const balance = async () => (await account(db, "u"))!.points;

describe("D1 atomic credit ledger", () => {
  it("converts provider usage to whole credits with exact upward rounding", () => {
    expect(
      creditsFromUsage({
        model: "gpt-5.6-luna",
        input: 1_000,
        cached: 500,
        output: 100,
      }),
    ).toBe(2);
    expect(
      creditsFromUsage({
        model: "gpt-5.6-terra",
        input: 100,
        output: 20,
      }),
    ).toBe(4);
    expect(creditsFromUsage({ model: "unknown", input: 100 })).toBeNull();
  });
  it("bounds retries even when failures refund and remove their charge records", async () => {
    for (let attempt = 0; attempt < 6; attempt++) {
      const reservation = await reserve(db, "u", ["same-source"], 2, 300);
      await settle(db, reservation, reservation.charges, { model: "test" });
    }
    await expect(reserve(db, "u", ["same-source"], 2, 300)).rejects.toMatchObject({ status: 429, message: "retry_limit" });
    expect(await balance()).toBe(100);
    const fresh = await reserve(db, "u", ["new-session-source"], 2, 300);
    expect(fresh.charges).toHaveLength(1);
  });
  it("refunds an abandoned attempt before reclaiming its expired lock", async () => {
    const abandoned = await reserve(db, "u", ["a"], 2, 300);
    const expired = Math.floor(Date.now() / 1000) - 121;
    await db.batch([
      db
        .prepare("UPDATE accounts SET inflight_at=? WHERE uid='u'")
        .bind(expired),
      db.prepare("UPDATE charges SET created_at=? WHERE uid='u'").bind(expired),
    ]);
    const retry = await reserve(db, "u", ["a"], 2, 300);
    expect(retry.charges).toHaveLength(1);
    expect(await balance()).toBe(99);
    await settle(db, abandoned, abandoned.charges, { model: "test" });
    expect(await balance()).toBe(99);
    await expect(reserve(db, "u", ["b"], 2, 300)).rejects.toMatchObject({
      status: 409,
    });
    await settle(db, retry, retry.charges, { model: "test" });
    expect(await balance()).toBe(100);
  });
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
  it("replaces the reservation with the actual credit cost exactly once", async () => {
    const reservation = await reserve(db, "u", ["a", "b", "c"], 3, 300);
    expect(await balance()).toBe(95);
    await settle(
      db,
      reservation,
      [],
      { model: "gpt-5.6-luna", input: 1_000, output: 100 },
      undefined,
      2,
    );
    await settle(
      db,
      reservation,
      [],
      { model: "gpt-5.6-luna", input: 1_000, output: 100 },
      undefined,
      2,
    );
    expect(await balance()).toBe(98);
    expect(
      await db
        .prepare("SELECT points,credits FROM usage_log WHERE id=?")
        .bind(reservation.attempt)
        .first(),
    ).toEqual({ points: 2, credits: 2 });
  });
  it("charges reported usage while leaving invalid units available to retry", async () => {
    const reservation = await reserve(db, "u", ["invalid"], 10, 300);
    await settle(
      db,
      reservation,
      reservation.charges,
      { model: "gpt-5.6-luna", input: 1_000, output: 100 },
      undefined,
      2,
    );
    expect(await balance()).toBe(98);
    const retry = await reserve(db, "u", ["invalid"], 10, 300);
    expect(retry.charges).toHaveLength(1);
  });
  it("charges the rounded cost of new units when the request mixes old and new units", async () => {
    const first = await reserve(db, "u", ["a", "b"], 3, 300);
    await settle(db, first, [], { model: "test" });
    const next = await reserve(db, "u", ["b", "c"], 3, 300);
    expect(next.charges).toEqual([{ id: "c", points: 2 }]);
    expect(await balance()).toBe(95);
  });
  it("rolls all inserts back when a request exceeds the overdraft boundary", async () => {
    await expect(
      reserve(db, "u", ["expensive"], 1000, 300),
    ).rejects.toMatchObject({ status: 402 });
    expect(await balance()).toBe(100);
    expect(
      await db.prepare("SELECT COUNT(*) AS n FROM charges").first("n"),
    ).toBe(0);
    const retry = await reserve(db, "u", ["affordable"], 2, 300);
    expect(retry.charges).toHaveLength(1);
  });
  it("allows bounded debt and rejects the next debit at its boundary", async () => {
    const first = await reserve(db, "u", ["large"], 800, 300);
    await settle(db, first, [], { model: "test" });
    expect(await balance()).toBe(-300);
    await expect(reserve(db, "u", ["one-more"], 2, 300)).rejects.toBeInstanceOf(
      BillingError,
    );
    expect(await balance()).toBe(-300);
  });
  it("has one winner for concurrent requests from the same account", async () => {
    const results = await Promise.allSettled([
      reserve(db, "u", ["a"], 2, 300),
      reserve(db, "u", ["b"], 2, 300),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
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
    await db
      .prepare("UPDATE settings SET value='true' WHERE key='free_trial'")
      .run();
    await db
      .prepare("UPDATE settings SET value='1500' WHERE key='trial_points'")
      .run();
    await ensureTrial(db, "new", "new@example.test");
    expect(await account(db, "new")).toMatchObject({ points: 1500, monthly: 0 });
    await db.prepare("UPDATE accounts SET points=0 WHERE uid='new'").run();
    await ensureTrial(db, "new", "new@example.test");
    expect((await account(db, "new"))!.points).toBe(0);
  });
  it("renews each paid account separately and preserves one-time credits for monthly=0", async () => {
    const now = Math.floor(Date.now() / 1000);
    await db
      .prepare("UPDATE accounts SET renews_at=?,points=5 WHERE uid='u'")
      .bind(now - 1)
      .run();
    await db
      .prepare(
        "INSERT INTO accounts(uid,email,points,monthly,renews_at,updated_at) VALUES('trial','t@example.test',400,0,?,'now')",
      )
      .bind(now - 1)
      .run();
    await scheduledMaintenance(db, now);
    expect(await balance()).toBe(1000);
    expect((await account(db, "u"))!.renews_at).toBeGreaterThan(now);
    expect((await account(db, "trial"))!.points).toBe(400);
  });
  it("clamps month end rather than skipping February", () => {
    expect(
      new Date(
        nextRenewal(Date.parse("2028-01-31T08:00:00Z") / 1000) * 1000,
      ).toISOString(),
    ).toBe("2028-02-29T08:00:00.000Z");
  });
});

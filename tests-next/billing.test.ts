import { beforeEach, afterEach, describe, expect, it } from "vitest";
import type { Miniflare } from "miniflare";
import { testDatabase } from "./database";
import type { D1Database } from "@cloudflare/workers-types";
import {
  account,
  ensureAccount,
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
/** One billable unit per id, charged and rate-limited under the same name. */
const units = (ids: string[]) => ids.map((id) => ({ id, limitId: id }));

describe("D1 atomic credit ledger", () => {
  it("converts provider usage to whole credits with exact upward rounding", () => {
    expect(creditsFromUsage({ model: "gpt-5.6-luna", input: 300_000, output: 100_000 })).toBe(2250);
    expect(creditsFromUsage({ model: "gpt-5.6-luna", input: 1_000_000, cached: 1_000_000 })).toBe(300);
    expect(creditsFromUsage({ model: "gpt-5.6-luna", input: 1_000_000, cacheWrite: 1_000_000 })).toBe(3750);
    expect(
      creditsFromUsage({
        model: "gpt-6-luna",
        input: 1_000,
        cached: 500,
        output: 100,
      }),
    ).toBe(1);
    expect(
      creditsFromUsage({
        model: "gpt-5.6-terra",
        input: 100,
        output: 20,
      }),
    ).toBe(4);
    expect(
      creditsFromUsage({
        model: "gpt-6-luna",
        input: 4_000,
        cacheWrite: 4_000,
      }),
    ).toBe(4);
    expect(
      creditsFromUsage({ model: "gpt-6-luna", input: 1_000_000, cached: 1_000_000 }),
    ).toBe(150);
    expect(
      creditsFromUsage({ model: "gpt-6-luna", input: 1_000_000, cacheWrite: 1_000_000 }),
    ).toBe(1875);
    expect(
      creditsFromUsage({ model: "gpt-6-luna", input: 272_000, cached: 272_000 }),
    ).toBe(21);
    expect(
      creditsFromUsage({ model: "gpt-6-luna", input: 300_000, output: 100_000 }),
    ).toBe(1013);
    expect(creditsFromUsage({ model: "unknown", input: 100 })).toBeNull();
  });
  it("bounds retries even when failures refund and remove their charge records", async () => {
    for (let attempt = 0; attempt < 6; attempt++) {
      const reservation = await reserve(db, "u", units(["same-source"]), 2);
      await settle(db, reservation, reservation.charges, { model: "test" });
    }
    await expect(
      reserve(db, "u", units(["same-source"]), 2),
    ).rejects.toMatchObject({ status: 429, message: "retry_limit" });
    expect(await balance()).toBe(100);
    const fresh = await reserve(db, "u", units(["new-session-source"]), 2);
    expect(fresh.charges).toHaveLength(1);
  });
  it("refunds an abandoned attempt before reclaiming its expired lock", async () => {
    const abandoned = await reserve(db, "u", units(["a"]), 2);
    const expired = Math.floor(Date.now() / 1000) - 901;
    await db.batch([
      db
        .prepare("UPDATE accounts SET inflight_at=? WHERE uid='u'")
        .bind(expired),
      db.prepare("UPDATE charges SET created_at=? WHERE uid='u'").bind(expired),
    ]);
    const retry = await reserve(db, "u", units(["a"]), 2);
    expect(retry.charges).toHaveLength(1);
    expect(await balance()).toBe(99);
    await settle(db, abandoned, abandoned.charges, { model: "test" });
    expect(await balance()).toBe(99);
    await expect(reserve(db, "u", units(["b"]), 2)).rejects.toMatchObject({
      status: 409,
    });
    await settle(db, retry, retry.charges, { model: "test" });
    expect(await balance()).toBe(100);
  });
  it("rounds the total and leaves retries free, including a split retry", async () => {
    const first = await reserve(db, "u", units(["a", "b", "c"]), 3);
    expect(await balance()).toBe(95);
    await settle(db, first, [], { model: "test" }, { cursor: "resp_first" });
    const retry = await reserve(db, "u", units(["b", "c"]), 3);
    expect(retry.charges).toEqual([]);
    expect(await balance()).toBe(95);
    await settle(db, retry, [], { model: "test" });
    expect(await ownsCursor(db, "u", "resp_first")).toBe(true);
    expect(await ownsCursor(db, "other", "resp_first")).toBe(false);
  });
  it("replaces the reservation with the actual credit cost exactly once", async () => {
    const reservation = await reserve(db, "u", units(["a", "b", "c"]), 3);
    expect(await balance()).toBe(95);
    await settle(
      db,
      reservation,
      [],
      { model: "gpt-6-luna", input: 1_000, output: 100 },
      { charged: 2, cost: 2 },
    );
    await settle(
      db,
      reservation,
      [],
      { model: "gpt-6-luna", input: 1_000, output: 100 },
      { charged: 2, cost: 2 },
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
    const reservation = await reserve(db, "u", units(["invalid"]), 10);
    await settle(
      db,
      reservation,
      reservation.charges,
      { model: "gpt-6-luna", input: 1_000, output: 100 },
      { charged: 2, cost: 2 },
    );
    expect(await balance()).toBe(98);
    const retry = await reserve(db, "u", units(["invalid"]), 10);
    expect(retry.charges).toHaveLength(1);
  });
  it("charges the rounded cost of new units when the request mixes old and new units", async () => {
    const first = await reserve(db, "u", units(["a", "b"]), 3);
    await settle(db, first, [], { model: "test" });
    const next = await reserve(db, "u", units(["b", "c"]), 3);
    expect(next.charges).toEqual([{ id: "c", points: 2 }]);
    expect(await balance()).toBe(95);
  });
  it("runs a batch the balance cannot cover and settles it at exactly zero", async () => {
    const first = await reserve(db, "u", units(["expensive"]), 1000);
    expect(first.charges).toHaveLength(1);
    await settle(
      db,
      first,
      [],
      { model: "test" },
      { charged: 4_000, cost: 4_000 },
    );
    expect(await balance()).toBe(0);
    expect(await db.prepare("SELECT points,assessed_points,debit_verified,credits FROM usage_log WHERE id=?")
      .bind(first.attempt).first()).toEqual({ points: 100, assessed_points: 4000, debit_verified: 1, credits: 4000 });
    await settle(db, first, [], { model: "test" }, { charged: 4000, cost: 4000 });
    expect(await balance()).toBe(0);
    expect(await db.prepare("SELECT points FROM usage_log WHERE id=?").bind(first.attempt).first()).toEqual({ points: 100 });
    await expect(
      reserve(db, "u", units(["one-more"]), 2),
    ).rejects.toMatchObject({ status: 402 });
    expect(await balance()).toBe(0);
  });
  it("returns the whole hold when an unaffordable batch fails", async () => {
    const first = await reserve(db, "u", units(["expensive"]), 1000);
    await settle(
      db,
      first,
      first.charges,
      { model: "test" },
      { charged: 0, cost: 0 },
    );
    expect(await balance()).toBe(100);
  });
  it("records provider cost for a run nobody was charged for", async () => {
    const reservation = await reserve(db, "u", units(["a"]), 2);
    await settle(
      db,
      reservation,
      reservation.charges,
      { model: "gpt-6-luna", input: 1_000, output: 100 },
      { charged: 0, cost: 2, status: "cancelled" },
    );
    expect(await balance()).toBe(100);
    expect(
      await db
        .prepare("SELECT points,credits,status FROM usage_log WHERE id=?")
        .bind(reservation.attempt)
        .first(),
    ).toEqual({ points: 0, credits: 2, status: "cancelled" });
  });
  it("keeps the retry ceiling when the client rotates its session", async () => {
    for (let attempt = 0; attempt < 6; attempt++) {
      const reservation = await reserve(
        db,
        "u",
        [{ id: `session-${attempt}`, limitId: "one-source" }],
        2,
      );
      await settle(db, reservation, reservation.charges, { model: "test" });
    }
    await expect(
      reserve(db, "u", [{ id: "session-6", limitId: "one-source" }], 2),
    ).rejects.toMatchObject({ status: 429 });
  });
  it("has one winner for concurrent requests from the same account", async () => {
    const results = await Promise.allSettled([
      reserve(db, "u", units(["a"]), 2),
      reserve(db, "u", units(["b"]), 2),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const failed = results.find((result) => result.status === "rejected");
    expect(failed).toMatchObject({ reason: { status: 409 } });
    expect(await balance()).toBe(99);
  });
  it("refunds missing units once and charges them again only on repair", async () => {
    const first = await reserve(db, "u", units(["a", "b"]), 2);
    const refunds = first.charges.filter((charge) => charge.id === "b");
    await settle(db, first, refunds, { model: "test", input: 100, output: 20 });
    await settle(db, first, refunds, { model: "test" });
    expect(await balance()).toBe(99);
    const repair = await reserve(db, "u", units(["a", "b"]), 2);
    expect(repair.charges.map((charge) => charge.id)).toEqual(["b"]);
    expect(await balance()).toBe(98);
  });
  it("does not refund previous successes when a retry fails", async () => {
    const first = await reserve(db, "u", units(["a"]), 2);
    await settle(db, first, [], { model: "test" });
    const retry = await reserve(db, "u", units(["a", "b"]), 2);
    await settle(db, retry, retry.charges, { model: "test" });
    expect(await balance()).toBe(99);
  });
  it("gives everyone who signs in an account row, empty when the trial is off", async () => {
    await ensureAccount(db, "new", "new@example.test");
    // The row exists so an administrator can see the person and grant them
    // something, even though the trial gave them nothing.
    expect(await account(db, "new")).toMatchObject({
      email: "new@example.test",
      points: 0,
      monthly: 0,
    });
  });
  it("hands a new account the configured defaults while the trial is on", async () => {
    await db.batch([
      db.prepare("UPDATE settings SET value='true' WHERE key='free_trial'"),
      db.prepare(
        "UPDATE settings SET value='1500' WHERE key='default_initial'",
      ),
      db.prepare("UPDATE settings SET value='250' WHERE key='default_monthly'"),
    ]);
    await ensureAccount(db, "new", "new@example.test");
    expect(await account(db, "new")).toMatchObject({
      points: 1500,
      monthly: 250,
    });
    // Signing in again is not a refill, and it does keep the address current.
    await db.prepare("UPDATE accounts SET points=0 WHERE uid='new'").run();
    await ensureAccount(db, "new", "renamed@example.test");
    expect(await account(db, "new")).toMatchObject({
      points: 0,
      email: "renamed@example.test",
    });
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

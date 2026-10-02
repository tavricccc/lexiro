import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AdminAccount, AdminUsageEntry } from "@lexiro/ai-contract";
import { testDatabase } from "./database";
import { adminRequest } from "../src/admin";
import { nowSeconds } from "../src/billing";
import { encodeCursor } from "../src/pagination";
import type { Env } from "../src/env";

let fixture: Awaited<ReturnType<typeof testDatabase>>;
beforeEach(async () => {
  fixture = await testDatabase();
});
afterEach(async () => {
  await fixture.runtime.dispose();
});
async function request(path: string) {
  return adminRequest(
    new Request(`https://local.test${path}`),
    { DB: fixture.db } as Env,
    path.split("?")[0],
  );
}
interface Report {
  entries: (AdminUsageEntry & {
    usageState: string;
    assessedPoints: number | null;
    debitVerified: number;
  })[];
  nextCursor: string | null;
  models: { credits: number; runs: number; costUsd: number | null }[];
  users: { points: number; costUsd: number | null }[];
  pendingUsage: number;
  unavailableUsage: number;
  unverifiedDebits: number;
}
const run = (id: string, at: number, state = "reported", verified = 1) =>
  fixture.db
    .prepare(
      `INSERT INTO usage_log(id,uid,points,model,created_at,credits,status,usage_state,debit_verified)
   VALUES(?,'u',7,'gpt-6-luna',?,?,'complete',?,?)`,
    )
    .bind(id, at, state === "reported" ? 2 : null, state, verified);

describe("indexed admin reports", () => {
  it("keeps missing historical credits unknown in model, account, and kind aggregates", async () => {
    const now = nowSeconds();
    await fixture.db
      .prepare(
        `INSERT INTO usage_log
      (id,uid,points,model,created_at,credits,status,usage_state,debit_verified,kind,tier,units,input,cached,cache_write,output)
      VALUES ('known-credit','u',1,'gpt-6-luna',?,1,'complete','reported',1,'vocabulary','lite',1,100,0,0,10),
      ('missing-credit','u',1,'gpt-6-luna',?,NULL,'complete','reported',0,'vocabulary','lite',1,100,0,0,10)`,
      )
      .bind(now, now)
      .run();
    const report = (await (await request("/admin/usage")).json()) as Report & {
      kinds: { credits: number | null }[];
    };
    expect(report.models[0]).toMatchObject({ credits: null, runs: 2 });
    expect(report.users[0]).toMatchObject({ credits: null, points: 1 });
    expect(report.kinds[0].credits).toBeNull();
    expect(report.models[0].costUsd).toBeCloseTo(0.00003);
    expect(report.unverifiedDebits).toBe(1);
  });
  it("separates model families for one kind and prices 5.6 long contexts correctly", async () => {
    const now = nowSeconds();
    await fixture.db
      .prepare(
        `INSERT INTO usage_log
      (id,uid,points,model,created_at,credits,status,usage_state,debit_verified,kind,tier,units,input,cached,cache_write,output)
      VALUES ('six','u',1,'gpt-6-luna',?,1,'complete','reported',1,'vocabulary','lite',1,300000,200000,20000,1000),
      ('five','u',2,'gpt-5.6-luna',?,2,'complete','reported',1,'vocabulary','lite',1,300000,200000,20000,1000)`,
      )
      .bind(now, now)
      .run();
    const report = (await (await request("/admin/usage")).json()) as {
      kinds: { model: string; costUsd: number }[];
    };
    expect(report.kinds).toHaveLength(2);
    expect(
      report.kinds.find((row) => row.model === "gpt-5.6-luna")?.costUsd,
    ).toBeCloseTo(0.0518);
    expect(
      report.kinds.find((row) => row.model === "gpt-6-luna")?.costUsd,
    ).toBeCloseTo(0.02575);
  });
  it("pages accounts by email and uid without shifting after a new account arrives", async () => {
    await fixture.db
      .prepare(
        `WITH RECURSIVE n(value) AS (SELECT 0 UNION ALL SELECT value+1 FROM n WHERE value<119)
      INSERT INTO accounts(uid,email,points,monthly,renews_at,updated_at)
      SELECT printf('user-%03d',value),'測試@example.test',0,0,0,'now' FROM n`,
      )
      .run();
    const first = (await (await request("/admin/accounts")).json()) as {
      accounts: AdminAccount[];
      nextCursor: string;
    };
    expect(first.accounts).toHaveLength(100);
    await fixture.db
      .prepare(
        "INSERT INTO accounts(uid,email,renews_at,updated_at) VALUES('new','a@example.test',0,'now')",
      )
      .run();
    const second = (await (
      await request(
        `/admin/accounts?cursor=${encodeURIComponent(first.nextCursor)}`,
      )
    ).json()) as { accounts: AdminAccount[]; nextCursor: null };
    expect(second.accounts).toHaveLength(21);
    expect(second.nextCursor).toBeNull();
    expect(
      new Set([...first.accounts, ...second.accounts].map((row) => row.uid))
        .size,
    ).toBe(121);
    expect(second.accounts.some((row) => row.uid === "new")).toBe(false);
  });

  it("pages equal-timestamp runs without duplicates or skipping rows", async () => {
    const now = nowSeconds();
    await fixture.db
      .prepare(
        `WITH RECURSIVE n(value) AS (SELECT 0 UNION ALL SELECT value+1 FROM n WHERE value<124)
      INSERT INTO usage_log(id,uid,points,model,created_at,credits,status,usage_state,debit_verified)
      SELECT printf('run-%03d',value),'u',7,'gpt-6-luna',?,2,'complete','reported',1 FROM n`,
      )
      .bind(now)
      .run();
    const ids: string[] = [];
    let cursor: string | null = null;
    do {
      const report = (await (
        await request(
          `/admin/usage${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
        )
      ).json()) as Report;
      ids.push(...report.entries.map((entry) => entry.id));
      if (!cursor) await run("newer", now + 1).run();
      cursor = report.nextCursor;
    } while (cursor);
    expect(ids).toHaveLength(125);
    expect(new Set(ids).size).toBe(125);
    expect(ids[0]).toBe("run-124");
    expect(ids.at(-1)).toBe("run-000");
  });

  it("reports unknown costs separately and excludes unverifiable historical debits", async () => {
    const now = nowSeconds();
    await fixture.db.batch([
      run("known", now),
      run("legacy", now, "reported", 0),
      run("pending", now, "pending", 0),
      run("unavailable", now, "unavailable"),
      run("old", now - 2_592_001, "pending", 0),
    ]);
    const report = (await (await request("/admin/usage")).json()) as Report;
    expect(report.models).toMatchObject([
      { credits: 4, runs: 2, costUsd: null },
    ]);
    expect(report.users).toMatchObject([{ points: 7 }]);
    expect(report).toMatchObject({
      pendingUsage: 1,
      unavailableUsage: 1,
      unverifiedDebits: 1,
    });
    expect(report.entries.find((row) => row.id === "pending")).toMatchObject({
      credits: null,
      usageState: "pending",
    });
  });

  it("prices each response before grouping and applies the long-context tier per response", async () => {
    const now = nowSeconds();
    await fixture.db
      .prepare(
        `INSERT INTO usage_log
      (id,uid,points,model,created_at,credits,status,usage_state,debit_verified,kind,tier,units,input,cached,cache_write,output)
      VALUES
      ('short-1','u',1,'gpt-6-luna',?,1,'complete','reported',1,'vocabulary','lite',1,200000,100000,20000,1000),
      ('short-2','u',1,'gpt-6-luna',?,1,'complete','reported',1,'vocabulary','lite',1,200000,100000,20000,1000),
      ('long','u',1,'gpt-6-luna',?,1,'complete','reported',1,'vocabulary','lite',1,300000,200000,20000,1000)`,
      )
      .bind(now, now, now)
      .run();
    const report = (await (await request("/admin/usage")).json()) as Report & {
      kinds: { costUsd: number | null }[];
    };
    expect(
      report.entries.find((row) => row.id === "short-1")?.costUsd,
    ).toBeCloseTo(0.012);
    expect(
      report.entries.find((row) => row.id === "long")?.costUsd,
    ).toBeCloseTo(0.02575);
    expect(report.models[0].costUsd).toBeCloseTo(0.04975);
    expect(report.users[0].costUsd).toBeCloseTo(0.04975);
    expect(report.kinds[0].costUsd).toBeCloseTo(0.04975);
  });

  it.each(["cursor=garbage", "cursor=", "offset=50"])(
    "rejects invalid or retired paging parameters: %s",
    async (query) => {
      await expect(request(`/admin/usage?${query}`)).rejects.toMatchObject({
        status: 400,
        field: "cursor",
      });
    },
  );
  it("rejects a cursor from the wrong endpoint", async () => {
    const cursor = encodeCursor({
      v: 1,
      page: "usage",
      createdAt: 1,
      id: "run",
    });
    await expect(
      request(`/admin/accounts?cursor=${cursor}`),
    ).rejects.toMatchObject({ status: 400 });
  });
});

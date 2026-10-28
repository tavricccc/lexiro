import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Miniflare } from "miniflare";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAgentSet, type AgentCloudRecord } from "@lexiro/agent-contract";
import { handleCloudApi } from "../src/cloud/api";
import { snapshotRecords } from "../src/cloud/records";
import type { CloudLimits } from "../src/cloud/repository";
import { guardAccount } from "../src/agent/guard";
import type { AgentEnv, RateLimiter } from "../src/agent/types";

async function migrate(
  db: Awaited<ReturnType<Miniflare["getD1Database"]>>,
  dir: string,
) {
  for (const file of (await readdir(new URL(`../${dir}/`, import.meta.url)))
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    const sql = await readFile(
      new URL(`../${dir}/${file}`, import.meta.url),
      "utf8",
    );
    await db.batch(
      sql
        .split(";")
        .map((statement) => statement.trim())
        .filter(Boolean)
        .map((statement) => db.prepare(statement)),
    );
  }
}
async function fixture() {
  const runtime = new Miniflare({
    workers: [
      {
        config: {
          name: "account-limits-test",
          compatibilityDate: "2026-10-10",
          manifest: {
            mainModule: "index.js",
            modules: {
              "index.js": {
                type: "esm",
                contents:
                  "export default {fetch(){return new Response('synthetic')}}",
              },
            },
          },
          env: { CLOUD_DB: { type: "d1" }, AGENT_DB: { type: "d1" } },
        },
      },
    ],
  });
  const cloud = await runtime.getD1Database("CLOUD_DB");
  const agent = await runtime.getD1Database("AGENT_DB");
  await migrate(cloud, "library-migrations");
  await migrate(agent, "agent-migrations");
  return { runtime, cloud, agent };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;

/** A set record of its own, so every call writes exactly one new record. */
function setRecord(name = "合成"): AgentCloudRecord {
  return [...snapshotRecords(createAgentSet(randomUUID(), name)).values()].find(
    (record) => record.type === "set",
  )!;
}
function push(f: Fixture, records: unknown[], limits?: CloudLimits, uid = "a") {
  return handleCloudApi(
    new Request("http://local.invalid/sync/records", {
      method: "POST",
      body: JSON.stringify({
        origin: randomUUID(),
        operationId: randomUUID(),
        records,
      }),
    }),
    uid,
    f.cloud,
    limits,
  );
}
async function account(f: Fixture, uid = "a") {
  return (await f.cloud
    .prepare(
      "SELECT revision,quota_writes,stored_bytes,(SELECT COALESCE(SUM(length(payload)),0) FROM cloud_records WHERE uid=?1) AS held FROM cloud_accounts WHERE uid=?1",
    )
    .bind(uid)
    .first<{
      revision: number;
      quota_writes: number;
      stored_bytes: number;
      held: number;
    }>())!;
}

describe("per-account daily write limit", () => {
  afterEach(() => vi.useRealTimers());

  it("refuses a write past the day's limit and says when it resets", async () => {
    const f = await fixture();
    try {
      vi.useFakeTimers({ toFake: ["Date"], now: Date.UTC(2026, 9, 28, 18) });
      const limits = { dailyWrites: 2 };
      await push(f, [setRecord(), setRecord()], limits);
      await expect(push(f, [setRecord()], limits)).rejects.toMatchObject({
        status: 429,
        code: "daily_write_limit",
        retryAfter: String(6 * 3600),
      });
    } finally {
      await f.runtime.dispose();
    }
  });

  it("writes nothing when the limit holds a commit back", async () => {
    const f = await fixture();
    try {
      await push(f, [setRecord()], { dailyWrites: 1 });
      const before = await account(f);
      await expect(
        push(f, [setRecord()], { dailyWrites: 1 }),
      ).rejects.toMatchObject({ code: "daily_write_limit" });
      expect(await account(f)).toEqual(before);
    } finally {
      await f.runtime.dispose();
    }
  });

  it("starts counting again on the next UTC day", async () => {
    const f = await fixture();
    try {
      vi.useFakeTimers({ toFake: ["Date"], now: Date.UTC(2026, 9, 28, 23) });
      await push(f, [setRecord()], { dailyWrites: 1 });
      vi.setSystemTime(Date.UTC(2026, 9, 29, 0, 1));
      await push(f, [setRecord()], { dailyWrites: 1 });
      expect((await account(f)).quota_writes).toBe(1);
    } finally {
      await f.runtime.dispose();
    }
  });

  it("does not limit an account the operator exempts", async () => {
    const f = await fixture();
    try {
      const limits = { dailyWrites: 1, unlimited: new Set(["a"]) };
      await push(f, [setRecord(), setRecord(), setRecord()], limits);
      expect((await account(f)).revision).toBe(1);
    } finally {
      await f.runtime.dispose();
    }
  });
});

describe("per-account storage limit", () => {
  it("tracks the payload bytes the account holds through overwrites and deletions", async () => {
    const f = await fixture();
    try {
      const record = setRecord("一個很長的單字集名稱");
      await push(f, [record, setRecord()]);
      await push(f, [
        { ...record, payload: { ...record.payload, setName: "短" } },
      ]);
      await push(f, [{ ...record, deleted: true, payload: null }]);
      const { stored_bytes, held } = await account(f);
      expect(stored_bytes).toBe(held);
      expect(held).toBeGreaterThan(0);
    } finally {
      await f.runtime.dispose();
    }
  });

  it("refuses a write that would grow the account past the limit", async () => {
    const f = await fixture();
    try {
      await push(f, [setRecord()]);
      const { stored_bytes } = await account(f);
      await expect(
        push(f, [setRecord()], { storageBytes: stored_bytes }),
      ).rejects.toMatchObject({ status: 413, code: "storage_limit" });
    } finally {
      await f.runtime.dispose();
    }
  });

  it("still accepts a deletion from an account over the limit", async () => {
    const f = await fixture();
    try {
      const record = setRecord();
      await push(f, [record, setRecord()]);
      await push(f, [{ ...record, deleted: true, payload: null }], {
        storageBytes: 1,
      });
      expect((await account(f)).revision).toBe(2);
    } finally {
      await f.runtime.dispose();
    }
  });
});

describe("account guard", () => {
  const env = (f: Fixture, limiter?: RateLimiter) =>
    ({ AGENT_DB: f.agent, USER_LIMITER: limiter }) as unknown as AgentEnv;

  it("lets an account through when it is neither throttled nor disabled", async () => {
    const f = await fixture();
    try {
      await expect(
        guardAccount(env(f, { limit: async () => ({ success: true }) }), "a"),
      ).resolves.toBeUndefined();
    } finally {
      await f.runtime.dispose();
    }
  });

  it("throttles a burst before reading D1", async () => {
    const limit = vi.fn(async () => ({ success: false }));
    const prepare = vi.fn();
    await expect(
      guardAccount(
        {
          AGENT_DB: { prepare },
          USER_LIMITER: { limit },
        } as unknown as AgentEnv,
        "a",
      ),
    ).rejects.toMatchObject({
      status: 429,
      code: "rate_limited",
      retryAfter: "60",
    });
    expect(limit).toHaveBeenCalledWith({ key: "a" });
    expect(prepare).not.toHaveBeenCalled();
  });

  it("refuses an account the operator disabled", async () => {
    const f = await fixture();
    try {
      await f.agent
        .prepare(
          "INSERT INTO disabled_accounts(uid,reason,disabled_at) VALUES('a','abuse',1)",
        )
        .run();
      await expect(guardAccount(env(f), "a")).rejects.toMatchObject({
        status: 403,
        code: "account_disabled",
      });
      await expect(guardAccount(env(f), "b")).resolves.toBeUndefined();
    } finally {
      await f.runtime.dispose();
    }
  });
});

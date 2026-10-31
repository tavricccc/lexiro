import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Miniflare } from "miniflare";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAgentSet, type AgentCloudRecord } from "@lexiro/agent-contract";
import { handleCloudApi } from "../src/cloud/api";
import { snapshotRecords } from "../src/cloud/records";
import type { CloudLimits } from "../src/cloud/repository";
import { AGENT_PAUSED_FLAG, guardAccount, guarded } from "../src/agent/guard";
import { DAILY_READ_LIMIT } from "../src/agent/read-budget";
import { deleteAccount } from "../src/agent/account";
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

describe("daily read budget", () => {
  const now = Date.UTC(2026, 9, 29, 18);
  const env = (f: Fixture, extra: Partial<AgentEnv> = {}) =>
    ({ AGENT_DB: f.agent, CLOUD_DB: f.cloud, ...extra }) as unknown as AgentEnv;
  const reads = async (f: Fixture, uid = "a") =>
    (await f.agent
      .prepare("SELECT day,rows FROM account_reads WHERE uid=?")
      .bind(uid)
      .first<{ day: string; rows: number }>()) ?? null;
  /** A request that reads every record the account holds. */
  const readAll = (e: AgentEnv) =>
    e.CLOUD_DB.prepare("SELECT * FROM cloud_records WHERE uid='a'").all();

  it("adds what a request read to the account's day", async () => {
    const f = await fixture();
    try {
      await push(
        f,
        Array.from({ length: 30 }, () => setRecord()),
      );
      await guarded(env(f), "a", { now }, readAll);
      await guarded(env(f), "a", { now }, readAll);
      const day = await reads(f);
      expect(day?.day).toBe("2026-10-29");
      expect(day?.rows).toBeGreaterThanOrEqual(60);
    } finally {
      await f.runtime.dispose();
    }
  });

  it("records nothing for a request that reads a few rows", async () => {
    const f = await fixture();
    try {
      await guarded(env(f), "a", { now }, (e) =>
        e.CLOUD_DB.prepare("SELECT 1").first(),
      );
      expect(await reads(f)).toBeNull();
    } finally {
      await f.runtime.dispose();
    }
  });

  it("refuses an account whose day is spent until the next UTC day", async () => {
    const f = await fixture();
    try {
      await f.agent
        .prepare(
          "INSERT INTO account_reads(uid,day,rows) VALUES('a','2026-10-29',?)",
        )
        .bind(DAILY_READ_LIMIT)
        .run();
      const run = vi.fn(async () => {});
      await expect(guarded(env(f), "a", { now }, run)).rejects.toMatchObject({
        status: 429,
        code: "daily_read_limit",
        retryAfter: String(6 * 3600),
      });
      expect(run).not.toHaveBeenCalled();
      await expect(
        guardAccount(env(f), "a", { now: now + 6 * 3600_000 }),
      ).resolves.toBeUndefined();
      await expect(
        guardAccount(env(f, { UNLIMITED_UIDS: "a" }), "a", { now }),
      ).resolves.toBeUndefined();
    } finally {
      await f.runtime.dispose();
    }
  });

  it("pauses Agent work, and only Agent work, while the quota runs low", async () => {
    const f = await fixture();
    try {
      await f.agent
        .prepare("INSERT INTO service_flags(name,updated_at) VALUES(?,0)")
        .bind(AGENT_PAUSED_FLAG)
        .run();
      await expect(
        guardAccount(env(f), "a", { agent: true }),
      ).rejects.toMatchObject({ status: 503, code: "agent_paused" });
      await expect(guardAccount(env(f), "a")).resolves.toBeUndefined();
    } finally {
      await f.runtime.dispose();
    }
  });
});

describe("account deletion", () => {
  const now = Date.UTC(2026, 9, 28, 12);
  const justSignedIn = now / 1000 - 60;
  function grants() {
    const held = new Map([
      ["a", ["g1", "g2", "g3"]],
      ["b", ["g4"]],
    ]);
    return {
      held,
      provider: {
        async listUserGrants(user: string, options?: { cursor?: string }) {
          const ids = held.get(decodeURIComponent(user)) ?? [];
          const start = Number(options?.cursor ?? 0);
          const page = ids.slice(start, start + 2);
          return {
            items: page.map((id) => ({ id })),
            cursor: start + 2 < ids.length ? String(start + 2) : undefined,
          };
        },
        async revokeGrant(id: string, user: string) {
          const uid = decodeURIComponent(user);
          held.set(
            uid,
            (held.get(uid) ?? []).filter((g) => g !== id),
          );
        },
      },
    };
  }
  async function seed(f: Fixture, uid: string) {
    await push(f, [setRecord(), setRecord()], undefined, uid);
    await f.cloud
      .prepare(
        "INSERT INTO set_shares(id,owner_uid,set_id,created_at) VALUES(?,?,?,'now')",
      )
      .bind(`share-${uid}`, uid, `set-${uid}`)
      .run();
    await f.cloud
      .prepare(
        "INSERT INTO cloud_set_cache(uid,set_id,revision,snapshot,updated_at) VALUES(?,'s',1,'{}',0)",
      )
      .bind(uid)
      .run();
    await f.agent.batch([
      f.agent
        .prepare(
          "INSERT INTO agent_links(id,token_hash,uid,set_id,created_at,expires_at) VALUES(?,?,?,'s',0,0)",
        )
        .bind(`link-${uid}`, `hash-${uid}`, uid),
      f.agent
        .prepare(
          "INSERT INTO app_auth_codes(code_hash,challenge,uid,google_id_token,expires_at) VALUES(?,'c',?,'t',0)",
        )
        .bind(`code-${uid}`, uid),
      f.agent
        .prepare(
          "INSERT INTO account_profiles(uid,email,seen_at) VALUES(?,'x@example.com',0)",
        )
        .bind(uid),
      f.agent
        .prepare("INSERT INTO account_reads(uid,day,rows) VALUES(?,'d',1)")
        .bind(uid),
    ]);
  }
  async function held(f: Fixture, uid: string) {
    const count = async (db: Fixture["cloud"], table: string, column = "uid") =>
      (await db
        .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column}=?`)
        .bind(uid)
        .first<{ n: number }>())!.n;
    return {
      records: await count(f.cloud, "cloud_records"),
      operations: await count(f.cloud, "cloud_operations"),
      accounts: await count(f.cloud, "cloud_accounts"),
      shares: await count(f.cloud, "set_shares", "owner_uid"),
      caches: await count(f.cloud, "cloud_set_cache"),
      links: await count(f.agent, "agent_links"),
      codes: await count(f.agent, "app_auth_codes"),
      reads: await count(f.agent, "account_reads"),
      profiles: await count(f.agent, "account_profiles"),
    };
  }
  const env = (f: Fixture, provider: unknown) =>
    ({
      CLOUD_DB: f.cloud,
      AGENT_DB: f.agent,
      OAUTH_PROVIDER: provider,
    }) as unknown as AgentEnv;

  it("erases the account's data and every MCP grant, and leaves other accounts alone", async () => {
    const f = await fixture();
    try {
      await seed(f, "a");
      await seed(f, "b");
      const before = await held(f, "b");
      const oauth = grants();
      await deleteAccount(env(f, oauth.provider), "a", justSignedIn, now);
      expect(await held(f, "a")).toEqual({
        records: 0,
        operations: 0,
        accounts: 0,
        shares: 0,
        caches: 0,
        links: 0,
        codes: 0,
        reads: 0,
        profiles: 0,
      });
      expect(oauth.held.get("a")).toEqual([]);
      expect(await held(f, "b")).toEqual(before);
      expect(oauth.held.get("b")).toEqual(["g4"]);
    } finally {
      await f.runtime.dispose();
    }
  });

  it("succeeds again on an account that is already gone", async () => {
    const f = await fixture();
    try {
      await seed(f, "a");
      const oauth = grants();
      await deleteAccount(env(f, oauth.provider), "a", justSignedIn, now);
      await expect(
        deleteAccount(env(f, oauth.provider), "a", justSignedIn, now),
      ).resolves.toBeUndefined();
    } finally {
      await f.runtime.dispose();
    }
  });

  it("asks for a recent sign-in and deletes nothing without one", async () => {
    const f = await fixture();
    try {
      await seed(f, "a");
      const before = await held(f, "a");
      await expect(
        deleteAccount(env(f, grants().provider), "a", now / 1000 - 3600, now),
      ).rejects.toMatchObject({ status: 403, code: "recent_sign_in_required" });
      expect(await held(f, "a")).toEqual(before);
    } finally {
      await f.runtime.dispose();
    }
  });
});

describe("commit cost", () => {
  /** Counts the rows D1 reads for every batch, as the daily quota does. */
  function metered(f: Fixture) {
    const meter = { rowsRead: 0 };
    const db = new Proxy(f.cloud, {
      get(target, key) {
        if (key === "batch")
          return async (
            statements: Parameters<Fixture["cloud"]["batch"]>[0],
          ) => {
            const results = await target.batch(statements);
            for (const result of results)
              meter.rowsRead += result.meta.rows_read;
            return results;
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    return { meter, db };
  }
  const membership = (setId: string, words: number, offset = 0) => ({
    type: "membership",
    recordKey: setId,
    deleted: false,
    updatedAt: new Date().toISOString(),
    payload: {
      members: Array.from({ length: words }, (_, i) => ({
        wordKey: `word-${i + offset}`,
        senseIds: [`sense-${i + offset}`],
      })),
    },
  });
  const commit = (db: Fixture["cloud"], records: unknown[]) =>
    handleCloudApi(
      new Request("http://local.invalid/sync/records", {
        method: "POST",
        body: JSON.stringify({
          origin: randomUUID(),
          operationId: randomUUID(),
          records,
        }),
      }),
      "a",
      db,
    );

  it("rewrites a large set's memberships in rows read linear to its size", async () => {
    const f = await fixture();
    try {
      const { meter, db } = metered(f);
      await commit(db, [membership("big", 1000)]);
      meter.rowsRead = 0;
      // One word leaves and one arrives: the set is rewritten in full.
      await commit(db, [membership("big", 1000, 1)]);
      expect(
        (await f.cloud
          .prepare("SELECT COUNT(*) AS n FROM cloud_memberships WHERE uid='a'")
          .first<{ n: number }>())!.n,
      ).toBe(1000);
      const keys = (
        await f.cloud
          .prepare(
            "SELECT word_key FROM cloud_memberships WHERE word_key IN ('word-0','word-1000')",
          )
          .all<{ word_key: string }>()
      ).results.map((row) => row.word_key);
      expect(keys).toEqual(["word-1000"]);
      // Matching each stored row against the whole list read ~500k rows here.
      expect(meter.rowsRead).toBeLessThan(20_000);
      meter.rowsRead = 0;
      // Every word replaced: each stored row misses the new list.
      await commit(db, [membership("big", 1000, 5000)]);
      expect(meter.rowsRead).toBeLessThan(20_000);
    } finally {
      await f.runtime.dispose();
    }
  });

  it("rewrites a batch of questions in rows read linear to the batch", async () => {
    const f = await fixture();
    try {
      const { meter, db } = metered(f);
      const questions = (word: (i: number) => string) =>
        Array.from({ length: 400 }, (_, i) => ({
          type: "question",
          recordKey: `q-${i}`,
          deleted: false,
          updatedAt: new Date().toISOString(),
          payload: { id: `q-${i}`, kind: "meaning", wordKey: word(i) },
        }));
      await commit(
        db,
        questions((i) => `word-${i}`),
      );
      meter.rowsRead = 0;
      await commit(
        db,
        questions((i) => `other-${i}`),
      );
      expect(
        (await f.cloud
          .prepare(
            "SELECT COUNT(*) AS n FROM cloud_question_sources WHERE word_key LIKE 'other-%'",
          )
          .first<{ n: number }>())!.n,
      ).toBe(400);
      expect(
        (await f.cloud
          .prepare("SELECT COUNT(*) AS n FROM cloud_question_sources")
          .first<{ n: number }>())!.n,
      ).toBe(400);
      expect(meter.rowsRead).toBeLessThan(20_000);
    } finally {
      await f.runtime.dispose();
    }
  });
});

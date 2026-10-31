import { readFile, readdir } from "node:fs/promises";
import { Miniflare } from "miniflare";
import { describe, expect, it } from "vitest";
import type { FirebaseIdentity } from "../src/auth";
import { handleAdminApi } from "../src/agent/admin";
import { guardAccount } from "../src/agent/guard";
import type { AgentEnv } from "../src/agent/types";

const NOW = Date.UTC(2026, 9, 31, 12);
const admin: FirebaseIdentity = {
  uid: "boss",
  email: "Boss@Example.com",
  emailVerified: true,
  authTime: 0,
};

type Db = Awaited<ReturnType<Miniflare["getD1Database"]>>;
async function migrate(db: Db, dir: string) {
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
          name: "admin-test",
          compatibilityDate: "2026-10-10",
          manifest: {
            mainModule: "index.js",
            modules: {
              "index.js": {
                type: "esm",
                contents: "export default {fetch(){return new Response('x')}}",
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
  const env = {
    CLOUD_DB: cloud,
    AGENT_DB: agent,
    ADMIN_EMAILS: "someone@else.com, boss@example.com",
  } as unknown as AgentEnv;
  await cloud.batch([
    cloud.prepare(
      "INSERT INTO cloud_accounts(uid,quota_day,quota_writes,stored_bytes) VALUES('busy','2026-10-31',120,5000),('quiet','2026-10-30',900,100),('idle','',0,0)",
    ),
  ]);
  await agent.batch([
    agent.prepare(
      "INSERT INTO account_reads(uid,day,rows) VALUES('busy','2026-10-31',300),('quiet','2026-10-30',999)",
    ),
  ]);
  return { runtime, env, agent };
}
const call = (
  env: AgentEnv,
  path: string,
  identity: FirebaseIdentity = admin,
  init: RequestInit = {},
) =>
  handleAdminApi(
    new Request(`http://local.invalid${path}`, init),
    env,
    identity,
    NOW,
  );

describe("admin api", () => {
  it("tells any signed-in user whether they are an administrator", async () => {
    const f = await fixture();
    try {
      const other = { ...admin, uid: "u", email: "nobody@example.com" };
      expect(await (await call(f.env, "/admin/status")).json()).toEqual({
        admin: true,
      });
      expect(
        await (await call(f.env, "/admin/status", other)).json(),
      ).toEqual({ admin: false });
    } finally {
      await f.runtime.dispose();
    }
  });

  it("refuses an administrator email that is not verified", async () => {
    const f = await fixture();
    try {
      await expect(
        call(f.env, "/admin/overview", { ...admin, emailVerified: false }),
      ).rejects.toMatchObject({ status: 403, code: "forbidden" });
    } finally {
      await f.runtime.dispose();
    }
  });

  it("counts accounts, today's activity and stored bytes", async () => {
    const f = await fixture();
    try {
      const overview = await (await call(f.env, "/admin/overview")).json();
      expect(overview).toMatchObject({
        day: "2026-10-31",
        accounts: 3,
        activeToday: 1,
        writesToday: 120,
        readsToday: 300,
        storedBytes: 5100,
        agentPaused: false,
        disabled: [],
      });
      expect(overview.top[0]).toEqual({
        uid: "busy",
        writesToday: 120,
        storedBytes: 5000,
        readsToday: 300,
        disabled: false,
      });
    } finally {
      await f.runtime.dispose();
    }
  });

  it("disables an account so the guard turns it away, then enables it again", async () => {
    const f = await fixture();
    try {
      await call(f.env, "/admin/accounts/busy/disabled", admin, {
        method: "PUT",
        body: JSON.stringify({ reason: "abuse" }),
      });
      await expect(guardAccount(f.env, "busy", { now: NOW })).rejects.toMatchObject(
        { status: 403, code: "account_disabled" },
      );
      const overview = await (await call(f.env, "/admin/overview")).json();
      expect(overview.disabled).toEqual([
        { uid: "busy", reason: "abuse", disabledAt: NOW },
      ]);
      expect(overview.top[0].disabled).toBe(true);
      await call(f.env, "/admin/accounts/busy/disabled", admin, {
        method: "DELETE",
      });
      await expect(
        guardAccount(f.env, "busy", { now: NOW }),
      ).resolves.toBeUndefined();
    } finally {
      await f.runtime.dispose();
    }
  });

  it("does not let an administrator disable their own account", async () => {
    const f = await fixture();
    try {
      await expect(
        call(f.env, "/admin/accounts/boss/disabled", admin, { method: "PUT" }),
      ).rejects.toMatchObject({ status: 400, code: "cannot_disable_self" });
    } finally {
      await f.runtime.dispose();
    }
  });

  it("rejects a uid that could carry anything but letters and digits", async () => {
    const f = await fixture();
    try {
      await expect(
        call(f.env, "/admin/accounts/a'b/disabled", admin, { method: "PUT" }),
      ).rejects.toMatchObject({ status: 400, code: "invalid_uid" });
    } finally {
      await f.runtime.dispose();
    }
  });
});

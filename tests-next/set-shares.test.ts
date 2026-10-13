import { readFile, readdir } from "node:fs/promises";
import { Miniflare } from "miniflare";
import { describe, expect, it } from "vitest";
import { createAgentSet } from "@lexiro/agent-contract";
import { D1AgentLibrary } from "../src/agent/library-repository";
import { handleShareApi } from "../src/cloud/shares";
import type { AgentEnv } from "../src/agent/types";

const A = "11111111-1111-4111-8111-111111111111";

async function fixture() {
  const runtime = new Miniflare({
    workers: [
      {
        config: {
          name: "set-shares-test",
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
          env: { CLOUD_DB: { type: "d1" } },
        },
      },
    ],
  });
  const db = await runtime.getD1Database("CLOUD_DB");
  for (const file of (
    await readdir(new URL("../library-migrations/", import.meta.url))
  )
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    const sql = await readFile(
      new URL(`../library-migrations/${file}`, import.meta.url),
      "utf8",
    );
    await db.batch(
      sql
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => db.prepare(s)),
    );
  }
  const repo = new D1AgentLibrary({ CLOUD_DB: db } as unknown as AgentEnv);
  await repo.create("owner", createAgentSet(A, "合成 A"));
  const call = async (uid: string, method: string, path: string, body?: unknown) => {
    try {
      const response = await handleShareApi(
        new Request(`http://local.invalid${path}`, {
          method,
          body: body === undefined ? undefined : JSON.stringify(body),
        }),
        uid,
        db as never,
        repo,
      );
      return { status: response.status, body: (await response.json()) as Record<string, unknown> };
    } catch (reason) {
      return { status: (reason as { status?: number }).status ?? 500, body: { code: (reason as { code?: string }).code } };
    }
  };
  return { runtime, repo, call };
}

describe("set share links", () => {
  it("hands out one stable link per set that any signed-in reader can open", async () => {
    const f = await fixture();
    try {
      const created = await f.call("owner", "POST", "/shares", { setId: A });
      expect(created.status).toBe(201);
      const id = created.body.id as string;
      expect(id).toMatch(/^[A-Za-z0-9_-]{22}$/);
      expect((await f.call("owner", "POST", "/shares", { setId: A })).body.id).toBe(id);

      const read = await f.call("reader", "GET", `/shares/${id}`);
      expect(read.status).toBe(200);
      expect(read.body.own).toBe(false);
      expect(read.body.snapshot).toMatchObject({ set: { id: A, setName: "合成 A" } });
      expect((await f.call("owner", "GET", `/shares/${id}`)).body.own).toBe(true);
      expect((await f.call("owner", "GET", "/shares")).body.shares).toEqual([
        expect.objectContaining({ id, setId: A }),
      ]);
    } finally {
      await f.runtime.dispose();
    }
  });

  it("serves the owner's latest copy and stops once the link or the set is gone", async () => {
    const f = await fixture();
    try {
      const id = (await f.call("owner", "POST", "/shares", { setId: A })).body.id as string;
      await f.repo.mutate("owner", A, undefined, crypto.randomUUID(), { rename: true }, (snapshot) => ({
        snapshot: { ...snapshot, set: { ...snapshot.set, setName: "改名後" } },
        validation: {},
      }) as never);
      expect((await f.call("reader", "GET", `/shares/${id}`)).body.snapshot).toMatchObject({
        set: { setName: "改名後" },
      });
      expect((await f.call("reader", "DELETE", `/shares/${id}`)).status).toBe(404);
      expect((await f.call("owner", "DELETE", `/shares/${id}`)).status).toBe(200);
      expect(await f.call("reader", "GET", `/shares/${id}`)).toEqual({
        status: 404,
        body: { code: "share_unavailable" },
      });
      expect((await f.call("someone", "POST", "/shares", { setId: A })).status).toBe(404);
    } finally {
      await f.runtime.dispose();
    }
  });
});

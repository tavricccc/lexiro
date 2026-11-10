import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Miniflare } from "miniflare";
import { describe, expect, it } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { handleCloudApi } from "../src/cloud/api";
import { LEARNING_MAX_DEVICES } from "../src/cloud/learning";

async function fixture() {
  const runtime = new Miniflare({
    workers: [{ config: { name: "learning-test", compatibilityDate: "2026-10-10", manifest: { mainModule: "index.js", modules: { "index.js": { type: "esm", contents: "export default {fetch(){return new Response('x')}}" } } }, env: { CLOUD_DB: { type: "d1" } } } }],
  });
  const db = (await runtime.getD1Database("CLOUD_DB")) as unknown as D1Database;
  for (const file of (await readdir(new URL("../library-migrations/", import.meta.url))).filter(f => f.endsWith(".sql")).sort()) {
    const sql = await readFile(new URL(`../library-migrations/${file}`, import.meta.url), "utf8");
    await db.batch(sql.split(";").map(s => s.trim()).filter(Boolean).map(s => db.prepare(s)));
  }
  return { runtime, db };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
const record = (answered = 3) => ({ version: 1, goal: 20, goalUpdatedAt: "2026-11-01T00:00:00.000Z", days: { "2026-11-01": { answered, correct: 1 } }, kinds: { meaning: { answered, correct: 1 } }, senses: { s1: { answered, correct: 1, wordKey: "set:w", level: 2, lastDay: "2026-11-01" } } });
const post = (f: Fixture, body: unknown, uid = "a") =>
  handleCloudApi(new Request("http://local.invalid/sync/learning", { method: "POST", body: JSON.stringify(body) }), uid, f.db);
const get = async (f: Fixture, uid = "a") =>
  (await (await handleCloudApi(new Request("http://local.invalid/sync/learning"), uid, f.db)).json()) as { devices: { deviceId: string; record: unknown }[] };
async function rejection(promise: Promise<unknown>) {
  try { await promise; } catch (reason) { return reason as { status: number; code: string }; }
  throw new Error("expected rejection");
}

describe("cloud learning records", () => {
  it("returns every device's record of the account", async () => {
    const f = await fixture();
    try {
      const [one, two] = [randomUUID(), randomUUID()];
      await post(f, { deviceId: one, record: record(3) });
      await post(f, { deviceId: two, record: record(5) });
      const devices = (await get(f)).devices.map(d => d.deviceId).sort();
      expect(devices).toEqual([one, two].sort());
    } finally { await f.runtime.dispose(); }
  });
  it("replaces the same device's record instead of adding one", async () => {
    const f = await fixture();
    try {
      const id = randomUUID();
      await post(f, { deviceId: id, record: record(3) });
      await post(f, { deviceId: id, record: record(7) });
      expect((await get(f)).devices).toEqual([{ deviceId: id, record: record(7) }]);
    } finally { await f.runtime.dispose(); }
  });
  it("keeps other accounts' records out", async () => {
    const f = await fixture();
    try {
      await post(f, { deviceId: randomUUID(), record: record() }, "b");
      expect((await get(f)).devices).toEqual([]);
    } finally { await f.runtime.dispose(); }
  });
  it("rejects a sense whose correct count exceeds its answers", async () => {
    const f = await fixture();
    try {
      const bad = { ...record(), senses: { s1: { answered: 1, correct: 2, wordKey: "w", level: 1, lastDay: "2026-11-01" } } };
      expect((await rejection(post(f, { deviceId: randomUUID(), record: bad }))).code).toBe("invalid_content");
    } finally { await f.runtime.dispose(); }
  });
  it("rejects a record larger than the size limit", async () => {
    const f = await fixture();
    try {
      const senses = Object.fromEntries(Array.from({ length: 4000 }, (_, i) => [`sense-${i}-${"x".repeat(40)}`, { answered: 1, correct: 1, wordKey: "w".repeat(20), level: 1, lastDay: "2026-11-01" }]));
      expect((await rejection(post(f, { deviceId: randomUUID(), record: { ...record(), senses } }))).code).toBe("input_limit");
    } finally { await f.runtime.dispose(); }
  });
  it("drops the least recently written device past the device limit", async () => {
    const f = await fixture();
    try {
      const first = randomUUID();
      await post(f, { deviceId: first, record: record() });
      await f.db.prepare("UPDATE cloud_learning SET updated_at=0 WHERE device_id=?").bind(first).run();
      for (let i = 0; i < LEARNING_MAX_DEVICES; i++) await post(f, { deviceId: randomUUID(), record: record() });
      const devices = (await get(f)).devices.map(d => d.deviceId);
      expect(devices).toHaveLength(LEARNING_MAX_DEVICES);
      expect(devices).not.toContain(first);
    } finally { await f.runtime.dispose(); }
  });
});

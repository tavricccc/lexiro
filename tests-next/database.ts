import { readFile, readdir } from "node:fs/promises";
import { Miniflare } from "miniflare";
export async function testDatabase(lastMigration?: string) {
  const runtime = new Miniflare({ workers: [{ config: {
    name: "billing-test", compatibilityDate: "2026-09-12",
    manifest: { mainModule: "index.js", modules: { "index.js": { type: "esm", contents: "export default {fetch(){return new Response('local test')}}" } } },
    env: { DB: { type: "d1" } },
  } }] });
  const db = await runtime.getD1Database("DB");
  for (const file of (await readdir(new URL("../migrations/", import.meta.url))).filter((file) => file.endsWith(".sql") && (lastMigration === undefined || file <= lastMigration)).sort()) {
    const migration = await readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8");
    await db.batch(migration.split(";").map((sql) => sql.trim()).filter(Boolean).map((sql) => db.prepare(sql)));
  }
  await db.prepare("INSERT INTO accounts(uid,email,points,monthly,renews_at,updated_at) VALUES('u','u@example.test',100,1000,?,'now')").bind(Math.floor(Date.now()/1000)+86400).run();
  return { runtime, db };
}

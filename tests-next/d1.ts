import { readFile, readdir } from "node:fs/promises";
import { Miniflare } from "miniflare";
import type { D1Database } from "@cloudflare/workers-types";

/** A local D1 with every library migration applied. Dispose the runtime after use. */
export async function libraryDb() {
  const runtime = new Miniflare({
    workers: [{
      config: {
        name: "library-test",
        compatibilityDate: "2026-10-10",
        manifest: { mainModule: "index.js", modules: { "index.js": { type: "esm", contents: "export default { fetch() { return new Response('x') } }" } } },
        env: { CLOUD_DB: { type: "d1" } },
      },
    }],
  });
  const db = (await runtime.getD1Database("CLOUD_DB")) as unknown as D1Database;
  await migrate(db, "library-migrations");
  return { runtime, db };
}

/** Applies every migration in `dir`, statement by statement, comments removed. */
export async function migrate(db: Pick<D1Database, "batch" | "prepare">, dir: string) {
  const folder = new URL(`../${dir}/`, import.meta.url);
  for (const file of (await readdir(folder)).filter((name) => name.endsWith(".sql")).sort()) {
    const sql = (await readFile(new URL(file, folder), "utf8")).replace(/^\s*--.*$/gm, "");
    const statements = sql.split(/;\s*$/m).map((part) => part.trim()).filter(Boolean);
    if (statements.length) await db.batch(statements.map((statement) => db.prepare(statement)));
  }
}

/** The thrown value of a rejected promise; fails when it resolves. */
export async function rejection(promise: Promise<unknown>): Promise<{ status: number; code: string; message: string }> {
  try { await promise; } catch (reason) { return reason as { status: number; code: string; message: string }; }
  throw new Error("expected a rejection");
}

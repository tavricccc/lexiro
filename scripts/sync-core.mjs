#!/usr/bin/env node
/**
 * Copies the web app's platform-free contract and domain logic into src/core so
 * the app and web share one source of truth for schemas, question formats,
 * practice dealing, round state, custom grading, rooms, and bulk parsing.
 *
 *   node scripts/sync-core.mjs [path/to/lexiro]   (default ../lexiro)
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const app = join(dirname(fileURLToPath(import.meta.url)), "..");
const web = process.argv[2] ?? join(app, "..", "lexiro");
const core = join(app, "src", "core");

const SOURCES = [
  ["packages/contract/src", "contract"],
  ["src/domain", "domain"],
];

const REWRITES = [
  [/(["'])@lexiro\/contract\1/g, "$1@/core/contract$1"],
];

const HEADER = "// Synced from the lexiro web repo by scripts/sync-core.mjs; edit there, not here.\n";

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

// Clear previous core so obsolete v1 files are removed cleanly.
if (existsSync(core)) rmSync(core, { recursive: true, force: true });

let count = 0;
for (const [from, to] of SOURCES) {
  const root = join(web, from);
  for (const file of walk(root)) {
    const rel = relative(root, file).replace(/\\/g, "/");
    if (!/\.ts$/.test(rel) || /\.test\.ts$|\.d\.ts$/.test(rel)) continue;
    let source = readFileSync(file, "utf8");
    for (const [pattern, replacement] of REWRITES) source = source.replace(pattern, replacement);
    const out = join(core, to, rel);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, HEADER + source);
    count += 1;
  }
}

console.log(`synced ${count} files into src/core`);

import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

// Fingerprints of fixed private instruction sentences, never the instructions themselves.
const protectedSentences = new Set([
  "0052fcd17e564bf25d2474d8f7628f7a0e796878acbecb456af6b9040605711f",
  "44c8cd1fc37c83ae1172a0c1d393896604f7c1fc87f64a655b82007f64c41109",
  "9bc46d2c8517256f5ff034fe2e9a8ba1bd020f2fb2fb4181068c80a9fcd05099",
  "dc8420fbd453ac2108cd7f22611b24a1cabd08bbf7583c20c1546151f41698a2",
]);
const hash = (value) => createHash("sha256").update(value).digest("hex");
function decode(value) {
  return value.replace(/\\(?:u\{([0-9a-f]+)\}|u([0-9a-f]{4})|x([0-9a-f]{2})|([\s\S]))/gi, (_, point, unicode, byte, character) => {
    if (point || unicode || byte) return String.fromCodePoint(parseInt(point || unicode || byte, 16));
    return ({ n: "\n", r: "\r", t: "\t" })[character] ?? character;
  });
}
function leaks(source, fingerprints) {
  const literals = source.match(/"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|`(?:\\[\s\S]|[^`\\])*`/g) ?? [];
  return literals.some((literal) => decode(literal.slice(1, -1)).split(/[。！？\r\n]/u).some((part) => fingerprints.has(hash(part.trim()))));
}

// Check the guard against synthetic literal encodings, without placing a private prompt here.
const probe = "檢查用的固定句子";
const probeHashes = new Set([hash(probe)]);
for (const source of [JSON.stringify(`${probe}。下一句`), `"${[...probe].map((c) => `\\u${c.charCodeAt(0).toString(16)}`).join("")}\\nnext"`]) {
  if (!leaks(source, probeHashes)) throw new Error("Client boundary guard self-check failed");
}
if (leaks('"ordinary application copy"', probeHashes)) throw new Error("Client boundary guard false positive");

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...await files(path));
    else if (/\.(?:js|mjs|json|map|css)$/.test(entry.name)) paths.push(path);
  }
  return paths;
}
const paths = await files(resolve(import.meta.dirname, "../.next/static"));
if (!paths.length) throw new Error("No built client assets to check");
const found = [];
for (const path of paths) if (leaks(await readFile(path, "utf8"), protectedSentences)) found.push(path);
if (found.length) throw new Error(`Private instructions found in client assets:\n${found.join("\n")}`);
process.stdout.write(`Client boundary check passed (${paths.length} assets).\n`);

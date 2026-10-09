import { readdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { digest } from "./artifacts.mjs";

export async function loadPhotos(config, limits) {
  const { selected, values, frontend } = config;
  if (!selected.has("photos")) return { paths: [], encoded: [], manifest: [] };
  const directory = resolve(values["images-dir"]);
  const names = (await readdir(directory)).filter((name) => /\.jpe?g$/i.test(name)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (names.length !== 5) throw new Error(`Expected five source JPG files, found ${names.length}.`);
  const sharp = createRequire(join(frontend, "package.json"))("sharp");
  const paths = [], encoded = [], manifest = [];
  for (const name of names) {
    const path = join(directory, name);
    const bytes = await readFile(path);
    const metadata = await sharp(bytes).metadata();
    let webp;
    for (const quality of [85, 70, 55, 40]) {
      webp = await sharp(bytes).rotate().flatten({ background: "#fff" }).resize({ width: limits.imageEdge, height: limits.imageEdge, fit: "inside", withoutEnlargement: true }).webp({ quality }).toBuffer();
      if (webp.length <= limits.imageBytes) break;
    }
    if (webp.length > limits.imageBytes) throw new Error(`${name} exceeds the production photo byte limit.`);
    paths.push(path); encoded.push(webp.toString("base64"));
    manifest.push({ name, sourcePath: path, sourceSha256: digest(bytes), width: metadata.width, height: metadata.height, webpSha256: digest(webp), webpBytes: webp.length });
  }
  return { paths, encoded, manifest };
}

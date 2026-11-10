// Serves the repository as static files so the design preview can load the app's own fonts.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const port = Number(process.env.PORT ?? 4174);
const types = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ttf": "font/ttf",
  ".woff2": "font/woff2", ".woff": "font/woff", ".json": "application/json",
};

createServer(async (request, response) => {
  let path = decodeURIComponent(new URL(request.url, "http://x").pathname);
  if (path === "/") return response.writeHead(302, { location: "/design/preview/" }).end();
  if (path.endsWith("/")) path += "index.html";
  const file = normalize(join(root, path));
  if (!file.startsWith(root)) return response.writeHead(403).end();
  try {
    const body = await readFile(file);
    response.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
    response.end(body);
  } catch {
    response.writeHead(404).end("not found");
  }
}).listen(port, () => console.log(`design preview: http://localhost:${port}/`));

// Screenshots a page with the installed Edge, headless: node design/preview/shot.mjs <url> <out.png> [width] [height]
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const [url, out, width = "1440", height = "900"] = process.argv.slice(2);
const edge = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe"].find(existsSync);
if (!edge || !url || !out) { console.error("usage: shot.mjs <url> <out.png> [width] [height]"); process.exit(1); }
const result = spawnSync(edge, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--force-device-scale-factor=1",
  `--window-size=${width},${height}`, "--virtual-time-budget=4000", `--screenshot=${resolve(out)}`, url,
], { stdio: "ignore", timeout: 60000 });
process.exit(existsSync(resolve(out)) ? 0 : (result.status ?? 1));

// Captures every preview screen at a desktop and a phone size: node design/preview/shots.mjs [screen ...]
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const base = process.env.PREVIEW_URL ?? "http://localhost:4174/design/preview/";
const out = fileURLToPath(new URL("../shots/", import.meta.url));
const shot = fileURLToPath(new URL("./shot.mjs", import.meta.url));
// A name may carry a state, as in "home?sheet=setup"; the file is named after it.
const all = ["home?sheet=setup", "home?sheet=me", "home?sheet=me&nav=study", "practice?answer=0", "practice?answer=1", "set?tab=questions", "library?menu=add", "home?scheme=dark", "set?scheme=dark", "practice?scheme=dark&answer=0", "progress?scheme=dark", "home", "library", "set", "word", "practice", "cloze", "result", "progress", "rooms", "room", "duel", "new", "empty"];
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : all;
mkdirSync(out, { recursive: true });
for (const name of wanted) {
  for (const [tag, url, width, height] of [["d", `${base}#/${name}`, 1440, 1000], ["m", `${base}frame.html?w=390&h=844#/${name}`, 500, 844]]) {
    spawnSync(process.execPath, [shot, url, `${out}${name.replace(/[?&=]+/g, "_")}-${tag}.png`, String(width), String(height)], { stdio: "inherit" });
  }
}

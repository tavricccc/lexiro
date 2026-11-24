// CI only: writes the release version into package.json. Major and minor are
// kept by hand there; the patch is the number of commits, so every push to main
// gets the next one with no commit back to the repo. Needs the full history
// (`fetch-depth: 0`).
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
if (git("rev-parse", "--is-shallow-repository") === "true") {
  throw new Error("set-version needs the full git history (fetch-depth: 0)");
}
const file = new URL("../package.json", import.meta.url);
const pkg = JSON.parse(readFileSync(file, "utf8"));
const [major, minor] = pkg.version.split(".");
pkg.version = `${major}.${minor}.${git("rev-list", "--count", "HEAD")}`;
writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
console.log(pkg.version);

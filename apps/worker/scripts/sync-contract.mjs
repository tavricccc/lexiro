// Copies the shared contract from apps/web into src/contract.
// Run after changing ../web/packages/contract; the copy is checked in.
import { cp, rm } from "node:fs/promises";
const from = new URL("../../web/packages/contract/src/", import.meta.url);
const to = new URL("../src/contract/", import.meta.url);
await rm(to, { recursive: true, force: true });
await cp(from, to, { recursive: true });
console.log("contract synced");

// Copies the shared contract from the lexiro repo into src/contract.
// Run after changing ../lexiro/packages/contract; the copy is checked in.
import { cp, rm } from "node:fs/promises";
const from = new URL("../../lexiro/packages/contract/src/", import.meta.url);
const to = new URL("../src/contract/", import.meta.url);
await rm(to, { recursive: true, force: true });
await cp(from, to, { recursive: true });
console.log("contract synced");

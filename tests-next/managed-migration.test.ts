import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadSyncJournal, resetSyncJournalCache } from "@/src/lib/sync-journal";
import { setStorageNamespace } from "@/src/lib/persist";

const storage = vi.hoisted(() => new Map<string, string>());
vi.mock("idb-keyval", () => ({ get: async (key: string) => storage.get(key), set: async (key: string, value: string) => { storage.set(key, value); }, del: async (key: string) => { storage.delete(key); } }));
beforeEach(() => { storage.clear(); resetSyncJournalCache(); setStorageNamespace("a"); });
describe("managed settings migration", () => {
  it("preserves queued edits and deletions while retiring only this account's AI settings", async () => {
    const previous = { schemaVersion: 2, cursor: "cursor", seeded: true, version: 7, dirty: { "set:one": { kind: "set", id: "one", version: 6 } }, tombstones: { "set:two": { kind: "set", id: "two", version: 7, deletedAt: "2026-09-12" } }, blobs: { aiSettings: 5, progress: 4, stats: 3 } };
    storage.set("a:lexiro_sync_journal", JSON.stringify(previous));
    storage.set("a:lexiro_ai_settings", "old");
    storage.set("a:lexiro_ai_api_key", "secret");
    storage.set("b:lexiro_ai_api_key", "other");
    const journal = await loadSyncJournal();
    expect(journal).toEqual({ ...previous, schemaVersion: 3, blobs: { progress: 4, stats: 3 } });
    expect(storage.has("a:lexiro_ai_settings")).toBe(false);
    expect(storage.has("a:lexiro_ai_api_key")).toBe(false);
    expect(storage.get("b:lexiro_ai_api_key")).toBe("other");
    expect(JSON.parse(storage.get("a:lexiro_sync_journal")!)).toEqual(journal);
    resetSyncJournalCache();
    expect(await loadSyncJournal()).toEqual(journal);
  });
});

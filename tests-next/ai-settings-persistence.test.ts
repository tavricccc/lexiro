import { beforeEach, describe, expect, it, vi } from "vitest";

/** In-memory stand-in for IndexedDB: jsdom has no indexedDB implementation. */
const store = new Map<string, unknown>();

vi.mock("idb-keyval", () => ({
  get: async (key: string) => store.get(key),
  set: async (key: string, value: unknown) => void store.set(key, value),
}));

const {
  applyRemoteAiSettings,
  defaultAiSettings,
  getShareableAiSettings,
  loadAiSettings,
  reloadAiSettings,
  saveAiSettings,
  waitForAiSettingsPersistence,
} = await import("@/src/lib/ai/settings");
const { setStorageNamespace } = await import("@/src/lib/persist");
const { loadSyncJournal, resetSyncJournalCache } = await import(
  "@/src/lib/sync-journal"
);

async function enterNamespace(namespace: string) {
  setStorageNamespace(namespace);
  resetSyncJournalCache();
  await reloadAiSettings();
}

beforeEach(() => {
  store.clear();
  resetSyncJournalCache();
});

describe("AI settings persistence", () => {
  it("keeps each account's setup, and its API key, to that account", async () => {
    await enterNamespace("alice");
    saveAiSettings({
      ...defaultAiSettings,
      enabled: true,
      apiKey: "alice-key",
      model: "gpt-5",
    });
    await waitForAiSettingsPersistence();

    await enterNamespace("bob");
    expect(loadAiSettings().model).toBe(defaultAiSettings.model);
    expect(loadAiSettings().apiKey).toBe("");

    // Reading before the namespace was chosen is what used to happen on every
    // start: the account's own settings were still on disk, and the defaults
    // read from the guest namespace were autosaved straight over them.
    await enterNamespace("alice");
    expect(loadAiSettings().model).toBe("gpt-5");
    expect(loadAiSettings().apiKey).toBe("alice-key");
  });

  it("marks a local change for the cloud and a pulled one as already there", async () => {
    await enterNamespace("alice");
    saveAiSettings({ ...defaultAiSettings, enabled: true, apiKey: "key" });
    await waitForAiSettingsPersistence();
    expect((await loadSyncJournal()).blobs.aiSettings).toBeGreaterThan(0);

    await enterNamespace("carol");
    applyRemoteAiSettings({
      ...getShareableAiSettings(defaultAiSettings),
      enabled: true,
      batchSize: 12,
    });
    await waitForAiSettingsPersistence();
    expect(loadAiSettings().batchSize).toBe(12);
    expect((await loadSyncJournal()).blobs.aiSettings).toBe(0);
  });

  it("drops the local API key when the setup that arrived points somewhere else", async () => {
    await enterNamespace("alice");
    saveAiSettings({
      ...defaultAiSettings,
      enabled: true,
      apiKey: "openai-key",
    });
    await waitForAiSettingsPersistence();

    applyRemoteAiSettings({
      ...getShareableAiSettings(defaultAiSettings),
      provider: "anthropic",
      model: "claude-opus-4-5",
    });
    expect(loadAiSettings().apiKey).toBe("");
  });
});

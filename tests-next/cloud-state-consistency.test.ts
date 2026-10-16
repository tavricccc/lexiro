import type { User } from "firebase/auth";
import type { SyncJournal } from "@/src/lib/sync-journal";
import type { LibraryCommitStats } from "@/src/lib/library-repository";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { emptyLibraryState } from "@/src/lib/library-repository";
import { getStorageNamespace, setStorageNamespace } from "@/src/lib/persist";
const mocks = vi.hoisted(() => ({
  pull: vi.fn(),
  commit: vi.fn(),
  cursor: vi.fn(),
  seeded: vi.fn(),
  clear: vi.fn(),
  auth: vi.fn(),
  blobs: vi.fn(),
  push: vi.fn(),
  write: vi.fn(),
  journal: null as SyncJournal | null,
}));
vi.mock("idb-keyval", () => ({
  get: async () => undefined,
  set: async () => {},
  del: async () => {},
}));
vi.mock("@/src/lib/firebase-config", () => ({
  isFirebaseConfigured: () => false,
}));
vi.mock("@/src/lib/firebase", () => ({
  configureFirebaseAuth: mocks.auth,
}));
vi.mock("@/src/lib/cloud-client", () => ({
  accountNamespace: (uid: string) => `d1-v1:${uid}`,
  getCloudClient: () => ({
    uid: useCloudStore.getState().user?.uid,
    blobRevision: 0,
    request: vi.fn(),
  }),
}));
vi.mock("@/src/lib/library-repository", async (original) => ({
  ...(await original<typeof import("@/src/lib/library-repository")>()),
  getLibraryRepository: () => ({
    commit: mocks.commit,
    loadState: async () => emptyLibraryState(),
    scopeMigrationIntent: async () => null,
  }),
}));
vi.mock("@/src/lib/sync-journal", async (original) => ({
  ...(await original<typeof import("@/src/lib/sync-journal")>()),
  loadSyncJournal: async () => mocks.journal!,
  recordLocalChanges: async (changed: LibraryCommitStats["changed"]) => {
    for (const ref of changed)
      mocks.journal!.dirty[`${ref.kind}:${ref.id}`] = { ...ref, version: 1 };
  },
  untrackChanges: async () => {},
  clearBlobDirty: async () => {},
  clearPushedRecords: mocks.clear,
  setSyncCursor: mocks.cursor,
  markSeeded: mocks.seeded,
  resetSyncJournalCache: () => {},
}));
vi.mock("@/src/lib/cloud-sync", async (original) => ({
  ...(await original<typeof import("@/src/lib/cloud-sync")>()),
  pullRecords: mocks.pull,
  pushRecords: mocks.push,
}));
vi.mock("@/src/lib/cloud-account", async (original) => ({
  ...(await original<typeof import("@/src/lib/cloud-account")>()),
  readCloudBlobs: mocks.blobs,
  writeCloudBlob: mocks.write,
}));
const { useCloudStore } = await import("@/stores/cloud-store");
const { useLibraryStore } = await import("@/stores/library-store");
const { useAiPreferencesStore } = await import("@/stores/ai-preferences-store");
const noChange: LibraryCommitStats = {
  writtenBlobs: 0,
  totalRecords: 0,
  collectedKeys: 0,
  changed: [],
  removed: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  setStorageNamespace("d1-v1:account-a");
  mocks.journal = {
    schemaVersion: 5,
    version: 0,
    seeded: true,
    cursor: "before",
    dirty: {},
    tombstones: {},
    legacyPendingRefs: {},
    blobs: { preferences: 0, practice: 0 },
  };
  mocks.commit.mockResolvedValue(noChange);
  mocks.auth.mockResolvedValue(null);
  mocks.push.mockResolvedValue(undefined);
  mocks.blobs.mockResolvedValue({ preferences: null, practice: null });
  mocks.write.mockResolvedValue(undefined);
  mocks.pull.mockResolvedValue({ records: [], cursor: "after" });
  useLibraryStore.setState({ state: emptyLibraryState(), status: "ready" });
  useCloudStore.setState({
    ready: true,
    user: { uid: "account-a" } as User,
    error: "",
    pending: 0,
  });
});
afterEach(() => {
  localStorage.clear();
  setStorageNamespace("d1-v1:guest");
});

describe("synchronization state consistency", () => {
  it("does not pull with the preceding account's namespace during sign-in", async () => {
    useCloudStore.setState({
      ready: false,
      user: { uid: "account-b" } as User,
    });
    await useCloudStore.getState().sync();
    expect(mocks.pull).not.toHaveBeenCalled();
    expect(mocks.cursor).not.toHaveBeenCalled();
  });
  it("discards account documents when a different sign-in starts before the read completes", async () => {
    let finishRead!: () => void;
    mocks.blobs.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRead = () =>
            resolve({
              preferences: {
                schemaVersion: 1,
                model: "gpt-6-luna",
                updatedAt: "2026-10-01T00:00:00.000Z",
              },
            });
        }),
    );
    const synced = useCloudStore.getState().sync({ reconcileAccount: true });
    await vi.waitFor(() => expect(mocks.blobs).toHaveBeenCalledOnce());
    const apply = vi.spyOn(useAiPreferencesStore.getState(), "applyRemote");
    useCloudStore.setState({
      ready: false,
      user: { uid: "account-b" } as User,
    });
    finishRead();
    await synced;
    expect(apply).not.toHaveBeenCalled();
    apply.mockRestore();
  });
  it("preserves a local rename that was saving when the remote tombstone arrived", async () => {
    const folder = await useLibraryStore.getState().createFolder("原名");
    let finishWrite!: () => void;
    mocks.commit.mockImplementationOnce(
      () =>
        new Promise<LibraryCommitStats>((resolve) => {
          finishWrite = () =>
            resolve({
              ...noChange,
              changed: [{ kind: "folder", id: folder.id }],
              removed: [],
            });
        }),
    );
    const renamed = useLibraryStore
      .getState()
      .renameFolder(folder.id, "新名字");
    mocks.pull.mockResolvedValueOnce({
      records: [
        {
          type: "folder",
          recordKey: folder.id,
          deleted: true,
          updatedAt: "2026-10-02T00:00:00.000Z",
          payload: null,
        },
      ],
      cursor: "after",
    });
    const synced = useCloudStore.getState().sync();
    await vi.waitFor(() => expect(mocks.pull).toHaveBeenCalledOnce());
    finishWrite();
    await renamed;
    await synced;
    expect(
      useLibraryStore
        .getState()
        .state.folders.find((entry) => entry.id === folder.id)?.name,
    ).toBe("新名字");
    expect(
      mocks.commit.mock.lastCall![0].folders.some(
        (entry: { name: string }) => entry.name === "新名字",
      ),
    ).toBe(true);
  });
  it("finishes a namespace change before rejecting an old sync's cursor and completion writes", async () => {
    let finishWrite!: () => void;
    mocks.commit.mockImplementationOnce(
      () =>
        new Promise<LibraryCommitStats>((resolve) => {
          finishWrite = () => resolve(noChange);
        }),
    );
    mocks.pull.mockResolvedValueOnce({
      records: [
        {
          type: "folder",
          recordKey: "remote",
          deleted: true,
          updatedAt: "2026-10-02T00:00:00.000Z",
          payload: null,
        },
      ],
      cursor: "after",
    });
    const synced = useCloudStore.getState().sync();
    await vi.waitFor(() => expect(mocks.commit).toHaveBeenCalledOnce());
    const signedOut = useCloudStore.getState().signOut();
    await vi.waitFor(() => expect(mocks.auth).toHaveBeenCalledOnce());
    expect(getStorageNamespace()).toBe("d1-v1:account-a");
    finishWrite();
    await signedOut;
    await synced;
    expect(getStorageNamespace()).toBe("d1-v1:guest");
    expect(mocks.cursor).not.toHaveBeenCalled();
    expect(mocks.seeded).not.toHaveBeenCalled();
    expect(mocks.clear).not.toHaveBeenCalled();
  });
});

describe("practice session across devices", () => {
  const key = "d1-v1:account-a:lexiro-practice-session-v3";
  const EARLIER = "2026-10-01T00:00:00.000Z";
  const LATER = "2026-10-02T00:00:00.000Z";
  const practiceWrites = () =>
    mocks.write.mock.calls.filter((call) => call[2] === "practice");

  it("adopts a newer session from another device without sending it back", async () => {
    localStorage.setItem(key, JSON.stringify({ index: 1 }));
    localStorage.setItem(`${key}:updated-at`, EARLIER);
    mocks.blobs.mockResolvedValue({
      preferences: null,
      practice: { updatedAt: LATER, snapshot: { index: 4 } },
    });
    const arrived = vi.fn();
    window.addEventListener("lexiro:practice-draft-remote", arrived);
    await useCloudStore.getState().sync({ reconcileAccount: true });
    window.removeEventListener("lexiro:practice-draft-remote", arrived);
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual({ index: 4 });
    expect(arrived).toHaveBeenCalledOnce();
    expect(practiceWrites()).toEqual([]);
  });

  it("sends this device's newer session when it changed since the last sync", async () => {
    localStorage.setItem(key, JSON.stringify({ index: 6 }));
    localStorage.setItem(`${key}:updated-at`, LATER);
    mocks.journal!.blobs.practice = 3;
    mocks.blobs.mockResolvedValue({
      preferences: null,
      practice: { updatedAt: EARLIER, snapshot: { index: 4 } },
    });
    await useCloudStore.getState().sync();
    expect(practiceWrites()).toEqual([
      [
        expect.anything(),
        "account-a",
        "practice",
        { updatedAt: LATER, snapshot: { index: 6 } },
      ],
    ]);
  });

  it("drops the local draft once another device finished the session", async () => {
    localStorage.setItem(key, JSON.stringify({ index: 2 }));
    localStorage.setItem(`${key}:updated-at`, EARLIER);
    mocks.blobs.mockResolvedValue({
      preferences: null,
      practice: { updatedAt: LATER, snapshot: null },
    });
    await useCloudStore.getState().sync({ reconcileAccount: true });
    expect(localStorage.getItem(key)).toBeNull();
    expect(practiceWrites()).toEqual([]);
  });
});

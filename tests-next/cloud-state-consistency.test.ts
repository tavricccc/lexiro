import type { User } from "firebase/auth";
import type {
  PendingLibraryRefRemap,
  SyncJournal,
} from "@/src/lib/sync-journal";
import type { LibraryCommitStats } from "@/src/lib/library-repository";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { emptyLibraryState } from "@/src/lib/library-repository";
import { createDefaultStats } from "@/src/lib/learning-defaults";
import { getStorageNamespace, setStorageNamespace } from "@/src/lib/persist";
import { allLibraryRefs, recordForRef } from "@/src/lib/cloud-records";
import {
  buildSenseId,
  buildSetWordKey,
  canonicalizeQuestion,
} from "@/src/lib/library";
import { canonicalHash } from "@/src/lib/hash";

const mocks = vi.hoisted(() => ({
  pull: vi.fn(),
  commit: vi.fn(),
  cursor: vi.fn(),
  seeded: vi.fn(),
  clear: vi.fn(),
  auth: vi.fn(),
  blobs: vi.fn(),
  isolation: vi.fn(),
  remap: vi.fn(),
  push: vi.fn(),
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
  getFirebaseFirestore: () => ({}),
  configureFirebaseAuth: mocks.auth,
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
  remapPendingLibraryRefs: mocks.remap,
}));
vi.mock("@/src/lib/cloud-sync", async (original) => ({
  ...(await original<typeof import("@/src/lib/cloud-sync")>()),
  pullRecords: mocks.pull,
  pushRecords: mocks.push,
}));
vi.mock("@/src/lib/cloud-account", async (original) => ({
  ...(await original<typeof import("@/src/lib/cloud-account")>()),
  readCloudBlobs: mocks.blobs,
  writeCloudProgress: async () => {},
  writeCloudStats: async () => {},
}));
vi.mock("@/src/lib/cloud-preferences", () => ({
  watchCloudPreferences: () => () => {},
  writeCloudPreferences: async () => {},
}));
vi.mock("@/src/lib/cloud-set-migration", () => ({
  ensureCloudSetIsolation: mocks.isolation,
  cleanupLegacyCloudCopies: async () => true,
}));
const { useCloudStore } = await import("@/stores/cloud-store");
const { useLibraryStore } = await import("@/stores/library-store");
const { useLearningStore } = await import("@/stores/learning-store");
const noChange: LibraryCommitStats = {
  writtenBlobs: 0,
  totalRecords: 0,
  collectedKeys: 0,
  changed: [],
  removed: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  setStorageNamespace("account-a");
  mocks.journal = {
    schemaVersion: 5,
    version: 0,
    seeded: true,
    cursor: "before",
    dirty: {},
    tombstones: {},
    legacyPendingRefs: {},
    blobs: { progress: 0, stats: 0, preferences: 0 },
  };
  mocks.commit.mockResolvedValue(noChange);
  mocks.auth.mockResolvedValue(null);
  mocks.isolation.mockResolvedValue({ completed: true, migrated: false });
  mocks.push.mockResolvedValue(undefined);
  mocks.remap.mockResolvedValue(undefined);
  mocks.blobs.mockResolvedValue({
    progress: { cards: {}, updatedAt: "2026-10-01T00:00:00.000Z" },
    stats: createDefaultStats(),
    preferences: null,
  });
  mocks.pull.mockResolvedValue({ records: [], cursor: "after" });
  useLibraryStore.setState({ state: emptyLibraryState(), status: "ready" });
  useCloudStore.setState({
    ready: true,
    user: { uid: "account-a" } as User,
    error: "",
    pending: 0,
  });
});
afterEach(() => setStorageNamespace("guest"));

describe("synchronization state consistency", () => {
  it("maps an offline v1 question deletion before applying an already-published v9 feed and pushes its new tombstone in the same run", async () => {
    const setId = "remote-set";
    const wordKey = buildSetWordKey(setId, "adapt");
    const senseId = buildSenseId(wordKey, "v.", "適應");
    const legacyId = "legacy-question";
    const questionId = `question-${canonicalHash({ setId, id: legacyId })}`;
    const timestamp = "2026-10-09T00:00:00.000Z";
    const local = {
      ...emptyLibraryState(),
      sets: [
        {
          id: setId,
          setName: "Remote",
          folderId: "__uncategorized__",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      words: {
        [wordKey]: {
          wordKey,
          word: "adapt",
          updatedAt: timestamp,
          senses: [
            {
              id: senseId,
              pos: "v.",
              meaningZh: "適應",
              examples: [],
              supplementary: false,
            },
          ],
        },
      },
      memberships: { [setId]: [{ wordKey, senseIds: [senseId] }] },
    };
    const remote = {
      ...local,
      questions: [
        canonicalizeQuestion({
          id: questionId,
          fingerprint: "",
          kind: "multipleChoice",
          questionStyle: "vocabulary",
          wordKey,
          senseId,
          difficulty: 1,
          prompt: "We _____ to the new rules.",
          options: ["adapt", "adapted", "adapting", "adapts"],
          answerIndex: 0,
          createdAt: timestamp,
          updatedAt: timestamp,
        }),
      ],
    };
    const oldKey = `question:${legacyId}`;
    const newKey = `question:${questionId}`;
    const tombstone = {
      kind: "question" as const,
      id: legacyId,
      version: 7,
      deletedAt: timestamp,
    };
    mocks.journal = {
      ...mocks.journal!,
      version: 7,
      tombstones: { [oldKey]: tombstone },
      legacyPendingRefs: {
        [oldKey]: { kind: "question", id: legacyId, version: 7 },
      },
    };
    mocks.remap.mockImplementationOnce(
      async (remaps: readonly PendingLibraryRefRemap[]) => {
        expect(remaps).toEqual([
          {
            source: { kind: "question", id: legacyId },
            targets: [{ kind: "question", id: questionId }],
          },
        ]);
        // The journal API publishes a new durable snapshot, rather than mutating
        // the earlier journal object captured by this sync.
        mocks.journal = {
          ...mocks.journal!,
          tombstones: { [newKey]: { ...tombstone, id: questionId } },
          legacyPendingRefs: {},
        };
      },
    );
    mocks.pull.mockResolvedValueOnce({
      records: allLibraryRefs(remote).map((ref) => recordForRef(remote, ref)!),
      cursor: "v9-after",
    });
    useLibraryStore.setState({ state: local });
    await useCloudStore.getState().sync();
    expect(mocks.pull.mock.calls[0][2]).toBe("");
    expect(mocks.remap).toHaveBeenCalledOnce();
    expect(useLibraryStore.getState().state.questions).toEqual([]);
    expect(mocks.push.mock.calls[0][2]).toEqual([
      {
        record: {
          type: "question",
          recordKey: questionId,
          deleted: true,
          updatedAt: timestamp,
          payload: null,
        },
      },
    ]);
    expect(mocks.clear.mock.calls[0][0]).toEqual([{ key: newKey, version: 7 }]);
  });

  it("does not pull with the preceding account's namespace during sign-in", async () => {
    useCloudStore.setState({
      ready: false,
      user: { uid: "account-b" } as User,
    });
    await useCloudStore.getState().sync();
    expect(mocks.pull).not.toHaveBeenCalled();
    expect(mocks.cursor).not.toHaveBeenCalled();
  });
  it("does not start the v9 feed or save a migration cursor after the account changes", async () => {
    setStorageNamespace("migrating-account");
    useCloudStore.setState({ user: { uid: "migrating-account" } as User });
    let finishMigration!: () => void;
    mocks.isolation.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishMigration = () => resolve({ completed: true, migrated: true });
        }),
    );
    const synced = useCloudStore.getState().sync();
    await vi.waitFor(() => expect(mocks.isolation).toHaveBeenCalledOnce());
    expect(mocks.pull).not.toHaveBeenCalled();
    useCloudStore.setState({
      ready: false,
      user: { uid: "account-b" } as User,
    });
    finishMigration();
    await synced;
    expect(mocks.pull).not.toHaveBeenCalled();
    expect(mocks.cursor).not.toHaveBeenCalled();
  });
  it("discards account documents when a different sign-in starts before the read completes", async () => {
    let finishRead!: () => void;
    mocks.blobs.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRead = () =>
            resolve({ progress: null, stats: null, preferences: null });
        }),
    );
    const synced = useCloudStore.getState().sync({ reconcileAccount: true });
    await vi.waitFor(() => expect(mocks.blobs).toHaveBeenCalledOnce());
    const apply = vi.spyOn(useLearningStore.getState(), "applyRemoteState");
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
    expect(getStorageNamespace()).toBe("account-a");
    finishWrite();
    await signedOut;
    await synced;
    expect(getStorageNamespace()).toBe("guest");
    expect(mocks.cursor).not.toHaveBeenCalled();
    expect(mocks.seeded).not.toHaveBeenCalled();
    expect(mocks.clear).not.toHaveBeenCalled();
  });
});

import type { LibraryState, LearningProgress } from "@/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildSenseId,
  buildSetWordKey,
  canonicalizeQuestion,
  normalizeWordKey,
} from "@/src/lib/library";
import { createUncategorizedFolder } from "@/src/lib/folders";
import { canonicalHash } from "@/src/lib/hash";
import { isolateLibrarySets } from "@/src/lib/library-set-migration";
import { remapLearningSnapshot } from "@/src/lib/learning-scope-migration";
import { createDefaultStats } from "@/src/lib/learning-defaults";
import {
  emptyLibraryState,
  getLibraryRepository,
  resetLibraryRepositoryCache,
} from "@/src/lib/library-repository";
import {
  loadSyncJournal,
  remapPendingLibraryRefs,
  resetSyncJournalCache,
} from "@/src/lib/sync-journal";
import { setStorageNamespace } from "@/src/lib/persist";
import { useLibraryStore } from "@/stores/library-store";
import { useLearningStore } from "@/stores/learning-store";
import { LEARNING_STORAGE_KEY } from "@/constants";

const disk = vi.hoisted(() => ({
  values: new Map<string, unknown>(),
  failRemap: false,
}));
vi.mock("idb-keyval", () => ({
  get: async (key: string) => disk.values.get(key),
  set: async (key: string, value: unknown) => {
    if (
      disk.failRemap &&
      key.endsWith(":lexiro_sync_journal") &&
      typeof value === "string" &&
      Object.keys(JSON.parse(value).dirty).some((id) =>
        id.startsWith("word:word-"),
      )
    ) {
      disk.failRemap = false;
      throw new Error("journal write interrupted");
    }
    disk.values.set(key, structuredClone(value));
  },
  setMany: async (entries: [string, unknown][]) => {
    for (const [key, value] of entries)
      disk.values.set(key, structuredClone(value));
  },
  del: async (key: string) => void disk.values.delete(key),
  delMany: async (keys: string[]) => {
    for (const key of keys) disk.values.delete(key);
  },
  keys: async () => [...disk.values.keys()],
}));

const at = "2026-10-09T00:00:00.000Z";
const calm = normalizeWordKey("calm");
const senseId = buildSenseId(calm, "adj.", "平靜的");
function legacyLibrary(): LibraryState {
  return {
    version: 1,
    words: {
      [calm]: {
        wordKey: calm,
        word: "calm",
        senses: [
          {
            id: senseId,
            pos: "adj.",
            meaningZh: "平靜的",
            examples: ["The sea was calm."],
            supplementary: false,
          },
        ],
        updatedAt: at,
      },
    },
    sets: ["a", "b"].map((id) => ({
      id,
      setName: id.toUpperCase(),
      folderId: "__uncategorized__",
      createdAt: at,
      updatedAt: at,
    })),
    memberships: {
      a: [{ wordKey: calm, senseIds: [senseId] }],
      b: [{ wordKey: calm, senseIds: [senseId] }],
    },
    folders: [createUncategorizedFolder()],
    questions: [
      canonicalizeQuestion({
        id: "original-question",
        fingerprint: "",
        kind: "multipleChoice",
        questionStyle: "vocabulary",
        difficulty: 2,
        wordKey: calm,
        senseId,
        prompt: "The sea was _____ after the storm.",
        options: ["calm", "rough", "noisy", "crowded"],
        answerIndex: 0,
        createdAt: at,
        updatedAt: at,
      }),
    ],
    updatedAt: at,
  };
}
function historicalLearning() {
  const progress: LearningProgress = {
    cards: {
      [senseId]: {
        due: at,
        stability: 8,
        difficulty: 4,
        elapsedDays: 3,
        scheduledDays: 7,
        learningSteps: 0,
        reps: 4,
        lapses: 1,
        state: 2,
        lastReview: at,
        reviewCount: 4,
        correctCount: 3,
      },
    },
    updatedAt: at,
  };
  const stats = {
    ...createDefaultStats(),
    totalQuestionReviews: 4,
    correctQuestionReviews: 3,
    streakDays: 2,
    longestStreak: 5,
    streakFreezes: 1,
    lastStudyDate: "2026-10-09",
    dailyHistory: {
      "2026-10-09": {
        date: "2026-10-09",
        memoryAgain: 1,
        memoryGood: 3,
        questionTotal: 4,
      },
    },
    questionStatsBySense: {
      [senseId]: { "vocabulary:2": { total: 4, correct: 3, retry: 1 } },
    },
    updatedAt: at,
  };
  return { progress, stats };
}
/** Write the actual prior repository envelope, without today's commit normalizer. */
function seedSchema2(state: LibraryState) {
  const entries: Record<string, Record<string, string>> = {
    folder: {},
    set: {},
    membership: {},
    word: {},
    question: {},
  };
  const records = [
    ...state.folders.map((value) => ({ kind: "folder", id: value.id, value })),
    ...state.sets.map((value) => ({ kind: "set", id: value.id, value })),
    ...Object.entries(state.memberships).map(([id, value]) => ({
      kind: "membership",
      id,
      value,
    })),
    ...Object.entries(state.words).map(([id, value]) => ({
      kind: "word",
      id,
      value,
    })),
    ...state.questions.map((value) => ({
      kind: "question",
      id: value.id,
      value,
    })),
  ];
  for (const record of records) {
    const hash = canonicalHash(record.value);
    entries[record.kind][record.id] = hash;
    disk.values.set(
      `scope-test:lexiro-library:blob:${hash}`,
      structuredClone(record.value),
    );
  }
  const manifest = {
    schemaVersion: 2,
    generation: "legacy",
    sequence: 1,
    updatedAt: at,
    entries,
  };
  disk.values.set("scope-test:lexiro-library:manifest:legacy", manifest);
  disk.values.set("scope-test:lexiro-library:head", {
    schemaVersion: 2,
    generation: "legacy",
    updatedAt: at,
    manifestChecksum: canonicalHash(manifest),
  });
}

beforeEach(() => {
  disk.values.clear();
  disk.failRemap = false;
  resetLibraryRepositoryCache();
  resetSyncJournalCache();
  setStorageNamespace("scope-test");
  useLibraryStore.setState({
    state: emptyLibraryState(),
    status: "idle",
    error: null,
  });
  useLearningStore.setState({
    loaded: false,
    progress: { cards: {}, updatedAt: at },
    stats: createDefaultStats(),
  });
});

describe("set-owned content migration", () => {
  it("copies historical content and learning once without multiplying account history", () => {
    const source = legacyLibrary();
    const migration = isolateLibrarySets(source);
    const a = migration.state.memberships.a[0];
    const b = migration.state.memberships.b[0];
    expect(a.wordKey).toBe(buildSetWordKey("a", "calm"));
    expect(a.wordKey).not.toBe(b.wordKey);
    expect(migration.state.questions).toHaveLength(2);
    expect(
      new Set(migration.state.questions.map((question) => question.fingerprint))
        .size,
    ).toBe(2);
    migration.state.words[a.wordKey].senses[0].examples.push(
      "She stayed calm.",
    );
    expect(migration.state.words[b.wordKey].senses[0].examples).toEqual([
      "The sea was calm.",
    ]);
    expect(source.words[calm].senses[0].examples).toEqual([
      "The sea was calm.",
    ]);
    const history = historicalLearning();
    const migrated = remapLearningSnapshot(
      history.progress,
      history.stats,
      migration.senseRemaps,
    );
    expect(migrated.progress.cards[a.senseIds[0]]).toEqual(
      history.progress.cards[senseId],
    );
    expect(migrated.progress.cards[b.senseIds[0]]).toEqual(
      history.progress.cards[senseId],
    );
    expect(migrated.progress.cards[senseId]).toBeUndefined();
    expect(migrated.stats.totalQuestionReviews).toBe(4);
    expect(migrated.stats.dailyHistory).toEqual(history.stats.dailyHistory);
    expect(migrated.stats.streakDays).toBe(2);
    expect(
      remapLearningSnapshot(
        migrated.progress,
        migrated.stats,
        migration.senseRemaps,
      ),
    ).toEqual(migrated);
    expect(isolateLibrarySets(migration.state).state).toBe(migration.state);
  });

  it("preserves a mixed-source historical passage and every child in an explicit recovery set", () => {
    const source = legacyLibrary();
    const rescue = normalizeWordKey("rescue");
    const rescueSense = buildSenseId(rescue, "v.", "救援");
    source.words[rescue] = {
      wordKey: rescue,
      word: "rescue",
      senses: [
        {
          id: rescueSense,
          pos: "v.",
          meaningZh: "救援",
          examples: [],
          supplementary: false,
        },
      ],
      updatedAt: at,
    };
    source.memberships.b = [{ wordKey: rescue, senseIds: [rescueSense] }];
    source.questions = [
      canonicalizeQuestion({
        id: "mixed-passage",
        fingerprint: "",
        kind: "reading",
        format: "reading",
        difficulty: 2,
        title: "A quiet rescue",
        passage: "The sea was calm when the crew began the rescue.",
        wordKeys: [calm, rescue],
        questions: [calm, rescue].map((wordKey, index) => ({
          id: `old-child-${index}`,
          kind: "multipleChoice",
          prompt: "What happened at sea?",
          options: ["A rescue", "A storm", "A race", "A parade"],
          answerIndex: 0,
          wordKey,
          senseId: index ? rescueSense : senseId,
        })),
        createdAt: at,
        updatedAt: at,
      }),
    ];
    const migration = isolateLibrarySets(source);
    const owner = migration.state.sets.find(
      (set) => set.setName === "遷移保留題組",
    )!;
    expect(owner).toBeTruthy();
    expect(migration.state.questions).toHaveLength(1);
    const passage = migration.state.questions[0];
    if (passage.kind !== "reading") throw new Error("passage was lost");
    expect(passage.passage).toBe(
      source.questions[0].kind === "reading" ? source.questions[0].passage : "",
    );
    expect(passage.questions).toHaveLength(2);
    expect(passage.wordKeys).toEqual([
      buildSetWordKey(owner.id, "calm"),
      buildSetWordKey(owner.id, "rescue"),
    ]);
    expect(
      passage.questions.every((child) =>
        migration.state.words[child.wordKey].senses.some(
          (sense) => sense.id === child.senseId,
        ),
      ),
    ).toBe(true);
  });

  it("resumes after the v3 head is published but the journal write fails, preserving pending provenance", async () => {
    seedSchema2(legacyLibrary());
    const history = historicalLearning();
    disk.values.set(
      `scope-test:${LEARNING_STORAGE_KEY}`,
      JSON.stringify({ version: 1, ...history }),
    );
    disk.values.set(
      "scope-test:lexiro_sync_journal",
      JSON.stringify({
        schemaVersion: 4,
        cursor: "old-v8-cursor",
        seeded: true,
        version: 8,
        dirty: { "word:calm": { kind: "word", id: calm, version: 7 } },
        tombstones: {
          "question:deleted-old-question": {
            kind: "question",
            id: "deleted-old-question",
            version: 8,
            deletedAt: at,
          },
        },
        blobs: { progress: 0, stats: 0, preferences: 6 },
      }),
    );
    disk.failRemap = true;
    await useLibraryStore.getState().hydrate();
    expect(useLibraryStore.getState().status).toBe("error");
    expect((await getLibraryRepository().loadState()).version).toBe(2);
    expect(await getLibraryRepository().scopeMigrationIntent()).toBeTruthy();
    expect((await loadSyncJournal()).dirty["word:calm"]).toBeTruthy();
    await useLibraryStore.getState().reloadNamespace();
    expect(useLibraryStore.getState().status).toBe("ready");
    const state = useLibraryStore.getState().state;
    const journal = await loadSyncJournal();
    expect(journal.cursor).toBe("");
    expect(journal.seeded).toBe(true);
    expect(Object.keys(journal.dirty).sort()).toEqual(
      [
        `word:${buildSetWordKey("a", "calm")}`,
        `word:${buildSetWordKey("b", "calm")}`,
      ].sort(),
    );
    expect(journal.tombstones["question:deleted-old-question"].deletedAt).toBe(
      at,
    );
    expect(
      journal.legacyPendingRefs["question:deleted-old-question"].version,
    ).toBe(8);
    expect(journal.blobs.preferences).toBe(6);
    expect(await getLibraryRepository().scopeMigrationIntent()).toBeUndefined();
    expect(
      useLearningStore.getState().progress.cards[
        state.memberships.a[0].senseIds[0]
      ],
    ).toEqual(history.progress.cards[senseId]);
    expect(useLearningStore.getState().stats.totalQuestionReviews).toBe(4);
    expect(useLearningStore.getState().stats.dailyHistory).toEqual(
      history.stats.dailyHistory,
    );
    await remapPendingLibraryRefs([
      {
        source: { kind: "question", id: "deleted-old-question" },
        targets: [{ kind: "question", id: "deleted-new-question" }],
      },
    ]);
    expect(
      (await loadSyncJournal()).tombstones["question:deleted-new-question"]
        .version,
    ).toBe(8);
    expect((await loadSyncJournal()).legacyPendingRefs).toEqual({});
  });
});

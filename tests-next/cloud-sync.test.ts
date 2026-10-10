import type { CardProgress, LearningProgress, LibraryState } from "@/types";
import type { SyncJournal } from "@/src/lib/sync-journal";
import { describe, expect, it } from "vitest";


import { CLOUD_SCHEMA_VERSION } from "@/constants";
import { applyCloudRecords, cloudRecordId } from "@/src/lib/cloud-records";
import { normalizeCloudProgress } from "@/src/lib/cloud-sync-schema";
import { mergeProgress, mergeStats } from "@/src/lib/cloud-account";
import { createDefaultStats } from "@/src/lib/learning-defaults";
import { pendingRecords } from "@/src/lib/cloud-sync";
import { createUncategorizedFolder } from "@/src/lib/folders";
import { buildSenseId, buildSetWordKey } from "@/src/lib/library";
import { repairLibraryState } from "@/src/lib/library-repair";

const EARLIER = "2026-09-01T00:00:00.000Z";
const LATER = "2026-09-02T00:00:00.000Z";

function library(
  setId: string,
  rawWordKey: string,
  setName: string,
  timestamp = EARLIER,
): LibraryState {
  const wordKey = buildSetWordKey(setId, rawWordKey);
  const senseId = buildSenseId(wordKey, "n.", `${rawWordKey} 意思`);
  return {
    version: 2,
    words: {
      [wordKey]: {
        wordKey,
        word: rawWordKey,
        senses: [
          {
            id: senseId,
            pos: "n.",
            meaningZh: `${rawWordKey} 意思`,
            examples: [],
            supplementary: false,
          },
        ],
        updatedAt: timestamp,
      },
    },
    sets: [
      {
        id: setId,
        setName,
        folderId: "__uncategorized__",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    memberships: { [setId]: [{ wordKey, senseIds: [senseId] }] },
    folders: [createUncategorizedFolder()],
    questions: [],
    updatedAt: timestamp,
  };
}

function emptyLibrary(): LibraryState {
  return {
    version: 2,
    words: {},
    sets: [],
    memberships: {},
    folders: [createUncategorizedFolder()],
    questions: [],
    updatedAt: EARLIER,
  };
}

function journal(patch: Partial<SyncJournal> = {}): SyncJournal {
  return {
    schemaVersion: 5,
    cursor: "42|set-0123456789abcdef0123456789abcdef",
    seeded: true,
    version: 5,
    dirty: {},
    tombstones: {},
    legacyPendingRefs: {},
    blobs: { progress: 0, stats: 0, preferences: 0 },
    ...patch,
  };
}

describe("record identity", () => {
  it("gives arbitrary word keys a stable record identity", () => {
    const id = cloudRecordId({ kind: "word", id: "look/after" });
    expect(id).toMatch(/^word-[0-9a-f]{32}$/u);
  });

  it("names the same record the same way every time", () => {
    expect(cloudRecordId({ kind: "set", id: "abc" })).toBe(
      cloudRecordId({ kind: "set", id: "abc" }),
    );
    expect(cloudRecordId({ kind: "set", id: "abc" })).not.toBe(
      cloudRecordId({ kind: "word", id: "abc" }),
    );
  });
});

describe("applyCloudRecords", () => {
  it("removes a record a tombstone arrives for", () => {
    const merged = applyCloudRecords(library("one", "adapt", "常用單字"), [
      {
        type: "set",
        recordKey: "one",
        deleted: true,
        updatedAt: LATER,
        payload: null,
      },
    ]);
    expect(merged.sets).toHaveLength(0);
    // The word went with the set that held it, rather than being left behind
    // as an orphan the Library would refuse to store.
    expect(merged.words).toEqual({});
  });

  it("keeps a local edit that is still waiting to be pushed", () => {
    const local = library("one", "adapt", "改過的名字", LATER);
    const merged = applyCloudRecords(
      local,
      [
        {
          type: "set",
          recordKey: "one",
          deleted: true,
          updatedAt: EARLIER,
          payload: null,
        },
      ],
      new Set(["set:one"]),
    );
    expect(merged.sets.map((entry) => entry.setName)).toEqual(["改過的名字"]);
  });

  it("keeps both sides when two devices changed different records", () => {
    const local = library("one", "adapt", "第一組");
    const other = library("two", "revise", "第二組");
    const merged = applyCloudRecords(local, [
      {
        type: "set",
        recordKey: "two",
        deleted: false,
        updatedAt: LATER,
        payload: { ...other.sets[0] },
      },
      {
        type: "word",
        recordKey: buildSetWordKey("two", "revise"),
        deleted: false,
        updatedAt: LATER,
        payload: { ...other.words[buildSetWordKey("two", "revise")] },
      },
      {
        type: "membership",
        recordKey: "two",
        deleted: false,
        updatedAt: LATER,
        payload: { members: other.memberships["two"] },
      },
    ]);
    expect(merged.sets.map((entry) => entry.id).sort()).toEqual(["one", "two"]);
    expect(
      Object.values(merged.words)
        .map((word) => word.word)
        .sort(),
    ).toEqual(["adapt", "revise"]);
    expect(merged.memberships.two[0].wordKey).toBe(
      buildSetWordKey("two", "revise"),
    );
  });

  it("takes the cloud copy even when the device that wrote it has a slow clock", () => {
    // Order is the server sequence, which is what the pull is sorted by.
    // A device whose own clock reads earlier — or years ahead — no longer wins
    // or loses conflicts on the strength of that clock alone.
    const local = library("one", "adapt", "新名字", LATER);
    const merged = applyCloudRecords(local, [
      {
        type: "set",
        recordKey: "one",
        deleted: false,
        updatedAt: EARLIER,
        payload: { ...local.sets[0], setName: "後寫入的名字" },
      },
    ]);
    expect(merged.sets[0].setName).toBe("後寫入的名字");
  });

  it("applies records in the order they arrive, last write winning", () => {
    const local = library("one", "adapt", "原名");
    const merged = applyCloudRecords(local, [
      {
        type: "set",
        recordKey: "one",
        deleted: false,
        updatedAt: LATER,
        payload: { ...local.sets[0], setName: "中間" },
      },
      {
        type: "set",
        recordKey: "one",
        deleted: false,
        updatedAt: EARLIER,
        payload: { ...local.sets[0], setName: "最後" },
      },
    ]);
    expect(merged.sets[0].setName).toBe("最後");
  });
});

describe("pendingRecords", () => {
  it("sends a tombstone for everything that was deleted", () => {
    // The regression: emptying the Library used to publish nothing at all,
    // because "nothing local worth keeping" was inferred from it being empty.
    // The cloud then restored every set on the next sync.
    const work = pendingRecords(
      emptyLibrary(),
      journal({
        tombstones: {
          "set:one": { kind: "set", id: "one", deletedAt: LATER, version: 5 },
          "word:adapt": {
            kind: "word",
            id: "adapt",
            deletedAt: LATER,
            version: 5,
          },
        },
      }),
    );
    expect(work.records).toHaveLength(2);
    expect(work.records.every(({ record }) => record.deleted)).toBe(true);
  });

  it("sends the whole Library until this device has synced once", () => {
    const work = pendingRecords(
      library("one", "adapt", "常用單字"),
      journal({ cursor: "", seeded: false }),
    );
    // Folder, set, membership and word: a first sign-in, or a journal that was
    // lost, still puts everything in the cloud.
    expect(work.records.map(({ record }) => record.type).sort()).toEqual([
      "folder",
      "membership",
      "set",
      "word",
    ]);
  });

  it("says which version of each record it sent", () => {
    const work = pendingRecords(
      library("one", "adapt", "常用單字"),
      journal({
        dirty: { "set:one": { kind: "set", id: "one", version: 4 } },
      }),
    );
    expect(work.clear).toEqual([{ key: "set:one", version: 4 }]);
  });

  it("drops a dirty record that the Library no longer holds", () => {
    const work = pendingRecords(
      emptyLibrary(),
      journal({
        dirty: { "word:adapt": { kind: "word", id: "adapt", version: 4 } },
      }),
    );
    expect(work.records).toHaveLength(0);
    expect(work.clear).toEqual([{ key: "word:adapt", version: 4 }]);
  });
});

describe("repairLibraryState", () => {
  it("renames rather than rejects when two devices chose the same set name", () => {
    const first = library("one", "adapt", "單元一");
    const second = library("two", "revise", "單元一");
    const repaired = repairLibraryState({
      words: { ...first.words, ...second.words },
      sets: [...first.sets, ...second.sets],
      memberships: { ...first.memberships, ...second.memberships },
      folders: first.folders,
      questions: [],
      updatedAt: LATER,
    });
    expect(repaired.sets).toHaveLength(2);
    expect(new Set(repaired.sets.map((entry) => entry.setName)).size).toBe(2);
  });

  it("drops a set whose last word is gone instead of storing an empty one", () => {
    const repaired = repairLibraryState({
      words: {},
      sets: library("one", "adapt", "常用單字").sets,
      memberships: {},
      folders: [createUncategorizedFolder()],
      questions: [],
      updatedAt: LATER,
    });
    expect(repaired.sets).toEqual([]);
  });
});

describe("mergeProgress", () => {
  const card = (lastReview: string, reps: number): CardProgress => ({
    due: LATER,
    stability: 1,
    difficulty: 5,
    elapsedDays: 0,
    scheduledDays: 1,
    learningSteps: 0,
    reps,
    lapses: 0,
    state: 1,
    lastReview,
    reviewCount: reps,
    correctCount: reps,
  });

  it("keeps the more recent review of each card and loses neither device's work", () => {
    const local: LearningProgress = {
      cards: { a: card(LATER, 3), b: card(EARLIER, 1) },
      updatedAt: LATER,
    } as unknown as LearningProgress;
    const remote: LearningProgress = {
      cards: { a: card(EARLIER, 1), b: card(LATER, 4), c: card(LATER, 2) },
      updatedAt: EARLIER,
    } as unknown as LearningProgress;

    const merged = mergeProgress(local, remote);
    expect(Object.keys(merged.cards).sort()).toEqual(["a", "b", "c"]);
    expect(merged.cards["a" as keyof typeof merged.cards].reps).toBe(3);
    expect(merged.cards["b" as keyof typeof merged.cards].reps).toBe(4);
  });

  it("keeps local progress when the cloud has none", () => {
    const local: LearningProgress = { cards: {}, updatedAt: LATER };
    expect(mergeProgress(local, null)).toBe(local);
  });
});

describe("mergeStats", () => {
  it("retains newer remote per-sense counts and each device's sparse formats after identity migration", () => {
    const senseId = buildSenseId(buildSetWordKey("one", "adapt"), "v.", "適應");
    const local = {
      ...createDefaultStats(),
      updatedAt: EARLIER,
      totalQuestionReviews: 4,
      questionStatsBySense: {
        [senseId]: {
          "vocabulary:1": { total: 3, correct: 1, retry: 1 },
          "reading:2": { total: 1, correct: 1, retry: 0 },
        },
      },
    };
    const remote = {
      ...createDefaultStats(),
      updatedAt: LATER,
      totalQuestionReviews: 9,
      questionStatsBySense: {
        [senseId]: {
          "vocabulary:1": { total: 5, correct: 4, retry: 2 },
          "cloze:2": { total: 4, correct: 3, retry: 1 },
        },
      },
    };
    const merged = mergeStats(local, remote);
    expect(merged.questionStatsBySense[senseId]).toEqual({
      "vocabulary:1": { total: 5, correct: 4, retry: 2 },
      "reading:2": { total: 1, correct: 1, retry: 0 },
      "cloze:2": { total: 4, correct: 3, retry: 1 },
    });
    expect(merged.totalQuestionReviews).toBe(9);
    expect(mergeStats(merged, remote)).toEqual(merged);
  });
});

describe("normalizeCloudProgress", () => {
  const UID = "user-1";
  const document = {
    cards: {},
    ownerId: UID,
    schemaVersion: CLOUD_SCHEMA_VERSION,
    updatedAt: "2026-09-11T03:00:00.000Z",
  };

  it("reads a well-formed cloud document", () => {
    expect(normalizeCloudProgress(document, UID).updatedAt).toBe(
      "2026-09-11T03:00:00.000Z",
    );
  });

  it("refuses a document belonging to another account", () => {
    expect(() => normalizeCloudProgress(document, "someone-else")).toThrow();
  });

  it("refuses a document written by an unsupported version", () => {
    expect(() =>
      normalizeCloudProgress({ ...document, schemaVersion: 5 }, UID),
    ).toThrow();
  });
});

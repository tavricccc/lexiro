import type { LearningProgress, LibraryState } from "@/types";
import { describe, expect, it } from "vitest";

import { createUncategorizedFolder } from "@/src/lib/folders";
import { buildSenseId, buildSetWordKey, normalizeWordKey } from "@/src/lib/library";
import { createFullBackup, previewBackupImport } from "@/src/lib/full-backup";
import { mergeBackupLearning } from "@/src/lib/learning-backup";
import { createDefaultStats } from "@/src/lib/learning-defaults";
import { mergeLibraryStates } from "@/src/lib/library-merge";
import { normalizeFullBackupPayload } from "@/src/lib/share";
import { reviewCard } from "@/src/lib/fsrs";

function library(
  setId: string,
  rawWordKey: string,
  setName: string,
): LibraryState {
  const timestamp = "2026-08-12T00:00:00.000Z";
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

describe("data integrity", () => {
  it("merges backup records without replacing an existing set", () => {
    const current = library("same", "local", "目前資料");
    const incoming = library("same", "remote", "備份資料");
    const merged = mergeLibraryStates(current, incoming);
    expect(merged.state.sets).toHaveLength(1);
    expect(merged.state.sets[0].setName).toBe("目前資料");
    expect(merged.state.words).toHaveProperty(buildSetWordKey("same", "local"));
    expect(merged.state.words).not.toHaveProperty(
      buildSetWordKey("same", "remote"),
    );
  });

  it("adds non-conflicting backup sets", () => {
    const merged = mergeLibraryStates(
      library("one", "one", "一"),
      library("two", "two", "二"),
    );
    expect(merged.result.addedSets).toBe(1);
    expect(merged.state.sets.map((set) => set.id)).toEqual(["one", "two"]);
  });

  it("exports a canonical backup without the API key", () => {
    const progress: LearningProgress = {
      cards: {},
      updatedAt: "2026-08-16T00:00:00.000Z",
    };
    const backup = createFullBackup(
      library("one", "adapt", "常用單字"),
      progress,
      createDefaultStats(),
    );

    expect(backup.kind).toBe("full-backup");
    expect(backup.version).toBe(5);
    expect(backup).not.toHaveProperty("aiSettings");
    expect(normalizeFullBackupPayload(backup)).toEqual(backup);
  });

  it("restores equal spellings as independent sets and does not duplicate a repeated restore", () => {
    const current = library("one", "adapt", "本機單字");
    const backup = normalizeFullBackupPayload(
      createFullBackup(
        library("two", "adapt", "備份單字"),
        { cards: {}, updatedAt: "2026-08-16T00:00:00.000Z" },
        createDefaultStats(),
      ),
    );
    const first = mergeLibraryStates(current, backup.library);
    const second = mergeLibraryStates(first.state, backup.library);
    expect(first.state.sets.map((set) => set.id)).toEqual(["one", "two"]);
    expect(Object.keys(first.state.words)).toEqual(
      expect.arrayContaining([
        buildSetWordKey("one", "adapt"),
        buildSetWordKey("two", "adapt"),
      ]),
    );
    expect(first.state.memberships.one[0].senseIds[0]).not.toBe(
      first.state.memberships.two[0].senseIds[0],
    );
    expect(second.result).toEqual({ addedSets: 0, addedQuestions: 0 });
    expect(second.state.sets).toHaveLength(2);
  });

  it("migrates a v4 backup's shared sense into each set without increasing lifetime counters", () => {
    const timestamp = "2026-08-16T00:00:00.000Z";
    const oldSenseId = buildSenseId(normalizeWordKey("adapt"), "v.", "適應");
    const card = reviewCard(null, "good", new Date(timestamp));
    const totals = { "meaning:1": { total: 2, correct: 1, retry: 0 } };
    const oldLibrary = {
      version: 1,
      words: {
        adapt: {
          wordKey: "adapt",
          word: "adapt",
          senses: [
            {
              id: oldSenseId,
              pos: "v.",
              meaningZh: "適應",
              examples: ["We adapt quickly."],
              supplementary: false,
            },
          ],
          updatedAt: timestamp,
        },
      },
      sets: ["one", "two"].map((id) => ({
        id,
        setName: id,
        folderId: "__uncategorized__",
        createdAt: timestamp,
        updatedAt: timestamp,
      })),
      memberships: {
        one: [{ wordKey: "adapt", senseIds: [oldSenseId] }],
        two: [{ wordKey: "adapt", senseIds: [oldSenseId] }],
      },
      folders: [createUncategorizedFolder()],
      questions: [],
      updatedAt: timestamp,
    };
    const migrated = normalizeFullBackupPayload({
      version: 4,
      exportedAt: timestamp,
      appName: "lexiro",
      kind: "full-backup",
      library: oldLibrary,
      learning: { cards: { [oldSenseId]: card }, updatedAt: timestamp },
      stats: {
        ...createDefaultStats(),
        totalMemoryReviews: 1,
        correctMemoryReviews: 1,
        totalQuestionReviews: 2,
        correctQuestionReviews: 1,
        questionStatsBySense: { [oldSenseId]: totals },
      },
    });
    expect(migrated.version).toBe(5);
    expect(migrated.library.version).toBe(2);
    const migratedSenses = ["one", "two"].map(
      (setId) => migrated.library.memberships[setId][0].senseIds[0],
    );
    expect(new Set(migratedSenses).size).toBe(2);
    for (const senseId of migratedSenses) {
      expect(migrated.learning.cards[senseId]).toEqual(card);
      expect(migrated.stats.questionStatsBySense[senseId]).toEqual(totals);
    }
    expect(migrated.learning.cards).not.toHaveProperty(oldSenseId);
    expect(migrated.stats).toMatchObject({
      totalMemoryReviews: 1,
      correctMemoryReviews: 1,
      totalQuestionReviews: 2,
      correctQuestionReviews: 1,
    });
  });

  it("refuses a backup written against an older statistics shape", () => {
    expect(() =>
      normalizeFullBackupPayload({
        ...createFullBackup(
          library("one", "adapt", "常用單字"),
          { cards: {}, updatedAt: "2026-08-16T00:00:00.000Z" },
          createDefaultStats(),
        ),
        version: 2,
      }),
    ).toThrow();
  });

  it("previews backup additions without replacing local activity", () => {
    const current = library("one", "local", "本機");
    const incoming = library("two", "remote", "匯入");
    const localStats = { ...createDefaultStats(), totalMemoryReviews: 20 };
    const backup = createFullBackup(
      incoming,
      { cards: {}, updatedAt: "2026-08-16T00:00:00.000Z" },
      createDefaultStats(),
    );
    const prepared = previewBackupImport(backup, current, {
      cards: {},
      updatedAt: "2026-08-16T00:00:00.000Z",
    });

    expect(prepared.sets).toBe(1);
    expect(prepared).not.toHaveProperty("library");
    const merged = mergeBackupLearning(
      { cards: {}, updatedAt: "2026-08-16T00:00:00.000Z" },
      localStats,
      backup.learning,
      backup.stats,
    );
    expect(merged.stats.totalMemoryReviews).toBe(20);
  });
});

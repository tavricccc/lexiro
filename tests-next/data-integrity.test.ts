import type { LibraryState } from "@/types";
import { describe, expect, it } from "vitest";

import { createUncategorizedFolder } from "@/src/lib/folders";
import { buildSenseId, buildSetWordKey, normalizeWordKey } from "@/src/lib/library";
import { createFullBackup, previewBackupImport } from "@/src/lib/full-backup";
import { mergeLibraryStates } from "@/src/lib/library-merge";
import { normalizeFullBackupPayload } from "@/src/lib/share";

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
    const backup = createFullBackup(library("one", "adapt", "常用單字"));

    expect(backup.kind).toBe("full-backup");
    expect(backup.version).toBe(6);
    expect(backup).not.toHaveProperty("aiSettings");
    expect(backup).not.toHaveProperty("learning");
    expect(normalizeFullBackupPayload(backup)).toEqual(backup);
  });

  it("restores equal spellings as independent sets and does not duplicate a repeated restore", () => {
    const current = library("one", "adapt", "本機單字");
    const backup = normalizeFullBackupPayload(
      createFullBackup(library("two", "adapt", "備份單字")),
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

  it("migrates a v4 backup's shared sense into each set and drops its learning data", () => {
    const timestamp = "2026-08-16T00:00:00.000Z";
    const oldSenseId = buildSenseId(normalizeWordKey("adapt"), "v.", "適應");
    const card = { reviewCount: 1, correctCount: 1, lastReview: timestamp };
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
        totalMemoryReviews: 1,
        questionStatsBySense: { [oldSenseId]: totals },
      },
    });
    expect(migrated.version).toBe(6);
    expect(migrated.library.version).toBe(2);
    const migratedSenses = ["one", "two"].map(
      (setId) => migrated.library.memberships[setId][0].senseIds[0],
    );
    expect(new Set(migratedSenses).size).toBe(2);
    expect(migrated).not.toHaveProperty("learning");
    expect(migrated).not.toHaveProperty("stats");
  });

  it("refuses a backup written against an older library shape", () => {
    expect(() =>
      normalizeFullBackupPayload({
        ...createFullBackup(library("one", "adapt", "常用單字")),
        version: 2,
      }),
    ).toThrow();
  });

  it("previews backup additions", () => {
    const current = library("one", "local", "本機");
    const backup = createFullBackup(library("two", "remote", "匯入"));
    const prepared = previewBackupImport(backup, current);

    expect(prepared.sets).toBe(1);
    expect(prepared).not.toHaveProperty("library");
  });
});

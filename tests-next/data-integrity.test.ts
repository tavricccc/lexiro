import type { LibraryState } from "@/types";
import { describe, expect, it } from "vitest";

import { createUncategorizedFolder } from "@/src/lib/folders";
import { buildSenseId } from "@/src/lib/library";
import { mergeLibraryStates } from "@/src/lib/library-merge";
import { allocateDailyQuestionQuotas } from "@/src/lib/question-distribution";
import { queueRecordChanges, rebaseQueuedRecords } from "@/src/lib/sync-outbox";

function library(setId: string, wordKey: string, setName: string): LibraryState {
  const timestamp = "2026-08-12T00:00:00.000Z";
  const senseId = buildSenseId(wordKey, "n.", `${wordKey} 意思`);
  return {
    version: 1,
    words: { [wordKey]: { wordKey, word: wordKey, senses: [{ id: senseId, pos: "n.", meaningZh: `${wordKey} 意思`, examples: [] }], updatedAt: timestamp } },
    sets: [{ id: setId, setName, folderId: "__uncategorized__", createdAt: timestamp, updatedAt: timestamp }],
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
    expect(merged.state.words).toHaveProperty("local");
    expect(merged.state.words).not.toHaveProperty("remote");
  });

  it("adds non-conflicting backup sets", () => {
    const merged = mergeLibraryStates(library("one", "one", "一"), library("two", "two", "二"));
    expect(merged.result.addedSets).toBe(1);
    expect(merged.state.sets.map((set) => set.id)).toEqual(["one", "two"]);
  });

  it("allocates the daily mix in a 40/40/20 ratio", () => {
    expect(allocateDailyQuestionQuotas(10)).toEqual([4, 4, 2]);
    expect(allocateDailyQuestionQuotas(3)).toEqual([1, 1, 1]);
  });

  it("keeps the cloud record when a queued local edit conflicts", () => {
    const queued = queueRecordChanges("library", { "word:a": { value: 1 } }, { "word:a": { value: 1 } }, { "word:a": { value: 2 } }, []);
    const result = rebaseQueuedRecords({ "word:a": { value: 9 } }, queued, "library");
    expect(result.records["word:a"]).toEqual({ value: 9 });
    expect(result.conflicted).toHaveLength(1);
  });
});

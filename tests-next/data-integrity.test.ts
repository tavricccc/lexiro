import type { AiSettings, LearningProgress, LibraryState } from "@/types";
import { describe, expect, it } from "vitest";

import { createUncategorizedFolder } from "@/src/lib/folders";
import { buildSenseId } from "@/src/lib/library";
import { createFullBackup, prepareBackupImport } from "@/src/lib/full-backup";
import { createDefaultStats } from "@/src/lib/learning-defaults";
import { mergeLibraryStates } from "@/src/lib/library-merge";
import { allocateDailyQuestionQuotas } from "@/src/lib/question-distribution";

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

  it("splits a session across the exam formats and always sums to the target", () => {
    for (const target of [0, 1, 3, 10, 25, 46]) {
      const quotas = allocateDailyQuestionQuotas(target);
      const total = Object.values(quotas).reduce((sum, quota) => sum + quota, 0);
      expect(total, `target ${target}`).toBe(target);
      expect(Object.values(quotas).every((quota) => quota >= 0)).toBe(true);
    }
  });

  it("weights the mix towards the formats a 學測 paper weights", () => {
    const quotas = allocateDailyQuestionQuotas(46);
    expect(quotas.vocabulary).toBeGreaterThan(quotas.discourse);
    expect(quotas.reading).toBeGreaterThan(quotas.discourse);
  });

  it("exports a canonical backup without the API key", () => {
    const ai: AiSettings = {
      enabled: true,
      provider: "openai",
      apiKey: "secret",
      baseUrl: "",
      model: "gpt-4o-mini",
      batchSize: 8,
    };
    const progress: LearningProgress = { cards: {}, updatedAt: "2026-08-16T00:00:00.000Z" };
    const backup = createFullBackup(
      library("one", "adapt", "常用單字"),
      progress,
      createDefaultStats(),
      ai,
    );

    expect(backup.kind).toBe("full-backup");
    expect(backup.aiSettings).not.toHaveProperty("apiKey");
    expect(backup.aiSettings.batchSize).toBe(8);
  });

  it("previews backup additions without replacing local activity", () => {
    const current = library("one", "local", "本機");
    const incoming = library("two", "remote", "匯入");
    const localStats = { ...createDefaultStats(), xp: 20 };
    const backup = createFullBackup(
      incoming,
      { cards: {}, updatedAt: "2026-08-16T00:00:00.000Z" },
      createDefaultStats(),
      {
        enabled: false,
        provider: "openai",
        apiKey: "",
        baseUrl: "",
        model: "gpt-4o-mini",
        batchSize: 8,
      },
    );
    const prepared = prepareBackupImport(
      backup,
      current,
      { cards: {}, updatedAt: "2026-08-16T00:00:00.000Z" },
      localStats,
    );

    expect(prepared.sets).toBe(1);
    expect(prepared.library.sets).toHaveLength(2);
    expect(prepared.stats.xp).toBe(20);
  });
});

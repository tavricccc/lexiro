import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  LibraryQuestion,
  LibraryState,
  PracticeSessionSnapshot,
} from "@/types";
import { buildQuestionGroups } from "@/components/practice/practice-content";
import { entriesFromIds } from "@/components/practice/practice-queue";
import { useRestorePracticeSession } from "@/components/practice/use-practice-persistence";
import { createUncategorizedFolder } from "@/src/lib/folders";
import {
  buildSenseId,
  buildSetWordKey,
  canonicalizeQuestion,
  normalizeWordKey,
  senseToStudyWord,
} from "@/src/lib/library";
import { isolateLibrarySets } from "@/src/lib/library-set-migration";
import { migratePracticeScope } from "@/src/lib/practice-scope-migration";
import { practiceStorageKey } from "@/src/lib/practice-storage";

const wordKey = normalizeWordKey("calm");
const senseId = buildSenseId(wordKey, "adj.", "平靜的");
const timestamp = "2026-10-10T00:00:00.000Z";
const savedMeaning = {
  options: ["地點", "平靜的", "書本", "團隊"],
  answerIndex: 1,
};

function fixture(kind: "vocabulary" | "reading" | "cloze" = "vocabulary") {
  const base = {
    fingerprint: "pending",
    difficulty: 2 as const,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const question: LibraryQuestion = canonicalizeQuestion(
    kind === "vocabulary"
      ? {
          ...base,
          id: "old:vocabulary",
          kind: "multipleChoice",
          questionStyle: "vocabulary",
          wordKey,
          senseId,
          prompt: "Without any waves, the lake was _____.",
          options: ["calm", "rough", "crowded", "noisy"],
          answerIndex: 0,
        }
      : {
          ...base,
          id: `old:${kind}`,
          kind: "reading",
          format: kind,
          title: "A lake",
          passage: "The lake was calm.",
          wordKeys: [wordKey],
          questions: [
            {
              id: "old:child",
              kind: "multipleChoice",
              wordKey,
              senseId,
              prompt: "What was the lake like?",
              options: ["Calm", "Rough", "Crowded", "Noisy"],
              answerIndex: 0,
            },
          ],
        },
  );
  const legacy: LibraryState = {
    version: 1,
    words: {
      [wordKey]: {
        wordKey,
        word: "calm",
        senses: [
          {
            id: senseId,
            pos: "adj.",
            meaningZh: "平靜的",
            examples: [],
            supplementary: false,
          },
        ],
        updatedAt: timestamp,
      },
    },
    sets: ["set-z", "set-a"].map((id) => ({
      id,
      setName: id,
      folderId: "__uncategorized__",
      createdAt: timestamp,
      updatedAt: timestamp,
    })),
    memberships: {
      "set-z": [{ wordKey, senseIds: [senseId] }],
      "set-a": [{ wordKey, senseIds: [senseId] }],
    },
    folders: [createUncategorizedFolder()],
    questions: [question],
    updatedAt: timestamp,
  };
  const library = isolateLibrarySets(legacy).state;
  const original = buildQuestionGroups([question], legacy.words).flat()[0];
  const snapshot: PracticeSessionSnapshot = {
    schemaVersion: 5,
    setId: "set-z",
    tasks: ["meaning", kind],
    amount: 2,
    index: 1,
    correct: 1,
    wrong: [1],
    skipped: [0],
    marked: [1],
    selected: 2,
    revealed: true,
    difficulty: "all",
    entryIds: [`meaning:${senseId}`, original.id],
    failedSenseIds: [senseId],
    retrying: true,
    answerChoices: [1, 2],
    meaningChoices: { [`meaning:${senseId}`]: savedMeaning },
  };
  const study = Object.values(library.words).flatMap((word) =>
    word.senses.map((sense) => senseToStudyWord(word, sense)),
  );
  const questions = buildQuestionGroups(
    library.questions,
    library.words,
  ).flat();
  return { library, original, snapshot, study, questions };
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("scoping interrupted practice", () => {
  it.each(["vocabulary", "reading", "cloze"] as const)(
    "preserves presented %s options and answered positions when rebinding IDs",
    (kind) => {
      const { library, original, snapshot, study, questions } = fixture(kind);
      const migrated = migratePracticeScope(snapshot, library)!;
      const targetSense = library.memberships["set-z"][0].senseIds[0];
      expect(migrated.snapshot.entryIds[0]).toBe(`meaning:${targetSense}`);
      expect(
        migrated.snapshot.meaningChoices[`meaning:${targetSense}`],
      ).toEqual(savedMeaning);
      expect(migrated.snapshot.failedSenseIds).toEqual([targetSense]);
      expect(migrated.snapshot.entryIds[1]).not.toBe(original.id);
      const {
        entryIds: _oldIds,
        meaningChoices: _oldChoices,
        failedSenseIds: _oldFailed,
        ...before
      } = snapshot;
      const {
        entryIds: _newIds,
        meaningChoices: _newChoices,
        failedSenseIds: _newFailed,
        ...after
      } = migrated.snapshot;
      expect(after).toEqual(before);
      const restored = entriesFromIds(
        migrated.snapshot.entryIds,
        snapshot.tasks,
        study,
        questions,
        migrated.snapshot.meaningChoices,
      )!;
      expect(restored).toHaveLength(2);
      expect(restored[1].item.wordKey).toBe(buildSetWordKey("set-z", "calm"));
      expect(restored[1].item.options).toEqual(original.options);
      expect(restored[1].item.answerIndex).toBe(original.answerIndex);
      expect(restored[1].item.options[migrated.snapshot.selected!]).toBe(
        original.options[snapshot.selected!],
      );
      expect(migratePracticeScope(migrated.snapshot, library)).toEqual({
        snapshot: migrated.snapshot,
        changed: false,
      });
    },
  );

  it("chooses the first set ID once for an all-library legacy alias without duplicating the queue", () => {
    const { library, snapshot } = fixture();
    const migrated = migratePracticeScope({ ...snapshot, setId: "" }, library)!;
    expect(migrated.snapshot.entryIds).toHaveLength(snapshot.entryIds.length);
    expect(migrated.snapshot.entryIds[0]).toBe(
      `meaning:${library.memberships["set-a"][0].senseIds[0]}`,
    );
    expect(migrated.snapshot.failedSenseIds).toEqual([
      library.memberships["set-a"][0].senseIds[0],
    ]);
    expect(migrated.snapshot.answerChoices).toEqual(snapshot.answerChoices);
  });

  it("persists the rebound snapshot before offering the restored session", () => {
    const { library, snapshot, study, questions, original } = fixture();
    localStorage.setItem(practiceStorageKey(), JSON.stringify(snapshot));
    const onOffer = vi.fn((saved: PracticeSessionSnapshot) => {
      expect(JSON.parse(localStorage.getItem(practiceStorageKey())!)).toEqual(
        saved,
      );
      expect(saved.meaningChoices[saved.entryIds[1]].options).toEqual(
        original.options,
      );
    });
    renderHook(() =>
      useRestorePracticeSession({
        library,
        allStudyItems: study,
        allQuestionItems: questions,
        enabled: true,
        initialSet: "set-z",
        retiredEntryIds: new Set(),
        restoreAttempted: { current: false },
        onOffer,
        onChecked: vi.fn(),
        onUnavailable: vi.fn(),
      }),
    );
    expect(onOffer).toHaveBeenCalledOnce();
  });

  it("keeps the original raw draft when a source was removed", () => {
    const { library, snapshot } = fixture();
    const raw = JSON.stringify(snapshot);
    localStorage.setItem(practiceStorageKey(), raw);
    const onOffer = vi.fn(),
      onUnavailable = vi.fn();
    renderHook(() =>
      useRestorePracticeSession({
        library: { ...library, questions: [] },
        allStudyItems: [],
        allQuestionItems: [],
        enabled: true,
        initialSet: "set-z",
        retiredEntryIds: new Set(),
        restoreAttempted: { current: false },
        onOffer,
        onChecked: vi.fn(),
        onUnavailable,
      }),
    );
    expect(onUnavailable).toHaveBeenCalledWith("source");
    expect(onOffer).not.toHaveBeenCalled();
    expect(localStorage.getItem(practiceStorageKey())).toBe(raw);
  });

  it("does not offer or overwrite the raw draft when saving migrated IDs fails", () => {
    const { library, snapshot, study, questions } = fixture();
    const raw = JSON.stringify(snapshot);
    localStorage.setItem(practiceStorageKey(), raw);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    const onOffer = vi.fn(),
      onUnavailable = vi.fn();
    renderHook(() =>
      useRestorePracticeSession({
        library,
        allStudyItems: study,
        allQuestionItems: questions,
        enabled: true,
        initialSet: "set-z",
        retiredEntryIds: new Set(),
        restoreAttempted: { current: false },
        onOffer,
        onChecked: vi.fn(),
        onUnavailable,
      }),
    );
    expect(onUnavailable).toHaveBeenCalledWith("storage");
    expect(onOffer).not.toHaveBeenCalled();
    expect(localStorage.getItem(practiceStorageKey())).toBe(raw);
  });
});

"use client";

import { useEffect, useState } from "react";

import {
  practiceStorageKey,
  readPracticeDraft,
} from "@/src/lib/practice-storage";
import type {
  PracticeSessionSnapshot,
  PracticeTask,
  SenseId,
  SetMembership,
  StudyWord,
  WorkspaceQuestionDifficulty,
} from "@/types";
import type { QuestionItem } from "@/components/practice/practice-content";
import type { PracticeEntry } from "@/components/practice/practice-queue";
import type { DraftPersistence } from "@/lib/draft-persistence";
import { entriesFromIds } from "@/components/practice/practice-queue";
import {
  canRestorePracticeSession,
  parsePracticeSession,
} from "@/src/lib/practice-session";

export function useRestorePracticeSession({
  allQuestionItems,
  allStudyItems,
  enabled,
  initialSet,
  memberships,
  retiredEntryIds,
  restoreAttempted,
  setIds,
  onOffer,
  onChecked,
}: {
  allQuestionItems: QuestionItem[];
  allStudyItems: StudyWord[];
  enabled: boolean;
  initialSet: string;
  memberships: Record<string, SetMembership[]>;
  retiredEntryIds: ReadonlySet<string>;
  restoreAttempted: { current: boolean };
  setIds: Set<string>;
  onOffer: (
    snapshot: PracticeSessionSnapshot,
    entries: PracticeEntry[],
  ) => void;
  onChecked: () => void;
}) {
  useEffect(() => {
    if (restoreAttempted.current || !enabled) return;
    restoreAttempted.current = true;
    let raw: string | null;
    try {
      raw = readPracticeDraft();
    } catch {
      onChecked();
      return;
    }
    const saved = parsePracticeSession(raw, retiredEntryIds);
    if (!saved) {
      if (raw) localStorage.removeItem(practiceStorageKey());
      onChecked();
      return;
    }
    if (!canRestorePracticeSession(saved, initialSet)) {
      onChecked();
      return;
    }

    const allowed = new Set(
      (saved.setId
        ? (memberships[saved.setId] ?? [])
        : Object.values(memberships).flat()
      ).flatMap((entry) => entry.senseIds),
    );
    const entries = entriesFromIds(
      saved.entryIds,
      saved.tasks,
      allStudyItems,
      allQuestionItems,
      saved.meaningChoices,
    );
    const outOfScope = entries?.some(
      (entry) => !allowed.has(entry.item.senseId),
    );
    if (!entries || outOfScope || (saved.setId && !setIds.has(saved.setId))) {
      localStorage.removeItem(practiceStorageKey());
      onChecked();
      return;
    }
    onOffer(saved, entries);
  }, [
    allQuestionItems,
    allStudyItems,
    enabled,
    initialSet,
    memberships,
    retiredEntryIds,
    onOffer,
    onChecked,
    restoreAttempted,
    setIds,
  ]);
}

export function usePersistPracticeSession({
  amount,
  answerChoices,
  complete,
  correct,
  difficulty,
  entries,
  failedSenseIds,
  index,
  marked,
  retrying,
  revealed,
  selected,
  setId,
  skipped,
  started,
  tasks,
  wrong,
}: {
  amount: number;
  answerChoices: Array<number | null>;
  complete: boolean;
  correct: number;
  difficulty: WorkspaceQuestionDifficulty;
  entries: readonly PracticeEntry[];
  failedSenseIds: SenseId[];
  index: number;
  marked: number[];
  retrying: boolean;
  revealed: boolean;
  selected: number | null;
  setId: string;
  skipped: number[];
  started: boolean;
  tasks: PracticeTask[];
  wrong: number[];
}) {
  const [persistence, setPersistence] = useState<DraftPersistence>("idle");
  useEffect(() => {
    if (!started) return;
    if (complete) {
      try {
        localStorage.removeItem(practiceStorageKey());
        setPersistence("idle");
      } catch {
        setPersistence("error");
      }
      return;
    }
    const entryIds = entries.map((entry) => entry.id);
    if (!entryIds.length) return;
    const snapshot: PracticeSessionSnapshot = {
      schemaVersion: 5,
      meaningChoices: Object.fromEntries(
        entries.flatMap((entry) =>
          entry.kind === "question" && entry.task === "meaning"
            ? [
                [
                  entry.id,
                  {
                    options: entry.item.options,
                    answerIndex: entry.item.answerIndex,
                  },
                ],
              ]
            : [],
        ),
      ),
      tasks,
      setId,
      amount,
      index,
      correct,
      wrong,
      skipped,
      marked,
      selected,
      revealed,
      difficulty,
      entryIds,
      failedSenseIds,
      retrying,
      answerChoices: entries.map(
        (_, position) => answerChoices[position] ?? null,
      ),
    };
    try {
      localStorage.setItem(practiceStorageKey(), JSON.stringify(snapshot));
      setPersistence("saved");
    } catch {
      setPersistence("error");
    }
  }, [
    amount,
    answerChoices,
    complete,
    correct,
    difficulty,
    entries,
    failedSenseIds,
    index,
    marked,
    retrying,
    revealed,
    selected,
    setId,
    skipped,
    started,
    tasks,
    wrong,
  ]);
  return persistence;
}

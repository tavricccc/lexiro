"use client";

import { useEffect } from "react";

import {
  PRACTICE_SESSION_STORAGE_KEY,
} from "@/constants";
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
    const raw = localStorage.getItem(PRACTICE_SESSION_STORAGE_KEY);
    const saved = parsePracticeSession(raw);
    if (!saved) {
      if (raw) localStorage.removeItem(PRACTICE_SESSION_STORAGE_KEY);
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
    );
    const outOfScope = entries?.some(
      (entry) =>
        !allowed.has(
          entry.kind === "card" ? entry.word.id : entry.item.senseId,
        ),
    );
    if (!entries || outOfScope || (saved.setId && !setIds.has(saved.setId))) {
      localStorage.removeItem(PRACTICE_SESSION_STORAGE_KEY);
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
  useEffect(() => {
    if (!started) return;
    if (complete) {
      localStorage.removeItem(PRACTICE_SESSION_STORAGE_KEY);
      return;
    }
    const entryIds = entries.map((entry) => entry.id);
    if (!entryIds.length) return;
    const snapshot: PracticeSessionSnapshot = {
      schemaVersion: 3,
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
    localStorage.setItem(
      PRACTICE_SESSION_STORAGE_KEY,
      JSON.stringify(snapshot),
    );
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
}

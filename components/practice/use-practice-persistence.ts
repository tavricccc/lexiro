"use client";

import type { Dispatch, SetStateAction } from "react";
import { useEffect } from "react";

import {
  orderPracticeTasks,
  PRACTICE_PREFERENCES_STORAGE_KEY,
  PRACTICE_SESSION_STORAGE_KEY,
  isPracticeTask,
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
  sessionRestored,
  setIds,
  onRestore,
}: {
  allQuestionItems: QuestionItem[];
  allStudyItems: StudyWord[];
  enabled: boolean;
  initialSet: string;
  memberships: Record<string, SetMembership[]>;
  restoreAttempted: { current: boolean };
  sessionRestored: { current: boolean };
  setIds: Set<string>;
  onRestore: (
    snapshot: PracticeSessionSnapshot,
    entries: PracticeEntry[],
  ) => void;
}) {
  useEffect(() => {
    if (restoreAttempted.current || !enabled) return;
    restoreAttempted.current = true;
    const raw = localStorage.getItem(PRACTICE_SESSION_STORAGE_KEY);
    const saved = parsePracticeSession(raw);
    if (!saved) {
      if (raw) localStorage.removeItem(PRACTICE_SESSION_STORAGE_KEY);
      return;
    }
    if (!canRestorePracticeSession(saved, initialSet)) return;

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
      return;
    }
    sessionRestored.current = true;
    onRestore(saved, entries);
  }, [
    allQuestionItems,
    allStudyItems,
    enabled,
    initialSet,
    memberships,
    onRestore,
    restoreAttempted,
    sessionRestored,
    setIds,
  ]);
}

interface PreferenceValues {
  amount: number;
  difficulty: WorkspaceQuestionDifficulty;
  leechOnly: boolean;
  setId: string;
  tasks: PracticeTask[];
}

type ValueSetter<T> = Dispatch<SetStateAction<T>>;

export function usePracticePreferences({
  initialSet,
  learningLoaded,
  started,
  values,
  setAmount,
  setDifficulty,
  setLeechOnly,
  setSetId,
  setTasks,
}: {
  initialSet: string;
  learningLoaded: boolean;
  started: boolean;
  values: PreferenceValues;
  setAmount: ValueSetter<number>;
  setDifficulty: ValueSetter<WorkspaceQuestionDifficulty>;
  setLeechOnly: ValueSetter<boolean>;
  setSetId: ValueSetter<string>;
  setTasks: ValueSetter<PracticeTask[]>;
}) {
  const { amount, difficulty, leechOnly, setId, tasks } = values;
  useEffect(() => {
    if (!learningLoaded || started) return;
    try {
      const saved = JSON.parse(
        localStorage.getItem(PRACTICE_PREFERENCES_STORAGE_KEY) ?? "{}",
      ) as Partial<PreferenceValues>;
      if (!initialSet && saved.setId) setSetId(saved.setId);
      if (saved.amount) setAmount(saved.amount);
      if (saved.difficulty) setDifficulty(saved.difficulty);
      if (typeof saved.leechOnly === "boolean") setLeechOnly(saved.leechOnly);
      const savedTasks = Array.isArray(saved.tasks)
        ? orderPracticeTasks(saved.tasks.filter(isPracticeTask))
        : [];
      if (savedTasks.length) setTasks(savedTasks);
    } catch {
      // Corrupted preferences should never block practice.
    }
  }, [
    initialSet,
    learningLoaded,
    setAmount,
    setDifficulty,
    setLeechOnly,
    setSetId,
    setTasks,
    started,
  ]);

  useEffect(() => {
    if (started) return;
    localStorage.setItem(
      PRACTICE_PREFERENCES_STORAGE_KEY,
      JSON.stringify({ amount, difficulty, leechOnly, setId, tasks }),
    );
  }, [amount, difficulty, leechOnly, setId, started, tasks]);
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

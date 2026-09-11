import type {
  PracticeSessionSnapshot,
  PracticeTask,
  WorkspaceQuestionDifficulty,
} from "@/types";
import { isPracticeTask, orderPracticeTasks } from "../constants/practice";
import { asSenseId } from "./library";
import { isRecord } from "./schema";

const DIFFICULTIES = new Set<WorkspaceQuestionDifficulty>([
  "all",
  "1",
  "2",
  "3",
]);

/** A 文意選填 bank runs to ten options, so a stored choice can reach index 9. */
const MAX_OPTION_INDEX = 9;

function isIntegerArray(value: unknown, upperBound: number): value is number[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) => Number.isInteger(item) && item >= 0 && item < upperBound,
    ) &&
    new Set(value).size === value.length
  );
}

/**
 * Reads back an interrupted session.
 *
 * Only version 3 is accepted. Earlier snapshots described a session as a single
 * mode with one kind of item in it, which the mixed queue has no faithful
 * translation for; the cost of dropping one is re-picking a session, and no
 * learning data lives here.
 */
export function parsePracticeSession(
  raw: string | null,
): PracticeSessionSnapshot | null {
  if (!raw) return null;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value) || value.schemaVersion !== 3) return null;

  const entryIds = value.entryIds;
  const rawTasks = value.tasks;
  const difficulty = value.difficulty;
  if (
    !Array.isArray(entryIds) ||
    entryIds.length === 0 ||
    entryIds.length > 100 ||
    !entryIds.every((item) => typeof item === "string" && item.trim()) ||
    new Set(entryIds).size !== entryIds.length ||
    !Array.isArray(rawTasks) ||
    rawTasks.length === 0 ||
    !rawTasks.every(isPracticeTask) ||
    typeof difficulty !== "string" ||
    !DIFFICULTIES.has(difficulty as WorkspaceQuestionDifficulty) ||
    typeof value.setId !== "string" ||
    !Number.isInteger(value.amount) ||
    Number(value.amount) < 1 ||
    Number(value.amount) > 100 ||
    !Number.isInteger(value.index) ||
    Number(value.index) < 0 ||
    Number(value.index) >= entryIds.length ||
    !Number.isInteger(value.correct) ||
    Number(value.correct) < 0 ||
    Number(value.correct) >
      Number(value.index) + (value.selected === null ? 0 : 1) ||
    (value.selected !== null &&
      (!Number.isInteger(value.selected) ||
        Number(value.selected) < 0 ||
        Number(value.selected) > MAX_OPTION_INDEX)) ||
    typeof value.revealed !== "boolean" ||
    typeof value.retrying !== "boolean" ||
    !Array.isArray(value.failedSenseIds) ||
    !value.failedSenseIds.every(
      (item) => typeof item === "string" && item.trim(),
    ) ||
    new Set(value.failedSenseIds).size !== value.failedSenseIds.length ||
    !isIntegerArray(value.wrong, entryIds.length) ||
    !isIntegerArray(value.skipped, entryIds.length) ||
    !isIntegerArray(value.marked, entryIds.length)
  ) {
    return null;
  }

  const rawAnswerChoices = value.answerChoices;
  if (
    rawAnswerChoices !== undefined &&
    (!Array.isArray(rawAnswerChoices) ||
      rawAnswerChoices.length > entryIds.length ||
      rawAnswerChoices.some(
        (item) =>
          item !== null &&
          (!Number.isInteger(item) || item < 0 || item > MAX_OPTION_INDEX),
      ))
  ) {
    return null;
  }

  return {
    schemaVersion: 3,
    tasks: orderPracticeTasks(rawTasks as PracticeTask[]),
    setId: value.setId,
    amount: Number(value.amount),
    index: Number(value.index),
    correct: Number(value.correct),
    wrong: value.wrong,
    skipped: value.skipped,
    marked: value.marked,
    selected: value.selected === null ? null : Number(value.selected),
    revealed: value.revealed,
    difficulty: difficulty as WorkspaceQuestionDifficulty,
    entryIds,
    failedSenseIds: value.failedSenseIds.map(asSenseId),
    retrying: value.retrying,
    answerChoices: entryIds.map((_, position) =>
      Array.isArray(rawAnswerChoices)
        ? (rawAnswerChoices[position] ?? null)
        : null,
    ),
  };
}

/**
 * A session started inside one set is only offered back on that set's route,
 * so opening a different set does not resume somebody else's queue.
 */
export function canRestorePracticeSession(
  snapshot: PracticeSessionSnapshot,
  initialSet: string,
): boolean {
  return initialSet ? snapshot.setId === initialSet : true;
}

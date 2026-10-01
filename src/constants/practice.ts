import type {
  PracticeCardTask,
  PracticeQuestionTask,
  PracticeTask,
} from "../types/session";

/** Spelling keeps the scheduled pool; all formats share one setup and queue. */
export const PRACTICE_CARD_TASKS: PracticeCardTask[] = ["spelling"];

/** Question formats, in 學測 paper order. */
export const PRACTICE_QUESTION_TASKS: PracticeQuestionTask[] = [
  "meaning",
  "vocabulary",
  "grammar",
  "cloze",
  "wordBank",
  "discourse",
  "reading",
];

export const PRACTICE_TASKS: PracticeTask[] = [
  "meaning",
  ...PRACTICE_CARD_TASKS,
  ...PRACTICE_QUESTION_TASKS.filter((task) => task !== "meaning"),
];

export const DEFAULT_CARD_TASKS: PracticeTask[] = ["meaning"];
export const DEFAULT_QUESTION_TASKS: PracticeQuestionTask[] = [
  ...PRACTICE_QUESTION_TASKS,
];

export function isPracticeTask(value: unknown): value is PracticeTask {
  return (
    typeof value === "string" && PRACTICE_TASKS.includes(value as PracticeTask)
  );
}

export function isCardTask(task: PracticeTask): task is PracticeCardTask {
  return PRACTICE_CARD_TASKS.includes(task as PracticeCardTask);
}

/** Keeps a task list in the canonical order, de-duplicated. */
export function orderPracticeTasks(
  tasks: readonly PracticeTask[],
): PracticeTask[] {
  return PRACTICE_TASKS.filter((task) => tasks.includes(task));
}

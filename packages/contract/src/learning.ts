import { z } from "zod";
import { QUESTION_KINDS } from "./formats";

/** What a practice round can ask: the two word tasks plus every stored question kind. */
export const PRACTICE_TASKS = ["meaning", "reverse", ...QUESTION_KINDS] as const;
export type PracticeTask = (typeof PRACTICE_TASKS)[number];

export const DAILY_GOALS = [10, 20, 30] as const;
export type DailyGoal = (typeof DAILY_GOALS)[number];
/** 0 new, 1 seen, 2 familiar, 3 mastered. */
export type Familiarity = 0 | 1 | 2 | 3;

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const answerInput = z.strictObject({
  senseId: z.string().min(1).max(80),
  wordId: z.string().min(1).max(80),
  task: z.enum(PRACTICE_TASKS),
  correct: z.boolean(),
  /** The learner's calendar day, so streaks follow their time zone. */
  day,
});
export type LearningAnswer = z.infer<typeof answerInput>;

/** One device's queued answers. The batch id makes a resend harmless. */
export const answerBatch = z.strictObject({
  batchId: z.uuid(),
  answers: z.array(answerInput).min(1).max(500),
});
export type AnswerBatch = z.infer<typeof answerBatch>;

export const goalInput = z.strictObject({ goal: z.union([z.literal(10), z.literal(20), z.literal(30)]) });

export interface Tally {
  answered: number;
  correct: number;
}
export interface SenseProgress extends Tally {
  wordId: string;
  level: Familiarity;
  lastDay: string;
}
export interface Learning {
  goal: DailyGoal;
  days: Record<string, Tally>;
  senses: Record<string, SenseProgress>;
  tasks: Record<string, Tally>;
}

export const emptyLearning = (): Learning => ({ goal: 20, days: {}, senses: {}, tasks: {} });

/** A right answer raises familiarity one step, a wrong one lowers it. */
export const nextLevel = (level: number, correct: boolean): Familiarity =>
  Math.max(0, Math.min(3, level + (correct ? 1 : -1))) as Familiarity;

const add = (tally: Tally | undefined, correct: boolean): Tally => ({
  answered: (tally?.answered ?? 0) + 1,
  correct: (tally?.correct ?? 0) + Number(correct),
});

/** Applies answers in order. The server and the offline queue use the same rule. */
export function applyAnswers(learning: Learning, answers: readonly LearningAnswer[]): Learning {
  const next: Learning = { goal: learning.goal, days: { ...learning.days }, senses: { ...learning.senses }, tasks: { ...learning.tasks } };
  for (const answer of answers) {
    next.days[answer.day] = add(next.days[answer.day], answer.correct);
    next.tasks[answer.task] = add(next.tasks[answer.task], answer.correct);
    const previous = next.senses[answer.senseId];
    next.senses[answer.senseId] = {
      ...add(previous, answer.correct),
      wordId: answer.wordId,
      level: nextLevel(previous?.level ?? 0, answer.correct),
      lastDay: previous && previous.lastDay > answer.day ? previous.lastDay : answer.day,
    };
  }
  return next;
}

/** The local calendar day of a date, `YYYY-MM-DD`. */
export function calendarDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Date-only arithmetic in UTC, so DST and time-zone changes do not shift the day. */
export function shiftDay(value: string, amount: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

/** Consecutive days with at least one answer, ending today or yesterday. */
export function streak(days: Record<string, Tally>, today: string): number {
  let cursor = days[today]?.answered ? today : shiftDay(today, -1);
  let count = 0;
  while (days[cursor]?.answered) {
    count += 1;
    cursor = shiftDay(cursor, -1);
  }
  return count;
}

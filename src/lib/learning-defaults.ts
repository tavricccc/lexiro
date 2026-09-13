import type {
  DailyActivity,
  DashboardStats,
  QuestionStatKey,
  QuestionStats,
  QuestionStatTotals,
  QuestionStatType,
} from "@/types";
import {
  DAILY_QUESTION_GOAL_OPTIONS,
  DAILY_WORD_GOAL_OPTIONS,
  MAX_STREAK_FREEZES,
  STREAK_FREEZE_EARNED_EVERY_DAYS,
} from "@/constants";
import { localDateKey } from "./date";

const QUESTION_STAT_TYPES: QuestionStatType[] = [
  "vocabulary",
  "grammar",
  "cloze",
  "wordBank",
  "discourse",
  "reading",
];

export const QUESTION_STAT_KEYS: QuestionStatKey[] =
  QUESTION_STAT_TYPES.flatMap((type) =>
    ([1, 2, 3] as const).map((level) => `${type}:${level}` as QuestionStatKey),
  );

export function emptyQuestionStats(): QuestionStatTotals {
  return {};
}

const EMPTY_ROW: QuestionStats = { total: 0, correct: 0, retry: 0 };

/** Reads a row that may not have been practised yet. */
export function questionStatRow(
  totals: QuestionStatTotals,
  key: QuestionStatKey,
): QuestionStats {
  return totals[key] ?? EMPTY_ROW;
}

/** Adds one attempt to a sparse row, creating it on first use. */
export function addQuestionAttempt(
  totals: QuestionStatTotals,
  key: QuestionStatKey,
  correct: boolean,
  retry: boolean,
): QuestionStatTotals {
  const row = questionStatRow(totals, key);
  return {
    ...totals,
    [key]: {
      total: row.total + 1,
      correct: row.correct + (correct ? 1 : 0),
      retry: row.retry + (retry ? 1 : 0),
    },
  };
}

/**
 * How much day-by-day history is kept.
 *
 * The chart draws a fortnight, the weekly readout a week, and the streak is a
 * counter that needs no history at all. Four hundred days was a year of rows
 * nothing ever read, in both IndexedDB and the cloud statistics document.
 */
export const DAILY_HISTORY_RETENTION_DAYS = 90;

export function pruneDailyHistory(
  history: DashboardStats["dailyHistory"],
  today: string,
  retentionDays = DAILY_HISTORY_RETENTION_DAYS,
): DashboardStats["dailyHistory"] {
  const cutoff = new Date(`${today}T00:00:00.000Z`);
  if (Number.isNaN(cutoff.getTime())) return history;
  cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
  const earliest = cutoff.toISOString().slice(0, 10);
  const kept = Object.entries(history).filter(([date]) => date >= earliest);
  return kept.length === Object.keys(history).length
    ? history
    : Object.fromEntries(kept);
}

export function emptyDailyActivity(date: string): DailyActivity {
  return { date, memoryAgain: 0, memoryGood: 0, questionTotal: 0 };
}

/** Whether anything at all was answered on a given day. */
export function wasActive(activity: DailyActivity): boolean {
  return (
    activity.memoryAgain + activity.memoryGood + activity.questionTotal > 0
  );
}

/**
 * How many of the last `days` days, today included, were practised at all.
 *
 * A weekly count answers a different question from the streak: the streak says
 * whether you have kept going, this says how much of the week you showed up
 * for, and a missed Tuesday does not erase it.
 */
export function countActiveDays(
  history: DashboardStats["dailyHistory"],
  days: number,
  today = new Date(),
): number {
  let count = 0;
  for (let offset = 0; offset < days; offset += 1) {
    const day = new Date(today);
    day.setDate(day.getDate() - offset);
    const activity = history[localDateKey(day)];
    if (activity && wasActive(activity)) count += 1;
  }
  return count;
}

function daysBetween(date: string, today: Date): number {
  for (let offset = 1; offset <= 2; offset += 1) {
    const day = new Date(today);
    day.setDate(day.getDate() - offset);
    if (localDateKey(day) === date) return offset;
  }
  return Number.POSITIVE_INFINITY;
}

/**
 * Rolls the statistics over to today, which happens the first time anything is
 * answered on a new day.
 *
 * Missing exactly one day spends a day back rather than resetting the streak,
 * and every full week of practice earns one, up to a small reserve. That is the
 * whole of the streak's economy: nothing to buy, nothing to lose by forgetting
 * once, and a long run that a single bad day is not a reason to abandon.
 */
export function rollStatsToToday(
  stats: DashboardStats,
  now = new Date(),
): DashboardStats {
  const today = localDateKey(now);
  if (stats.lastStudyDate === today) return stats;
  const repaired =
    daysBetween(stats.lastStudyDate, now) === 2 && stats.streakFreezes > 0;
  const continues = daysBetween(stats.lastStudyDate, now) === 1 || repaired;
  const streakDays = continues ? stats.streakDays + 1 : 1;
  const spent = repaired ? stats.streakFreezes - 1 : stats.streakFreezes;
  return {
    ...stats,
    streakDays,
    longestStreak: Math.max(stats.longestStreak, streakDays),
    streakFreezes:
      streakDays % STREAK_FREEZE_EARNED_EVERY_DAYS === 0
        ? Math.min(MAX_STREAK_FREEZES, spent + 1)
        : spent,
    lastStudyDate: today,
    todayMemoryReviews: 0,
    todayMemoryCorrectReviews: 0,
    todayQuestionReviews: 0,
    todayQuestionCorrectReviews: 0,
    dailyHistory: pruneDailyHistory(stats.dailyHistory, today),
  };
}

/** Folds several senses' breakdowns into one, for a set or for the whole account. */
export function sumQuestionStats(
  rows: Iterable<QuestionStatTotals>,
): QuestionStatTotals {
  const totals: QuestionStatTotals = {};
  for (const row of rows)
    for (const key of Object.keys(row) as QuestionStatKey[]) {
      const before = questionStatRow(totals, key);
      const incoming = questionStatRow(row, key);
      totals[key] = {
        total: before.total + incoming.total,
        correct: before.correct + incoming.correct,
        retry: before.retry + incoming.retry,
      };
    }
  return totals;
}

export function createDefaultStats(): DashboardStats {
  return {
    totalMemoryReviews: 0,
    correctMemoryReviews: 0,
    totalQuestionReviews: 0,
    correctQuestionReviews: 0,
    streakDays: 0,
    longestStreak: 0,
    streakFreezes: 0,
    lastStudyDate: "",
    dailyWordGoal: DAILY_WORD_GOAL_OPTIONS[0],
    dailyQuestionGoal: DAILY_QUESTION_GOAL_OPTIONS[0],
    todayMemoryReviews: 0,
    todayMemoryCorrectReviews: 0,
    todayQuestionReviews: 0,
    todayQuestionCorrectReviews: 0,
    questionStatsBySense: {},
    dailyHistory: {},
    updatedAt: new Date().toISOString(),
  };
}

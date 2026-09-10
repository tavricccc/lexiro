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
} from "@/constants";

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
 * How much day-by-day history is kept. The progress page charts the last two
 * weeks and the streak only needs yesterday, so an unbounded history was pure
 * growth in both IndexedDB and the cloud stats document.
 */
export const DAILY_HISTORY_RETENTION_DAYS = 400;

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
  return {
    date,
    memoryAgain: 0,
    memoryGood: 0,
    questionTotal: 0,
    questionCorrect: 0,
    questionRetry: 0,
    xpEarned: 0,
    completed: false,
    questionStats: emptyQuestionStats(),
  };
}

export function createDefaultStats(): DashboardStats {
  return {
    totalMemoryReviews: 0,
    correctMemoryReviews: 0,
    totalQuestionReviews: 0,
    correctQuestionReviews: 0,
    streakDays: 0,
    longestStreak: 0,
    xp: 0,
    level: 1,
    lastStudyDate: "",
    dailyWordGoal: DAILY_WORD_GOAL_OPTIONS[0],
    dailyQuestionGoal: DAILY_QUESTION_GOAL_OPTIONS[0],
    todayMemoryReviews: 0,
    todayMemoryCorrectReviews: 0,
    todayQuestionReviews: 0,
    todayQuestionCorrectReviews: 0,
    questionStats: emptyQuestionStats(),
    questionStatsBySense: {},
    dailyHistory: {},
    updatedAt: new Date().toISOString(),
  };
}

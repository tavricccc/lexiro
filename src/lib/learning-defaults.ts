import type { DailyActivity, DashboardStats, QuestionStatKey, QuestionStats } from '@/types'
import { DAILY_QUESTION_GOAL_OPTIONS, DAILY_WORD_GOAL_OPTIONS } from '@/constants'

export const QUESTION_STAT_KEYS: QuestionStatKey[] = [
  'standard:1',
  'standard:2',
  'standard:3',
  'fillBlank:1',
  'fillBlank:2',
  'fillBlank:3',
  'reading:1',
  'reading:2',
  'reading:3',
]

export function emptyQuestionStats(): Record<QuestionStatKey, QuestionStats> {
  return Object.fromEntries(QUESTION_STAT_KEYS.map(key => [key, { total: 0, correct: 0, retry: 0 }])) as Record<QuestionStatKey, QuestionStats>
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
  }
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
    lastStudyDate: '',
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
  }
}

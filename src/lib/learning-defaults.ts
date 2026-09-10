import type { DailyActivity, DashboardStats, QuestionStatKey, QuestionStats, QuestionStatType } from '@/types'
import { DAILY_QUESTION_GOAL_OPTIONS, DAILY_WORD_GOAL_OPTIONS } from '@/constants'

const QUESTION_STAT_TYPES: QuestionStatType[] = ['vocabulary', 'grammar', 'cloze', 'wordBank', 'discourse', 'reading']

export const QUESTION_STAT_KEYS: QuestionStatKey[] = QUESTION_STAT_TYPES.flatMap(
  type => ([1, 2, 3] as const).map(level => `${type}:${level}` as QuestionStatKey),
)

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

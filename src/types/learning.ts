import type { StudyWord } from './library'

export type ReviewRating = 'again' | 'good'
export type QuestionStatType = 'standard' | 'fillBlank' | 'reading'
export type QuestionStatKey = `${QuestionStatType}:${1 | 2 | 3}`

export interface QuestionStats {
  total: number
  correct: number
  retry: number
}

export interface DailyActivity {
  date: string
  memoryAgain: number
  memoryGood: number
  questionTotal: number
  questionCorrect: number
  questionRetry: number
  xpEarned: number
  completed: boolean
  questionStats: Record<QuestionStatKey, QuestionStats>
}

export interface CardProgress {
  due: string
  stability: number
  difficulty: number
  elapsedDays: number
  scheduledDays: number
  learningSteps: number
  reps: number
  lapses: number
  state: number
  lastReview?: string
  reviewCount: number
  correctCount: number
}

export interface LearningProgress {
  cards: Record<string, CardProgress>
  updatedAt: string
}

export interface DashboardStats {
  totalMemoryReviews: number
  correctMemoryReviews: number
  totalQuestionReviews: number
  correctQuestionReviews: number
  streakDays: number
  longestStreak: number
  xp: number
  level: number
  lastStudyDate: string
  dailyWordGoal: number
  dailyQuestionGoal: number
  todayMemoryReviews: number
  todayMemoryCorrectReviews: number
  todayQuestionReviews: number
  todayQuestionCorrectReviews: number
  questionStats: Record<QuestionStatKey, QuestionStats>
  questionStatsBySense: Record<string, Record<QuestionStatKey, QuestionStats>>
  dailyHistory: Record<string, DailyActivity>
  updatedAt: string
}

export interface ReviewEntry {
  setId: string
  item: StudyWord
  progress: CardProgress | null
}

export type SyncStatus = 'disabled' | 'signed-out' | 'connecting' | 'syncing' | 'synced' | 'offline' | 'error'

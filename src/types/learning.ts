import type { SenseId, StudyWord } from './library'

export type ReviewRating = 'again' | 'good'
import type { GeneratedQuestionKind } from './library'

/** Stats are kept per exam format, so the progress page mirrors a real paper. */
export type QuestionStatType = GeneratedQuestionKind
export type QuestionStatKey = `${QuestionStatType}:${1 | 2 | 3}`

export interface QuestionStats {
  total: number
  correct: number
  retry: number
}

/**
 * Sparse by design: a row appears only after that format and difficulty has
 * been practised. The dense shape stored eighteen rows for every sense and
 * every day, which dominated the size of the cloud stats document.
 */
export type QuestionStatTotals = Partial<Record<QuestionStatKey, QuestionStats>>

export interface DailyActivity {
  date: string
  memoryAgain: number
  memoryGood: number
  questionTotal: number
  questionCorrect: number
  questionRetry: number
  xpEarned: number
  completed: boolean
  questionStats: QuestionStatTotals
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
  cards: Record<SenseId, CardProgress>
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
  questionStats: QuestionStatTotals
  questionStatsBySense: Record<SenseId, QuestionStatTotals>
  dailyHistory: Record<string, DailyActivity>
  updatedAt: string
}

export interface ReviewEntry {
  setId: string
  item: StudyWord
  progress: CardProgress | null
}

/**
 * What the sync indicator can say. Six further states used to be declared here
 * — preparing, downloading, reconciling, uploading, retrying, verifying — that
 * nothing ever set; the indicator matched on them and they never arrived.
 */
export type SyncStatus = 'disabled' | 'signed-out' | 'connecting' | 'syncing' | 'synced' | 'offline' | 'error'

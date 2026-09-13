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

/**
 * One day on the activity chart, and nothing else.
 *
 * It used to carry a correct count, a retry count, an experience total, a
 * completion flag and its own sparse question breakdown — up to eighteen more
 * rows — none of which anything read. Every running total it duplicated already
 * lives on the statistics themselves.
 */
export interface DailyActivity {
  date: string
  memoryAgain: number
  memoryGood: number
  questionTotal: number
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
  /**
   * Days back the streak can spend to survive one missed day. A week of
   * unbroken practice earns one, so the streak is protected by the behaviour it
   * is there to encourage — and a single bad day stops being a reason to give
   * up on it altogether.
   */
  streakFreezes: number
  lastStudyDate: string
  dailyWordGoal: number
  dailyQuestionGoal: number
  todayMemoryReviews: number
  todayMemoryCorrectReviews: number
  todayQuestionReviews: number
  todayQuestionCorrectReviews: number
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

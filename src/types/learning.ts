import type { VocabItem } from './set'

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy'

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
  setId: string
  cards: Record<string, CardProgress>
  updatedAt: string
}

export interface Achievement {
  id: string
  titleKey: string
  descriptionKey: string
  unlockedAt: string
}

export interface DashboardStats {
  totalReviews: number
  correctReviews: number
  streakDays: number
  longestStreak: number
  xp: number
  level: number
  lastStudyDate: string
  dailyGoal: number
  dailyWordGoal: number
  dailyQuestionGoal: number
  todayReviews: number
  todayCorrectReviews: number
  todayLearningReviews: number
  todayLearningCorrectReviews: number
  todayQuestionReviews: number
  todayQuestionCorrectReviews: number
  achievements: Achievement[]
  updatedAt: string
}

export interface ReviewEntry {
  setId: string
  item: VocabItem
  progress: CardProgress | null
}

export type SyncStatus = 'disabled' | 'signed-out' | 'connecting' | 'syncing' | 'synced' | 'offline' | 'error'

import type { DashboardStats, LearningProgress } from './learning'
import type { VocabSet } from './set'

export interface FirestoreSetDoc extends VocabSet {
  ownerId: string
  schemaVersion: number
  checksum: string
  updatedAt: string
}

export interface FirestoreProgressDoc extends LearningProgress {
  ownerId: string
  schemaVersion: number
}

export interface FirestoreStatsDoc extends DashboardStats {
  ownerId: string
  schemaVersion: number
}

export interface FirestoreDailyStatsDoc {
  date: string
  reviews: number
  correctReviews: number
  xpEarned: number
  updatedAt: string
  ownerId: string
  schemaVersion: number
}

export interface SetSyncConflict {
  setId: string
  setName: string
  local: VocabSet
  remote: FirestoreSetDoc
}

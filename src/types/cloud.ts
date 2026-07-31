import type { DashboardStats, LearningProgress } from './learning'
import type { LibraryQuestion, VocabFolder, VocabSetMember, WordEntry } from './library'
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

export interface FirestoreLibraryChunkBase {
  ownerId: string
  schemaVersion: number
  chunkId: string
  updatedAt: string
  checksum: string
}

export type FirestoreLibraryChunk = FirestoreLibraryChunkBase & (
  | { section: 'words', items: WordEntry[] }
  | { section: 'memberships', items: { setId: string, members: VocabSetMember[] }[] }
  | { section: 'folders', items: VocabFolder[] }
  | { section: 'questions', items: LibraryQuestion[] }
)

export interface SetSyncConflict {
  setId: string
  setName: string
  local: VocabSet
  remote: FirestoreSetDoc
}

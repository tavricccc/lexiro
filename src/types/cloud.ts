import type { AiSettings } from './ai'
import type { DashboardStats, LearningProgress } from './learning'
import type { LibraryQuestion, LibrarySet, SetMembership, VocabFolder, WordEntry } from './library'

export interface FirestoreProgressDoc extends LearningProgress {
  ownerId: string
  schemaVersion: number
}

export interface FirestoreStatsDoc extends DashboardStats {
  ownerId: string
  schemaVersion: number
}

export type FirestoreAiSettingsDoc = Omit<AiSettings, 'apiKey'> & {
  ownerId: string
  schemaVersion: number
  updatedAt: string
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
  | { section: 'sets', items: LibrarySet[] }
  | { section: 'memberships', items: { setId: string, members: SetMembership[] }[] }
  | { section: 'folders', items: VocabFolder[] }
  | { section: 'questions', items: LibraryQuestion[] }
)

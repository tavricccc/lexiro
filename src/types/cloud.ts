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

export interface FirestoreLibraryManifest {
  ownerId: string
  schemaVersion: number
  documentType: 'library-manifest'
  updatedAt: string
  revision: string
  chunks: Record<string, string>
}

export interface FirestoreLibraryV5Manifest extends FirestoreLibraryManifest {
  schemaVersion: 5
  manifestParts?: Record<string, string>
}

export interface FirestoreLibraryManifestPart {
  ownerId: string
  schemaVersion: 5
  documentType: 'library-manifest-part'
  partId: string
  updatedAt: string
  checksum: string
  chunks: Record<string, string>
}

export type FirestoreLibraryV5Chunk = FirestoreLibraryChunkBase & {
  schemaVersion: 5
  section: 'words' | 'sets' | 'memberships' | 'folders' | 'questions'
  items: unknown[]
}

export type FirestoreLibraryChunk = FirestoreLibraryChunkBase & (
  | { section: 'words', items: WordEntry[] }
  | { section: 'sets', items: LibrarySet[] }
  | { section: 'memberships', items: { setId: string, members: SetMembership[] }[] }
  | { section: 'folders', items: VocabFolder[] }
  | { section: 'questions', items: LibraryQuestion[] }
)

export type SyncProgressPhase = 'preparing' | 'downloading' | 'reconciling' | 'uploading' | 'verifying' | 'synced' | 'offline' | 'error'
export type SyncDirection = 'idle' | 'download' | 'upload'

export interface SyncProgressState {
  phase: SyncProgressPhase
  direction: SyncDirection
  completed: number
  total: number
  percent: number
  message: string
  retryable: boolean
  currentBatch: number
  totalBatches: number
  pendingWrites: number
}

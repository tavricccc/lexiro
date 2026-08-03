import type { AiSettings } from './ai'
import type { DashboardStats, LearningProgress } from './learning'
import type { LibraryQuestion, LibrarySet, SetMembership, VocabFolder, WordEntry } from './library'

export interface FirestoreProgressDoc extends LearningProgress {
  ownerId: string
  schemaVersion: 5
}

export interface FirestoreStatsDoc extends DashboardStats {
  ownerId: string
  schemaVersion: 5
}

export type FirestoreAiSettingsDoc = Omit<AiSettings, 'apiKey'> & {
  ownerId: string
  schemaVersion: 5
  updatedAt: string
}

export interface FirestoreSyncHeadDoc {
  ownerId: string
  schemaVersion: 5
  updatedAt: string
  libraryRevision: string
  progressHash: string
  statsHash: string
  settingsHash: string
}

export interface FirestoreLibraryChunkBase {
  ownerId: string
  schemaVersion: 5
  chunkId: string
  updatedAt: string
  checksum: string
}

export interface FirestoreLibraryManifest {
  ownerId: string
  schemaVersion: 5
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

export type SyncProgressPhase = 'preparing' | 'downloading' | 'reconciling' | 'uploading' | 'retrying' | 'verifying' | 'synced' | 'offline' | 'error'
export type SyncDirection = 'idle' | 'download' | 'upload'
export type SyncPresentation = 'blocking' | 'background'

export type SyncAfterLocalCommitResult
  = | { status: 'cloud-synced', localPersisted: true, cloudSynced: true, pendingWrites: 0 }
    | { status: 'queued', localPersisted: true, cloudSynced: false, pendingWrites: number }

export interface SyncProgressState {
  presentation: SyncPresentation
  accountId: string
  epoch: number
  operationId: string
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
  stalled: boolean
  retryAttempt: number
  maxRetryAttempts: number
  activeRequests: number
}

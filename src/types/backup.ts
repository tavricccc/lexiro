import type { LearningRecord } from '../lib/learning-record'
import type { LibraryQuestion, LibrarySet, LibraryState, SetMembership, WordEntry } from './library'

export interface SharedSet extends LibrarySet {
  words: WordEntry[]
  memberships: SetMembership[]
  questions: LibraryQuestion[]
}

export interface SetSharePayload {
  version: number
  exportedAt: string
  appName: string
  kind: 'set-share'
  sets: SharedSet[]
}

export interface FullBackupPayload {
  version: number
  exportedAt: string
  appName: string
  kind: 'full-backup'
  library: LibraryState
  /** The learning history across devices; absent in backups made before it synced. */
  learning?: LearningRecord
}

export type BackupPayload = SetSharePayload | FullBackupPayload

export interface ImportResult {
  imported: SharedSet[]
  renamed: { from: string, to: string }[]
}

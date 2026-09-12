import type { AiSettings } from './ai'
import type { DashboardStats, LearningProgress } from './learning'

/**
 * What the cloud stores.
 *
 * The Library is a collection of records — one document per folder, set,
 * membership, word or question — plus three small whole documents: review
 * schedules, statistics, and the AI setup. There is no manifest and no generation: a record is written
 * on its own and read back through a change feed ordered by `writtenAt`, which
 * the server stamps so no device can move another device's cursor.
 */
export type CloudRecordType = 'folder' | 'set' | 'membership' | 'word' | 'question'

export interface FirestoreRecordDoc {
  ownerId: string
  schemaVersion: 6
  type: CloudRecordType
  /** The Library's own id for this record: a word key, set id, folder id or question id. */
  recordKey: string
  deleted: boolean
  /** The record's own `updatedAt`, or when it was deleted. Decides conflicts. */
  updatedAt: string
  payload?: Record<string, unknown>
  /** Server-stamped. The change feed is ordered by this and nothing else. */
  writtenAt: unknown
}

/** Bumped on every push, so other devices learn there is something to pull. */
export interface FirestoreLibraryMetaDoc {
  ownerId: string
  schemaVersion: 6
  changedAt: unknown
}

export interface FirestoreProgressDoc extends LearningProgress {
  ownerId: string
  schemaVersion: 6
}

export interface FirestoreStatsDoc extends DashboardStats {
  ownerId: string
  schemaVersion: 6
}

/** Everything about the AI setup except the API key, which never leaves the device. */
export interface FirestoreAiSettingsDoc extends Omit<AiSettings, 'apiKey'> {
  ownerId: string
  schemaVersion: 6
}

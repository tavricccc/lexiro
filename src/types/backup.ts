import type { VocabSet } from './set'

export interface BackupPayload {
  version: number
  exportedAt: string
  appName: string
  sets: VocabSet[]
}

export interface ImportResult {
  imported: VocabSet[]
  skippedByName: string[]
  skippedByContent: string[]
  renamedIds: { setName: string, from: string, to: string }[]
  replacedVersions: string[]
}

export interface VersionDiff {
  setName: string
  localSetId: string
  localCount: number
  importedCount: number
  added: string[]
  removed: string[]
  changed: string[]
  identical: boolean
}

export type ImportMode = 'append' | 'overwrite'

import type { AiSettings, BackupPayload, DashboardStats, FullBackupPayload, LearningProgress, LibraryState, SetSharePayload, SharedSet } from '@/types'
import { APP_NAME, BACKUP_FILE_PREFIX, EXPORT_VERSION } from '@/constants'
import { getShareableAiSettings, loadAiSettings } from '@/lib/ai-provider'
import { cloneJson } from '@/lib/clone'
import { learningRecords, libraryRecords, recordHash, settingsRecords } from '@/lib/sync-outbox'
import { buildExportZipBuffer, parseBackupZipBufferInWorker } from '@/lib/worker'
import { normalizeFullBackupPayload, normalizeSharePayload } from './share'
import { countSharedSetSenses } from './shared-set'

export function buildExportPayload(selectedSets: SharedSet[]): BackupPayload {
  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    appName: APP_NAME,
    kind: 'set-share',
    sets: selectedSets,
  }
}

export function buildExportFileName(kind: 'share' | 'full' = 'share'): string {
  const now = new Date()
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const timePart = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
  const prefix = kind === 'full' ? `${BACKUP_FILE_PREFIX}-full` : BACKUP_FILE_PREFIX
  return `${prefix}-${datePart}-${timePart}.zip`
}

export async function buildExportZipBlob(selectedSets: SharedSet[]): Promise<Blob> {
  const plainSets = cloneJson(selectedSets)
  const payload = buildExportPayload(plainSets)
  const buffer = await buildExportZipBuffer(payload)
  return new Blob([buffer], { type: 'application/zip' })
}

export function buildFullBackupPayload(library: LibraryState, learning: LearningProgress, stats: DashboardStats, aiSettings = loadAiSettings()): FullBackupPayload {
  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    appName: APP_NAME,
    kind: 'full-backup',
    library,
    learning,
    stats,
    aiSettings: getShareableAiSettings(aiSettings),
  }
}

export async function buildFullBackupZipBlob(library: LibraryState, learning: LearningProgress, stats: DashboardStats, aiSettings = loadAiSettings()): Promise<Blob> {
  const plainPayload = cloneJson(buildFullBackupPayload(library, learning, stats, aiSettings))
  const buffer = await buildExportZipBuffer(plainPayload)
  return new Blob([buffer], { type: 'application/zip' })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export interface ParsedZip {
  payload: unknown
  kind: BackupPayload['kind']
  sets: SharedSet[]
  fullBackup: FullBackupPayload | null
  exportedAt: string
}

export function normalizeBackupPayload(value: unknown): FullBackupPayload | SetSharePayload {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('備份內容格式錯誤')
  const kind = (value as Record<string, unknown>).kind
  if (kind === 'full-backup')
    return normalizeFullBackupPayload(value)
  if (kind === 'set-share')
    return normalizeSharePayload(value)
  throw new Error('不支援的備份類型')
}

export async function parseBackupZipBuffer(buffer: ArrayBuffer): Promise<ParsedZip> {
  const parsed = await parseBackupZipBufferInWorker(buffer)
  const normalized = normalizeBackupPayload(parsed)
  return {
    payload: parsed,
    kind: normalized.kind,
    sets: normalized.kind === 'set-share' ? normalized.sets : [],
    fullBackup: normalized.kind === 'full-backup' ? normalized : null,
    exportedAt: normalized.exportedAt,
  }
}

export interface BackupPreviewData {
  exportedAt: string
  setCount: number
  wordCount: number
}

export function getBackupPreviewData(targetSets: SharedSet[], exportedAt = ''): BackupPreviewData {
  return { exportedAt, setCount: targetSets.length, wordCount: countSharedSetSenses(targetSets) }
}

export function getFullBackupPreviewData(payload: FullBackupPayload): Omit<BackupPreviewData, 'exportedAt'> {
  return { setCount: payload.library.sets.length, wordCount: Object.keys(payload.library.words).length }
}

interface RecordPreviewCounts {
  added: number
  existing: number
  conflicts: number
}

function summarizeRecords(incoming: Record<string, unknown>, current: Record<string, unknown>, prefix: string): RecordPreviewCounts {
  const counts: RecordPreviewCounts = { added: 0, existing: 0, conflicts: 0 }
  for (const [key, value] of Object.entries(incoming)) {
    if (!key.startsWith(prefix))
      continue
    if (!(key in current)) {
      counts.added += 1
      continue
    }
    counts.existing += 1
    if (recordHash(value) !== recordHash(current[key]))
      counts.conflicts += 1
  }
  return counts
}

export interface FullBackupMergePreview {
  setCount: number
  wordCount: number
  addedSets: number
  existingSets: number
  conflictingSets: number
  addedWords: number
  existingWords: number
  conflictingWords: number
  addedQuestions: number
  existingQuestions: number
  conflictingQuestions: number
  addedLearningRecords: number
  existingLearningRecords: number
  conflictingLearningRecords: number
  addedSettings: number
  existingSettings: number
  conflictingSettings: number
}

export function getFullBackupMergePreviewData(payload: FullBackupPayload, currentLibrary: LibraryState, currentLearning: LearningProgress, currentStats: DashboardStats, currentAiSettings = loadAiSettings()): FullBackupMergePreview {
  const incomingLibrary = libraryRecords(payload.library)
  const currentLibraryRecords = libraryRecords(currentLibrary)
  const incomingLearning = learningRecords(payload.learning, payload.stats)
  const currentLearningRecords = learningRecords(currentLearning, currentStats)
  const incomingSettings = settingsRecords({ ...payload.aiSettings, apiKey: '' } as AiSettings)
  const currentSettings = settingsRecords(currentAiSettings)
  const sets = summarizeRecords(incomingLibrary, currentLibraryRecords, 'set:')
  const words = summarizeRecords(incomingLibrary, currentLibraryRecords, 'word:')
  const questions = summarizeRecords(incomingLibrary, currentLibraryRecords, 'question:')
  const learning = summarizeRecords(incomingLearning, currentLearningRecords, '')
  const settings = summarizeRecords(incomingSettings, currentSettings, '')
  return {
    setCount: payload.library.sets.length,
    wordCount: Object.keys(payload.library.words).length,
    addedSets: sets.added,
    existingSets: sets.existing,
    conflictingSets: sets.conflicts,
    addedWords: words.added,
    existingWords: words.existing,
    conflictingWords: words.conflicts,
    addedQuestions: questions.added,
    existingQuestions: questions.existing,
    conflictingQuestions: questions.conflicts,
    addedLearningRecords: learning.added,
    existingLearningRecords: learning.existing,
    conflictingLearningRecords: learning.conflicts,
    addedSettings: settings.added,
    existingSettings: settings.existing,
    conflictingSettings: settings.conflicts,
  }
}

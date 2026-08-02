import type { SyncOutboxEntry, SyncRecords } from './sync-outbox'
import type { AiSettings, DashboardStats, LearningProgress, LibraryState } from '@/types'
import { defaultAiSettings, normalizeAiSettings } from './ai-provider'
import { learningStateFromRecords, libraryStateFromRecords } from './cloud-sync-schema'
import { learningRecords, libraryRecords, rebaseQueuedRecords, settingsRecords } from './sync-outbox'

export interface DomainReconcileResult<T> {
  merged: T
  baselineRecords: SyncRecords
  observedRecords: SyncRecords
  accepted: SyncOutboxEntry[]
  dirty: boolean
}

export function reconcileLibraryState(remote: LibraryState, queued: SyncOutboxEntry[]): DomainReconcileResult<LibraryState> {
  const baselineRecords = libraryRecords(remote)
  const rebased = rebaseQueuedRecords(baselineRecords, queued, 'library')
  const merged = libraryStateFromRecords(remote, rebased.records)
  return {
    merged,
    baselineRecords,
    observedRecords: libraryRecords(merged),
    accepted: rebased.accepted,
    dirty: rebased.accepted.length > 0,
  }
}

export function reconcileLearningState(progress: LearningProgress, stats: DashboardStats, queued: SyncOutboxEntry[]): DomainReconcileResult<{ progress: LearningProgress, stats: DashboardStats }> {
  const baselineRecords = learningRecords(progress, stats)
  const rebased = rebaseQueuedRecords(baselineRecords, queued, 'learning')
  const merged = learningStateFromRecords(progress, stats, rebased.records)
  return {
    merged,
    baselineRecords,
    observedRecords: learningRecords(merged.progress, merged.stats),
    accepted: rebased.accepted,
    dirty: rebased.accepted.length > 0,
  }
}

export function reconcileAiSettingsState(remote: Omit<AiSettings, 'apiKey'> | null, local: AiSettings, queued: SyncOutboxEntry[]): DomainReconcileResult<AiSettings> {
  const baselineRecords = remote ? { 'settings:ai': remote } : {}
  const rebased = rebaseQueuedRecords(baselineRecords, queued, 'settings')
  const merged = rebased.records['settings:ai'] as Omit<AiSettings, 'apiKey'> | undefined
  const mergedSettings = normalizeAiSettings({ ...defaultAiSettings, ...(merged ?? {}), apiKey: local.apiKey })
  return {
    merged: mergedSettings,
    baselineRecords,
    observedRecords: settingsRecords(mergedSettings),
    accepted: rebased.accepted,
    dirty: rebased.accepted.length > 0,
  }
}

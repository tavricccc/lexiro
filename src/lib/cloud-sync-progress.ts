import type { SyncProgressState } from '@/types'

const PHASE_RESET: Pick<SyncProgressState, 'completed' | 'total' | 'percent' | 'currentBatch' | 'totalBatches' | 'stalled' | 'retryAttempt' | 'activeRequests'> = {
  completed: 0,
  total: 0,
  percent: 0,
  currentBatch: 0,
  totalBatches: 0,
  stalled: false,
  retryAttempt: 0,
  activeRequests: 0,
}

export function updateSyncProgress(current: SyncProgressState, patch: Partial<SyncProgressState>, pendingWrites: number): SyncProgressState {
  const next = { ...current, ...patch, pendingWrites }
  const total = Math.max(0, next.total)
  next.percent = total > 0
    ? Math.round(Math.min(100, (next.completed / total) * 100))
    : next.phase === 'synced'
      ? 100
      : next.phase === 'preparing'
        ? 0
        : next.percent
  return next
}

export function transitionSyncProgress(current: SyncProgressState, phase: SyncProgressState['phase'], message: string, patch: Partial<SyncProgressState>, pendingWrites: number): SyncProgressState {
  const reset = phase === current.phase ? {} : PHASE_RESET
  return updateSyncProgress(current, { ...reset, phase, message, ...patch }, pendingWrites)
}

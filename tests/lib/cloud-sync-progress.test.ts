import type { SyncProgressState } from '@/types'
import { describe, expect, it } from 'vitest'
import { transitionSyncProgress, updateSyncProgress } from '@/lib/cloud-sync-progress'

const base: SyncProgressState = {
  presentation: 'background',
  accountId: 'account-a',
  epoch: 2,
  operationId: 'operation-a',
  phase: 'uploading',
  direction: 'upload',
  completed: 1,
  total: 4,
  percent: 25,
  message: 'uploading',
  retryable: false,
  currentBatch: 1,
  totalBatches: 4,
  pendingWrites: 2,
  stalled: true,
  retryAttempt: 1,
  maxRetryAttempts: 5,
  activeRequests: 1,
}

describe('cloud sync progress state machine', () => {
  it('derives percent and pending writes from authoritative inputs', () => {
    expect(updateSyncProgress(base, { completed: 3 }, 7)).toMatchObject({ percent: 75, pendingWrites: 7 })
  })

  it('resets transient counters when the phase changes', () => {
    expect(transitionSyncProgress(base, 'verifying', 'verifying', {}, 2)).toMatchObject({
      phase: 'verifying',
      completed: 0,
      total: 0,
      percent: 0,
      stalled: false,
      retryAttempt: 0,
      activeRequests: 0,
    })
  })

  it('preserves counters when only the current phase message changes', () => {
    expect(transitionSyncProgress(base, 'uploading', 'still uploading', {}, 2)).toMatchObject({
      completed: 1,
      total: 4,
      percent: 25,
    })
  })
})

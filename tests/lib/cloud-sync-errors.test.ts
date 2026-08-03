import { describe, expect, it } from 'vitest'
import { CloudSyncError, isRetryableSyncError, syncErrorDetails } from '@/lib/cloud-sync-errors'

describe('cloud sync errors', () => {
  it('preserves local validation codes instead of returning unknown', () => {
    const error = new CloudSyncError('cloud/schema-unsupported', 'Cloud library chunk schema 不受支援')

    expect(syncErrorDetails(error)).toEqual({
      code: 'cloud/schema-unsupported',
      context: {},
      kind: 'cloud-schema',
      message: 'Cloud library chunk schema 不受支援',
    })
    expect(isRetryableSyncError(error)).toBe(false)
  })

  it('classifies Firebase and browser failures', () => {
    expect(syncErrorDetails(new CloudSyncError('cloud/app-check-initialization', 'failed')).kind).toBe('app-check')
    expect(syncErrorDetails({ code: 'permission-denied', message: 'Missing permissions' }).kind).toBe('permission')
    expect(syncErrorDetails(new Error('net::ERR_BLOCKED_BY_CLIENT')).kind).toBe('blocked-client')
    expect(syncErrorDetails({ code: 'unavailable', message: 'Network unavailable' }).kind).toBe('network')
    expect(syncErrorDetails({ code: 'invalid-argument', message: 'Unsupported field value: undefined' }).kind).toBe('cloud-data')
  })

  it('only retries transient and unknown failures', () => {
    expect(isRetryableSyncError({ code: 'deadline-exceeded', message: 'timeout' })).toBe(true)
    expect(isRetryableSyncError({ code: 'permission-denied', message: 'denied' })).toBe(false)
    expect(isRetryableSyncError(new Error('unexpected'))).toBe(true)
  })
})

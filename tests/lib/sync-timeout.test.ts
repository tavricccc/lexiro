import { afterEach, describe, expect, it, vi } from 'vitest'
import { SyncTimeoutError, withSyncTimeout } from '@/lib/sync-timeout'

describe('sync timeout', () => {
  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('returns a completed network step and clears its timeout', async () => {
    vi.useFakeTimers()
    await expect(withSyncTimeout(Promise.resolve('done'), 'test step', 1000)).resolves.toBe('done')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('turns a stalled network step into a retryable timeout error', async () => {
    vi.useFakeTimers()
    const result = withSyncTimeout(new Promise<never>(() => {}), 'manifest', 1000)
    const assertion = expect(result).rejects.toBeInstanceOf(SyncTimeoutError)
    await vi.advanceTimersByTimeAsync(1000)
    await assertion
  })
})

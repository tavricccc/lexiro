import { afterEach, describe, expect, it, vi } from 'vitest'
import { runSyncWithRetry, SyncRetryPausedError } from '@/lib/sync-retry'

describe('sync retry runner', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('marks a stalled request and retries transient failures with bounded attempts', async () => {
    vi.useFakeTimers()
    let calls = 0
    const stalled: number[] = []
    const retries: number[] = []
    const resultPromise = runSyncWithRetry('retry-test', async () => {
      calls += 1
      if (calls < 3)
        throw new Error('network unavailable')
      return 'ok'
    }, {
      stallAfterMs: 800,
      onStalled: attempt => stalled.push(attempt),
      onRetry: attempt => retries.push(attempt),
    })

    await vi.advanceTimersByTimeAsync(10_000)
    await expect(resultPromise).resolves.toBe('ok')
    expect(calls).toBe(3)
    expect(retries).toEqual([1, 2])
    expect(stalled).toHaveLength(0)
  })

  it('reports a stalled in-flight request without starting a duplicate operation', async () => {
    vi.useFakeTimers()
    let calls = 0
    let resolveOperation = () => {}
    const stalled: number[] = []
    const resultPromise = runSyncWithRetry('stalled-test', () => {
      calls += 1
      return new Promise<void>((resolve) => {
        resolveOperation = resolve
      })
    }, { onStalled: attempt => stalled.push(attempt) })

    await vi.advanceTimersByTimeAsync(800)
    expect(stalled).toEqual([1])
    expect(calls).toBe(1)
    resolveOperation()
    await expect(resultPromise).resolves.toBeUndefined()
  })

  it('shares the active operation and pauses before starting when offline', async () => {
    let calls = 0
    const first = runSyncWithRetry('single-flight-test', async () => {
      calls += 1
      return 'ok'
    })
    const second = runSyncWithRetry('single-flight-test', async () => {
      calls += 1
      return 'unexpected'
    })
    expect(first).toBe(second)
    await expect(first).resolves.toBe('ok')
    expect(calls).toBe(1)

    await expect(runSyncWithRetry('paused-test', async () => 'never', { shouldContinue: () => false })).rejects.toBeInstanceOf(SyncRetryPausedError)
  })
})

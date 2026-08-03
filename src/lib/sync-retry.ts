import { isRetryableSyncError } from './cloud-sync-errors'

export const SYNC_RETRY_DELAYS_MS = [250, 500, 1000, 2000, 4000] as const
export const SYNC_STALLED_AFTER_MS = 800

export class SyncRetryPausedError extends Error {
  readonly code = 'sync/paused'

  constructor(message = 'Sync retry paused while the app is offline or hidden') {
    super(message)
    this.name = 'SyncRetryPausedError'
  }
}

export interface SyncRetryOptions {
  maxAttempts?: number
  stallAfterMs?: number
  shouldContinue?: () => boolean
  isRetryable?: (error: unknown) => boolean
  onAttemptStart?: (attempt: number) => void
  onStalled?: (attempt: number) => void
  onRetry?: (attempt: number, delayMs: number, error: unknown) => void
}

const activeRuns = new Map<string, Promise<unknown>>()

function jitteredDelay(delayMs: number): number {
  return Math.max(0, Math.round(delayMs * (0.8 + Math.random() * 0.4)))
}

async function waitBeforeRetry(delayMs: number, shouldContinue: () => boolean): Promise<void> {
  const end = Date.now() + delayMs
  while (Date.now() < end) {
    if (!shouldContinue())
      throw new SyncRetryPausedError()
    await new Promise(resolve => setTimeout(resolve, Math.min(100, end - Date.now())))
  }
}

/**
 * Runs one idempotent sync operation at a time and retries transient failures.
 * The stalled watchdog only changes observable state; it never starts a second
 * request while the first request is still in flight. This prevents a slow
 * Firestore response from racing a duplicate CAS/lease operation.
 */
export function runSyncWithRetry<T>(key: string, operation: (attempt: number) => Promise<T>, options: SyncRetryOptions = {}): Promise<T> {
  const active = activeRuns.get(key) as Promise<T> | undefined
  if (active)
    return active

  // maxAttempts includes the initial request. The five configured delays are
  // therefore available as five actual retries (six total attempts).
  const maxAttempts = Math.max(1, options.maxAttempts ?? SYNC_RETRY_DELAYS_MS.length + 1)
  const stallAfterMs = Math.max(1, options.stallAfterMs ?? SYNC_STALLED_AFTER_MS)
  const shouldContinue = options.shouldContinue ?? (() => true)
  const isRetryable = options.isRetryable ?? isRetryableSyncError
  const run = (async () => {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      if (!shouldContinue())
        throw new SyncRetryPausedError()
      options.onAttemptStart?.(attempt)
      const watchdog = setTimeout(() => {
        options.onStalled?.(attempt)
      }, stallAfterMs)
      try {
        return await operation(attempt)
      }
      catch (error) {
        if (!shouldContinue())
          throw new SyncRetryPausedError()
        if (error instanceof SyncRetryPausedError || attempt >= maxAttempts || !isRetryable(error))
          throw error
        const delayMs = jitteredDelay(SYNC_RETRY_DELAYS_MS[Math.min(attempt - 1, SYNC_RETRY_DELAYS_MS.length - 1)])
        options.onRetry?.(attempt, delayMs, error)
        await waitBeforeRetry(delayMs, shouldContinue)
      }
      finally {
        clearTimeout(watchdog)
      }
    }
    throw new Error('Sync retry runner exhausted')
  })()

  activeRuns.set(key, run)
  void run.finally(() => {
    if (activeRuns.get(key) === run)
      activeRuns.delete(key)
  }).catch(() => undefined)
  return run
}

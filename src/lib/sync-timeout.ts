export const SYNC_REQUEST_TIMEOUT_MS = 30_000

export class SyncTimeoutError extends Error {
  readonly code = 'deadline-exceeded'

  constructor(label: string, timeoutMs: number) {
    super(`${label} timeout after ${timeoutMs}ms`)
    this.name = 'SyncTimeoutError'
  }
}

/**
 * Firestore listeners and transactions can keep retrying without settling.
 * Bound each network step so the UI can offer an explicit retry instead of
 * leaving the application behind a permanent synchronization gate.
 */
export async function withSyncTimeout<T>(
  operation: Promise<T>,
  label: string,
  timeoutMs = SYNC_REQUEST_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new SyncTimeoutError(label, timeoutMs)), timeoutMs)
  })
  try {
    return await Promise.race([operation, timeout])
  }
  finally {
    if (timer)
      clearTimeout(timer)
  }
}

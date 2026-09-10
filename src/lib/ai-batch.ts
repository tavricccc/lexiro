import { mapWithConcurrency } from './async-pool'

/** How many AI requests may be in flight at once. Kept low to stay under provider rate limits. */
export const AI_BATCH_CONCURRENCY = 3

export interface AiBatchFailure {
  index: number
  message: string
}

export interface AiBatchProgress {
  completed: number
  failed: number
  succeeded: number
  total: number
}

export interface AiBatchOutcome<TResult> {
  aborted: boolean
  failures: AiBatchFailure[]
  results: { index: number, value: TResult }[]
}

export interface RunAiBatchesOptions<TBatch, TResult> {
  batches: readonly TBatch[]
  concurrency?: number
  onProgress?: (progress: AiBatchProgress) => void
  retries?: number
  run: (batch: TBatch, index: number, signal?: AbortSignal) => Promise<TResult>
  signal?: AbortSignal
}

function toMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason)
}

/**
 * Runs one AI request per batch, several at a time.
 *
 * A batch that fails does not cancel the rest: its error is collected and the
 * run continues, so a rate limit on request four still leaves the caller with
 * the output of requests one to three plus a list of what to retry. Callers
 * feed `failures[].index` back as a smaller `batches` array to retry.
 */
export async function runAiBatches<TBatch, TResult>({
  batches,
  concurrency = AI_BATCH_CONCURRENCY,
  onProgress,
  retries = 1,
  run,
  signal,
}: RunAiBatchesOptions<TBatch, TResult>): Promise<AiBatchOutcome<TResult>> {
  const results: { index: number, value: TResult }[] = []
  const failures: AiBatchFailure[] = []
  let completed = 0

  const report = () => onProgress?.({
    completed,
    failed: failures.length,
    succeeded: results.length,
    total: batches.length,
  })

  report()

  await mapWithConcurrency(batches, concurrency, async (batch, index) => {
    if (signal?.aborted)
      return
    let lastError = ''
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (signal?.aborted)
        return
      try {
        results.push({ index, value: await run(batch, index, signal) })
        completed++
        report()
        return
      }
      catch (reason) {
        lastError = toMessage(reason)
        if (signal?.aborted)
          return
      }
    }
    failures.push({ index, message: lastError })
    completed++
    report()
  })

  results.sort((first, second) => first.index - second.index)
  failures.sort((first, second) => first.index - second.index)
  return { aborted: Boolean(signal?.aborted), failures, results }
}

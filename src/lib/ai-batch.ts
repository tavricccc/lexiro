import { AiNotConfiguredError, AiRequestError } from "./ai-provider";
import { mapWithConcurrency } from "./async-pool";

/** How many AI requests may be in flight at once. Kept low to stay under provider rate limits. */
export const AI_BATCH_CONCURRENCY = 3;

const AI_RETRY_BASE_DELAY_MS = 1_000;
const AI_RETRY_MAX_DELAY_MS = 20_000;

export interface AiBatchFailure {
  index: number;
  message: string;
}

export interface AiBatchProgress {
  /** Characters received across every request, streamed or not. */
  characters: number;
  completed: number;
  failed: number;
  /** Requests sent and not yet answered, so the bar moves before the first reply. */
  inFlight: number;
  /** Requests waiting out a backoff before they are sent again. */
  retrying: number;
  succeeded: number;
  total: number;
}

export interface AiBatchOutcome<TResult> {
  aborted: boolean;
  failures: AiBatchFailure[];
  /** Set when the run stopped early because no amount of retrying would help. */
  fatal: string;
  results: { index: number; value: TResult }[];
}

/** What one batch is handed so it can report on itself while it runs. */
export interface AiBatchContext {
  /** Characters received so far for this request; a retry starts over at zero. */
  onCharacters: (characters: number) => void;
  signal?: AbortSignal;
}

export interface RunAiBatchesOptions<TBatch, TResult> {
  batches: readonly TBatch[];
  concurrency?: number;
  onProgress?: (progress: AiBatchProgress) => void;
  retries?: number;
  run: (
    batch: TBatch,
    index: number,
    context: AiBatchContext,
  ) => Promise<TResult>;
  signal?: AbortSignal;
  /** Seam for tests, so a backoff does not make the suite wait it out. */
  wait?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

function toMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

/**
 * Sending the same request again only helps for rate limits, gateway hiccups and
 * dropped connections. An invalid key, a rejected model or a reply that ran past
 * the token ceiling comes back identical, so retrying it just spends the user's
 * quota and makes them wait through a second timeout.
 */
function isRetryable(reason: unknown): boolean {
  if (reason instanceof AiNotConfiguredError) return false;
  if (reason instanceof AiRequestError) return reason.retryable;
  // Anything else here is our own parsing of the reply, and a model that
  // answered badly once may well answer cleanly the second time.
  return true;
}

function retryDelayMs(attempt: number, reason: unknown): number {
  const hinted =
    reason instanceof AiRequestError ? reason.retryAfterMs : undefined;
  if (hinted !== undefined) return Math.min(hinted, AI_RETRY_MAX_DELAY_MS);
  // Exponential, with jitter so three concurrent workers that all hit the same
  // rate limit do not come back at the same instant and hit it again.
  const ceiling = Math.min(
    AI_RETRY_BASE_DELAY_MS * 2 ** attempt,
    AI_RETRY_MAX_DELAY_MS,
  );
  return ceiling / 2 + Math.random() * (ceiling / 2);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0 || signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    signal?.addEventListener("abort", finish, { once: true });
  });
}

/**
 * Runs one AI request per batch, several at a time.
 *
 * A batch that fails does not cancel the rest: its error is collected and the
 * run continues, so a rate limit on request four still leaves the caller with
 * the output of requests one to three plus a list of what to retry. Callers
 * feed `failures[].index` back as a smaller `batches` array to retry.
 *
 * The exception is a failure no retry can fix — the AI is not configured at all
 * — which stops the run instead of marching through every remaining batch to
 * collect the same error twenty times.
 */
export async function runAiBatches<TBatch, TResult>({
  batches,
  concurrency = AI_BATCH_CONCURRENCY,
  onProgress,
  retries = 1,
  run,
  signal,
  wait = sleep,
}: RunAiBatchesOptions<TBatch, TResult>): Promise<AiBatchOutcome<TResult>> {
  const results: { index: number; value: TResult }[] = [];
  const failures: AiBatchFailure[] = [];
  let completed = 0;
  let inFlight = 0;
  let retrying = 0;
  let fatal = "";
  // Per batch rather than a running total, so a retry replaces that batch's
  // count instead of adding a second copy of it to the number on screen.
  const characters = new Map<number, number>();
  const totalCharacters = () =>
    [...characters.values()].reduce((sum, count) => sum + count, 0);

  const report = () =>
    onProgress?.({
      characters: totalCharacters(),
      completed,
      failed: failures.length,
      inFlight,
      retrying,
      succeeded: results.length,
      total: batches.length,
    });
  const stopped = () => Boolean(signal?.aborted) || Boolean(fatal);

  report();

  await mapWithConcurrency(batches, concurrency, async (batch, index) => {
    let lastError = "";
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (stopped()) return;
      inFlight++;
      characters.set(index, 0);
      report();
      try {
        const value = await run(batch, index, {
          onCharacters: (count) => {
            characters.set(index, count);
            report();
          },
          signal,
        });
        inFlight--;
        results.push({ index, value });
        completed++;
        report();
        return;
      } catch (reason) {
        inFlight--;
        lastError = toMessage(reason);
        if (signal?.aborted) {
          report();
          return;
        }
        if (!isRetryable(reason)) {
          if (reason instanceof AiNotConfiguredError) fatal = lastError;
          break;
        }
        if (attempt === retries) break;
        retrying++;
        report();
        await wait(retryDelayMs(attempt, reason), signal);
        retrying--;
      }
    }
    failures.push({ index, message: lastError });
    completed++;
    report();
  });

  results.sort((first, second) => first.index - second.index);
  failures.sort((first, second) => first.index - second.index);
  return { aborted: Boolean(signal?.aborted), failures, fatal, results };
}

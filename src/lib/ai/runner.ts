import type {
  AiPhase,
  AiSession,
  AiTask,
  AiTaskStep,
  AiTurnResult,
} from "@/src/types/ai";
import { t } from "@/lib/i18n";
import { AiRequestError } from "./errors";
import { commitTurn, generateTurn, resetConversation } from "./session";

export interface AiRun<T> {
  task: AiTask<T>;
  session: AiSession;
  pending: AiTaskStep<T>[];
  items: T[];
  completed: number;
  total: number;
  segments: number;
}
export interface AiRunUpdate<T> {
  phase: AiPhase;
  characters: number;
  items: T[];
  completed: number;
  total: number;
  segments: number;
  notices: string[];
}
export function waitForRetry(ms: number, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", abort, { once: true });
  });
}
export async function runTask<T>(
  run: AiRun<T>,
  options: {
    signal: AbortSignal;
    onUpdate: (update: AiRunUpdate<T>) => void;
    merge?: (items: T[]) => T[];
    send?: typeof generateTurn;
    wait?: typeof waitForRetry;
  },
) {
  const send = options.send ?? generateTurn,
    wait = options.wait ?? waitForRetry;
  let phase: AiPhase = "connecting",
    characters = 0;
  const report = () =>
    options.onUpdate({
      phase,
      characters,
      items: [...run.items],
      completed: run.completed,
      total: run.total,
      segments: run.segments,
      notices: [...run.session.notices],
    });
  report();
  while (run.pending.length) {
    options.signal.throwIfAborted();
    const step = run.pending[0];
    if (run.session.context !== run.task.context) {
      run.session.context = run.task.context;
      resetConversation(run.session);
    }
    let reducedContext = false;
    let reply: AiTurnResult | undefined,
      repair = "",
      parsed: T[] | undefined;
    for (let validation = 0; validation < 2; validation++) {
      const prompt = step.prompt;
      for (let attempt = 0; attempt < 3; attempt++) {
        characters = 0;
        try {
          reply = await send(run.session, prompt, {
            signal: options.signal,
            repair,
            onPhase: (next) => {
              phase = next;
              report();
            },
            onCharacters: (count) => {
              characters = count;
              report();
            },
          });
          break;
        } catch (reason) {
          options.signal.throwIfAborted();
          if (
            reason instanceof AiRequestError &&
            reason.code === "context_limit" &&
            !reducedContext
          ) {
            reducedContext = true;
            run.session.context = step.context;
            resetConversation(run.session);
            run.session.notices.push(t("ai.contextPartitioned"));
            attempt--;
            continue;
          }
          if (
            reason instanceof AiRequestError &&
            (reason.code === "truncated" || reason.code === "context_limit") &&
            step.split
          ) {
            const smaller = step.split();
            if (smaller.length > 1) {
              run.pending.splice(0, 1, ...smaller);
              run.session.notices.push(t("ai.smallerSegments"));
              break;
            }
          }
          if (
            !(reason instanceof AiRequestError) ||
            !reason.retryable ||
            attempt === 2
          )
            throw reason;
          phase = "retrying";
          report();
          await wait(
            reason.retryAfterMs ?? 1000 * 2 ** attempt + Math.random() * 500,
            options.signal,
          );
        }
      }
      if (!reply) break; // The current segment was split; restart with its first child.
      options.signal.throwIfAborted();
      phase = "validating";
      report();
      try {
        parsed = step.parse(reply.text);
        if (run.task.key) {
          const keys = new Set(run.items.map(run.task.key));
          for (const item of parsed) {
            const key = run.task.key(item);
            if (keys.has(key)) throw new Error(t("ai.duplicateOutput"));
            keys.add(key);
          }
        }
      } catch (reason) {
        let recovered: ReturnType<NonNullable<typeof step.recover>> = null;
        try {
          recovered = step.recover?.(reply.text) ?? null;
        } catch {
          /* The whole document needs repair. */
        }
        if (recovered && run.task.key) {
          const keys = new Set(run.items.map(run.task.key));
          if (recovered.items.some((item) => keys.has(run.task.key!(item))))
            recovered = null;
        }
        if (recovered) {
          const combined = [...run.items, ...recovered.items];
          run.items = options.merge ? options.merge(combined) : combined;
          run.completed += recovered.completed;
          run.pending.splice(0, 1, recovered.remaining);
          run.session.notices.push(t("ai.partialRecovered"));
          report();
          break;
        }
        if (validation === 1) throw reason;
        repair = reason instanceof Error ? reason.message : String(reason);
        reply = undefined;
        continue;
      }
      options.signal.throwIfAborted();
      const combined = [...run.items, ...parsed];
      run.items = options.merge ? options.merge(combined) : combined;
      commitTurn(run.session, prompt, reply);
      run.pending.shift();
      run.completed += step.count;
      run.segments++;
      report();
      break;
    }
  }
}

import type { Env } from "./env";
import { countTokens } from "gpt-tokenizer/encoding/o200k_base";
import { UpstreamError, upstreamFailure, upstreamDiagnostic } from "./upstream-error";
import type { Reservation } from "./billing";
import { settle } from "./billing";
import { upstreamBody, REASONING, type PreparedGeneration } from "./generation";
import { sanitizeResponseStream, type StreamTerminal } from "./response-stream";
import { outputText } from "./settlement";
import { prepareQuestionReview, approvedQuestionResult } from "./question-review";
import { deferUsage, reportedUsage, type UsageRecovery } from "./usage-recovery";
import { completeUsage, partsCost, sumUsage, type UsagePart } from "./usage-parts";

interface Options {
  env: Env;
  prepared: PreparedGeneration;
  reservation: Reservation;
  fetcher: typeof fetch;
  recoverUsage: UsageRecovery;
  cursor?: string;
  signal: AbortSignal;
  admin: boolean;
}

const encoder = new TextEncoder();
const frame = (type: string, payload: object) => encoder.encode(
  `event: ${type}\ndata: ${JSON.stringify({ type, ...payload })}\n\n`,
);
class QualityRejected extends Error {}

/** One reservation, two independent model calls, and only the approved final prose. */
export function reviewedQuestionStream(options: Options) {
  const cancelled = new AbortController();
  const signal = AbortSignal.any([options.signal, cancelled.signal]);
  const finished = Promise.withResolvers<void>();
  const parts: UsagePart[] = [];
  let settled = false;
  let phase: "draft" | "review" = "draft";
  const publicUsage = () => ({ model: options.prepared.request.model,
    ...(parts.length && parts.every(completeUsage) ? { usage: {
      input_tokens: sumUsage(parts).input, output_tokens: sumUsage(parts).output,
      input_tokens_details: { cached_tokens: sumUsage(parts).cached, cache_write_tokens: sumUsage(parts).cacheWrite },
    } } : {}),
    lexiro: { usageParts: parts.map(({ cursor: _cursor, ...usage }) => usage) },
  });

  const finish = async (approved: boolean, status: string) => {
    if (settled) return;
    settled = true;
    const { prepared, reservation, env } = options;
    const cursor = parts.findLast((part) => part.cursor)?.cursor;
    const metadata = { cursor, status, kind: prepared.request.kind, tier: prepared.request.tier,
      units: prepared.units.length, usageParts: parts };
    if (!parts.length) {
      await settle(env.DB, reservation, reservation.charges,
        { model: prepared.request.model, input: 0, output: 0, cached: 0, cacheWrite: 0 },
        { ...metadata, charged: 0, cost: 0 });
      return 0;
    }
    const cost = partsCost(parts);
    if (cost === null) {
      await deferUsage(env.DB, reservation, approved ? prepared.units.map((unit) => unit.id) : [],
        prepared.request.model, approved, metadata);
    } else {
      await settle(env.DB, reservation, approved ? [] : reservation.charges, sumUsage(parts), {
        ...metadata, charged: approved ? cost : 0, cost,
      });
    }
    return cost;
  };

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (type: string, payload: object) => {
        if (!cancelled.signal.aborted) controller.enqueue(frame(type, payload));
      };
      const collect = async (prepared: PreparedGeneration, phase: "draft" | "review", cursor?: string) => {
        signal.throwIfAborted();
        const part: UsagePart = { model: prepared.request.model };
        parts.push(part);
        emit("lexiro.question.progress", { phase, characters: 0, tokens: 0 });
        const response = await options.fetcher(`${options.env.OPENAI_BASE_URL}/responses`, {
          method: "POST",
          headers: { authorization: `Bearer ${options.env.OPENAI_API_KEY}`, "content-type": "application/json" },
          body: upstreamBody(prepared, cursor), signal,
        });
        if (!response.ok || !response.body) {
          throw await upstreamFailure(response, { phase, model: prepared.request.model, reasoning: { effort: REASONING[prepared.request.tier] } }, options.env.OPENAI_API_KEY);
        }
        let terminal: StreamTerminal | undefined;
        let characters = 0;
        let text = "", lastProgress = 0;
        const stream = sanitizeResponseStream(response.body, { model: prepared.request.model,
          onTerminal: async (value) => {
            terminal = value;
            part.cursor = value.cursor;
            const usage = reportedUsage(value.response, part.model);
            if (usage) Object.assign(part, usage);
            return undefined;
          },
        });
        const reader = stream.getReader();
        const abort = () => { void reader.cancel().catch(() => undefined); };
        signal.addEventListener("abort", abort, { once: true });
        try {
          for (;;) {
            signal.throwIfAborted();
            const next = await reader.read();
            if (next.done) break;
            const data = new TextDecoder().decode(next.value).split(/\r?\n/)
              .filter((line) => line.startsWith("data:")).map((line) => line.slice(5)).join("\n");
            const event = JSON.parse(data) as { type: string; response?: { id: string }; delta?: string };
            if (event.type === "response.created") part.cursor = event.response!.id;
            if (event.type === "response.output_text.delta") {
              characters += event.delta!.length;
              text += event.delta!;
              const now = Date.now();
              if (now - lastProgress >= 100) {
                emit("lexiro.question.progress", { phase, characters, tokens: countTokens(text, { allowedSpecial: new Set() }) });
                lastProgress = now;
              }
            }
          }
        } finally {
          signal.removeEventListener("abort", abort);
          await reader.cancel();
          reader.releaseLock();
        }
        signal.throwIfAborted();
        emit("lexiro.question.progress", { phase, characters, tokens: countTokens(text, { allowedSpecial: new Set() }) });
        if (!terminal || terminal.status !== "complete" || !terminal.response)
          throw new UpstreamError(upstreamDiagnostic(terminal?.response, { phase, model: prepared.request.model, responseId: terminal?.cursor, stopReason: terminal?.status ?? "missing_terminal" }, options.env.OPENAI_API_KEY));
        return JSON.parse(outputText(terminal.response)) as unknown;
      };
      const run = async () => {
        try {
          const draft = await collect(options.prepared, "draft", options.cursor);
          phase = "review";
          const review = await collect(prepareQuestionReview(options.prepared, draft), "review");
          let corrected: unknown;
          try { corrected = approvedQuestionResult(options.prepared, review); }
          catch (reason) { throw new QualityRejected(reason instanceof Error ? reason.message : String(reason)); }
          signal.throwIfAborted();
          const cost = await finish(true, "complete");
          signal.throwIfAborted();
          const id = parts.at(-1)!.cursor!;
          const model = options.prepared.request.model;
          const response = { ...publicUsage(), id, model, status: "completed",
            lexiro: { ...publicUsage().lexiro,
              ...(options.admin && cost !== null && cost !== undefined ? { credits: cost } : {}) },
          };
          emit("response.created", { response: { id, model, status: "in_progress" } });
          emit("response.output_text.delta", { delta: JSON.stringify(corrected) });
          emit("response.completed", { response });
          controller.close();
          finished.resolve();
        } catch (reason) {
          try {
            await finish(false, signal.aborted ? "cancelled" : reason instanceof QualityRejected ? "question_quality_rejected" : "failed");
            if (!cancelled.signal.aborted) {
              emit("error", { code: reason instanceof QualityRejected ? "question_quality_rejected" : "upstream_unavailable", response: publicUsage(),
                ...(options.admin ? { diagnostic: reason instanceof UpstreamError ? reason.diagnostic : upstreamDiagnostic({ message: reason instanceof Error ? reason.message : String(reason) }, { phase, model: options.prepared.request.model }, options.env.OPENAI_API_KEY) } : {}),
              });
              controller.close();
            }
            finished.resolve();
          } catch (error) {
            if (!cancelled.signal.aborted) controller.error(error);
            finished.reject(error);
          }
        }
      };
      void run();
    },
    async cancel() {
      cancelled.abort();
      await finished.promise;
    },
  });
  return { body, done: finished.promise };
}

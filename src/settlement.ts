import {
  buildWordGenerationSources,
  LIMITS,
  MULTIPLIER,
  normalizePartOfSpeech,
} from "@lexiro/ai-contract";
import type { D1Database } from "@cloudflare/workers-types";
import { settle, type Reservation, type Usage } from "./billing";
import type { PreparedGeneration } from "./generation";
import type { StreamTerminal } from "./response-stream";
import { creditsFromUsage } from "./credits";
import { wordOutput, questionOutput } from "./schemas";

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const count = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;

export function outputText(response: Record<string, unknown>): string {
  if (!Array.isArray(response.output)) return "";
  return response.output
    .filter(record)
    .flatMap((item) =>
      Array.isArray(item.content) ? item.content.filter(record) : [],
    )
    .filter(
      (part) => part.type === "output_text" && typeof part.text === "string",
    )
    .map((part) => part.text)
    .join("");
}

/**
 * Settles one run and writes it to the ledger.
 *
 * A run that ends without a terminal event — the client hung up, the 110 second
 * ceiling hit, the stream broke — has already cost real tokens upstream. When a
 * response id exists, `recoverUsage` fetches the stored response so that cost is
 * recorded instead of silently counted as nothing. The user is not charged for
 * it; only the administrator's ledger learns about it.
 */
export async function settleGeneration(
  db: D1Database,
  reservation: Reservation,
  prepared: PreparedGeneration,
  terminal: StreamTerminal,
  model: string,
  recoverUsage?: (cursor: string) => Promise<Record<string, unknown> | undefined>,
) {
  const usage: Usage = { model };
  const upstream =
    terminal.response ??
    (terminal.cursor && recoverUsage
      ? await recoverUsage(terminal.cursor).catch(() => undefined)
      : undefined);
  if (upstream && record(upstream.usage)) {
    usage.input = count(upstream.usage.input_tokens);
    usage.output = count(upstream.usage.output_tokens);
    usage.cached = record(upstream.usage.input_tokens_details)
      ? count(upstream.usage.input_tokens_details.cached_tokens)
      : undefined;
  }
  const kind = prepared.request.kind;
  const valid = new Set<number>();
  let readingCount = 0;
  const produced =
    terminal.status === "complete" || terminal.status === "truncated";
  if (upstream && produced && terminal.response) {
    const text = outputText(upstream);
    if (kind === "explain") {
      if (text.trim()) valid.add(0);
    } else {
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
      if (record(data)) {
        if (kind === "words" && Array.isArray(data.items)) {
          const sources = buildWordGenerationSources(prepared.request.raw!);
          data.items.forEach((item, index) => {
            const parsed = wordOutput().safeParse({ items: [item] });
            const source = sources[index];
            if (!parsed.success || !source) return;
            const senses = parsed.data.items[0].senses;
            const maximum =
              Math.max(
                1,
                source.hint?.split(/與|或|並可指/).filter(Boolean).length ?? 0,
              ) + 1;
            if (
              senses.length &&
              senses.length <= maximum &&
              senses.every(
                (sense) =>
                  normalizePartOfSpeech(sense.pos ?? source.posHint ?? "") &&
                  /\p{Script=Han}/u.test(sense.meaningZh) &&
                  sense.example.trim() &&
                  !/\p{Script=Han}/u.test(sense.example),
              )
            )
              valid.add(index);
          });
        } else if (kind === "organizeText" || kind === "organizeImage") {
          if (
            Array.isArray(data.lines) &&
            data.lines.length &&
            data.lines.every(
              (line) =>
                typeof line === "string" &&
                line.trim() &&
                line.length <= LIMITS.source,
            ) &&
            data.lines.join("\n").length <= LIMITS.input
          )
            valid.add(0);
        } else if (kind !== "words") {
          const schema = questionOutput(kind);
          if (kind === "vocabulary" || kind === "grammar") {
            if (Array.isArray(data.items))
              data.items.forEach((item, index) => {
                if (schema.safeParse({ items: [item] }).success)
                  valid.add(index);
              });
          } else if (schema.safeParse(data).success) {
            prepared.units.forEach((unit) => valid.add(unit.index));
            if (kind === "reading" && Array.isArray(data.items))
              readingCount = Math.min(5, data.items.length);
          }
        }
      }
    }
  }
  const refunds = reservation.charges.flatMap((charge) => {
    const units = prepared.units.filter((unit) => unit.id === charge.id);
    if (!units.some((unit) => valid.has(unit.index))) return [charge];
    if (kind === "reading") {
      const points = Math.min(
        charge.points,
        (5 - readingCount) * 3 * MULTIPLIER[prepared.request.tier],
      );
      return points ? [{ id: charge.id, points }] : [];
    }
    return [];
  });
  const cost = creditsFromUsage(usage) ?? 0;
  // Nothing usable came back, so nothing is charged; the cost is still logged.
  const charged = produced ? cost : 0;
  await settle(db, reservation, refunds, usage, {
    cursor: terminal.cursor,
    charged,
    cost,
    status: terminal.status,
  });
  return charged;
}

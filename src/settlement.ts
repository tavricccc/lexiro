import {
  buildWordGenerationSources,
  LIMITS,
  normalizePartOfSpeech,
} from "@lexiro/ai-contract";
import type { D1Database } from "@cloudflare/workers-types";
import { settle, type Reservation } from "./billing";
import { deferUsage, reportedUsage, type UsageRecovery } from "./usage-recovery";
import { supplementWords, type PreparedGeneration } from "./generation";
import type { StreamTerminal } from "./response-stream";
import { creditsFromUsage } from "./credits";
import { wordOutput, questionOutput, questionItemOutput } from "./schemas";

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Whether one returned sense is something the Library could hold: a part of
 * speech it knows, a Chinese meaning, and an English example.
 */
function usableSense(
  sense: { pos: string | null; meaningZh: string; example: string },
  posHint?: string,
): boolean {
  return Boolean(
    normalizePartOfSpeech(sense.pos ?? posHint ?? "") &&
    /\p{Script=Han}/u.test(sense.meaningZh) &&
    sense.example.trim() &&
    !/\p{Script=Han}/u.test(sense.example),
  );
}

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
 * A run that ends without a terminal event — the generation deadline hit or the
 * provider stream could not be recovered — has already cost real tokens upstream. When a
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
  recoverUsage?: UsageRecovery,
) {
  const upstream = terminal.response;
  const kind = prepared.request.kind;
  const valid = new Set<number>();
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
        if (prepared.request.itemRepair && questionItemOutput(kind as import("@lexiro/ai-contract").QuestionKind).safeParse(data).success) {
          valid.add(0);
        } else if (kind === "words" && Array.isArray(data.items)) {
          const sources = buildWordGenerationSources(prepared.request.raw!);
          data.items.forEach((item, index) => {
            const parsed = wordOutput({ min: 1, max: 1 }).safeParse({
              items: [item],
            });
            const source = sources[index];
            if (!parsed.success || !source) return;
            const senses = parsed.data.items[0].senses;
            if (senses.every((sense) => usableSense(sense, source.posHint)))
              valid.add(index);
          });
        } else if (kind === "senses" && Array.isArray(data.items)) {
          // Nothing worth adding is the honest answer for most words, so an
          // empty list settles as work done. The word was charged for being
          // looked at, not for coming back with something.
          const words = supplementWords(prepared.request.sources ?? []);
          data.items.forEach((item, index) => {
            const parsed = wordOutput({
              min: 0,
              max: prepared.request.limit ?? 0,
            }).safeParse({ items: [item] });
            if (!parsed.success || !words[index]) return;
            const senses = parsed.data.items[0].senses;
            if (
              senses.length <= (prepared.request.limit ?? 0) &&
              senses.every((sense) => usableSense(sense))
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
            prepared.units.forEach((unit) => valid.add(unit.index));
        } else if (kind !== "words" && kind !== "senses") {
          const schema = questionOutput(kind);
          if (kind === "vocabulary") {
            if (Array.isArray(data.items))
              data.items.forEach((item, index) => {
                if (schema.safeParse({ items: [item] }).success)
                  valid.add(index);
              });
          } else if (schema.safeParse(data).success) {
            prepared.units.forEach((unit) => valid.add(unit.index));
          }
        }
      }
    }
  }
  const refunds = reservation.charges.flatMap((charge) => {
    const units = prepared.units.filter((unit) => unit.id === charge.id);
    if (!units.some((unit) => valid.has(unit.index))) return [charge];
    return [];
  });
  let usage = reportedUsage(upstream, model);
  if (!usage && terminal.cursor && recoverUsage) {
    usage = reportedUsage(await recoverUsage(terminal.cursor).catch(() => undefined), model);
  }
  const cost = usage ? creditsFromUsage(usage) : null;
  const metadata = {
    cursor: terminal.cursor, status: terminal.status,
    kind, tier: prepared.request.tier, units: prepared.units.length,
  };
  if (!usage || cost === null) {
    const refunded = new Set(refunds.map((refund) => refund.id));
    await deferUsage(db, reservation, reservation.charges.filter((charge) => !refunded.has(charge.id)).map((charge) => charge.id),
      model, produced, metadata);
    return;
  }
  // Completed runs pay for reported tokens; failed/cancelled runs only log cost.
  const charged = produced ? cost : 0;
  await settle(db, reservation, refunds, usage, { ...metadata, charged, cost });
  return charged;
}

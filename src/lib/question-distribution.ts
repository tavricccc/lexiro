import type { GeneratedQuestionKind } from "@/types";

/**
 * How a mixed practice session is divided between formats.
 *
 * The weights follow the emphasis of the 學測 paper — where 詞彙題, 綜合測驗,
 * 文意選填 and 閱讀測驗 carry most of the items and 篇章結構 only four — with a
 * share carved out for 文法題, which is a 段考 staple rather than a 學測 section.
 */
export const QUESTION_FORMAT_WEIGHTS: Record<GeneratedQuestionKind, number> = {
  cloze: 0.18,
  discourse: 0.08,
  grammar: 0.12,
  reading: 0.2,
  vocabulary: 0.28,
  wordBank: 0.14,
};

export type DailyQuestionQuotas = Record<GeneratedQuestionKind, number>;

/**
 * Splits `target` items across the formats by weight, handing the leftover to
 * whichever formats were rounded down hardest so the quotas always sum to
 * exactly `target`.
 */
export function allocateDailyQuestionQuotas(
  target: number,
): DailyQuestionQuotas {
  const total = Math.max(0, Math.floor(target));
  const formats = Object.keys(
    QUESTION_FORMAT_WEIGHTS,
  ) as GeneratedQuestionKind[];
  const quotas = Object.fromEntries(
    formats.map((format) => [
      format,
      Math.floor(total * QUESTION_FORMAT_WEIGHTS[format]),
    ]),
  ) as DailyQuestionQuotas;

  let remaining =
    total - formats.reduce((sum, format) => sum + quotas[format], 0);
  const order = formats
    .map((format) => ({
      format,
      remainder: total * QUESTION_FORMAT_WEIGHTS[format] - quotas[format],
    }))
    .sort(
      (first, second) =>
        second.remainder - first.remainder ||
        formats.indexOf(first.format) - formats.indexOf(second.format),
    );

  for (let index = 0; index < order.length && remaining > 0; index += 1) {
    quotas[order[index].format] += 1;
    remaining -= 1;
  }

  return quotas;
}

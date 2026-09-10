import type { GeneratedQuestionKind, PassageFormat, QuestionStyle } from "@/types";

import { t, type TranslationKey } from "@/lib/i18n";

/**
 * The question type and difficulty lists are read on five screens: practice
 * setup, the questions filter bar, both editors and the generator. They live
 * here so the same format never shows up as "詞彙題" on one screen and
 * "英文四選一" on the next, and so adding a format is a one-line change.
 *
 * The names are the ones a Taiwanese student sees on a real paper, and the
 * order follows the 學測 paper: 詞彙題, 綜合測驗, 文意選填, 篇章結構, 閱讀測驗,
 * with the 段考 文法題 alongside the sentence formats.
 */

export interface LabelledOption {
  label: string;
  value: string;
  description?: string;
}

const DIFFICULTY_KEYS = [
  "questions.difficultyEasy",
  "questions.difficultyMedium",
  "questions.difficultyHard",
] as const satisfies readonly TranslationKey[];

/** Paper order, with the label and the one-line explanation of each format. */
const FORMAT_KEYS = {
  vocabulary: ["questions.vocabulary", "questions.vocabularyHint"],
  grammar: ["questions.grammar", "questions.grammarHint"],
  cloze: ["questions.cloze", "questions.clozeHint"],
  wordBank: ["questions.wordBank", "questions.wordBankHint"],
  discourse: ["questions.discourse", "questions.discourseHint"],
  reading: ["questions.reading", "questions.readingHint"],
} as const satisfies Record<GeneratedQuestionKind, readonly [TranslationKey, TranslationKey]>;

export const SENTENCE_STYLES: QuestionStyle[] = ["vocabulary", "grammar"];
export const PASSAGE_FORMAT_VALUES: PassageFormat[] = [
  "cloze",
  "wordBank",
  "discourse",
  "reading",
];

export function difficultyLabel(level: number): string {
  const key = DIFFICULTY_KEYS[level - 1];
  return key ? t(key) : t("practice.difficulty");
}

export function questionFormatLabel(format: string): string {
  const entry = FORMAT_KEYS[format as GeneratedQuestionKind];
  return entry ? t(entry[0]) : format;
}

export function questionFormatHint(format: GeneratedQuestionKind): string {
  return t(FORMAT_KEYS[format][1]);
}

export function difficultyOptions(allLabel?: string): LabelledOption[] {
  const options = DIFFICULTY_KEYS.map((key, index) => ({
    label: t(key),
    value: String(index + 1),
  }));
  return allLabel ? [{ label: allLabel, value: "all" }, ...options] : options;
}

function formatOptions(values: readonly GeneratedQuestionKind[]): LabelledOption[] {
  return values.map((value) => ({
    description: questionFormatHint(value),
    label: questionFormatLabel(value),
    value,
  }));
}

/** Every format, for filters and for the generator. */
export function questionFormatOptions(allLabel?: string): LabelledOption[] {
  const options = formatOptions([
    ...SENTENCE_STYLES,
    ...PASSAGE_FORMAT_VALUES,
  ]);
  return allLabel ? [{ label: allLabel, value: "all" }, ...options] : options;
}

/** The two formats the single-question editor can author by hand. */
export function sentenceStyleOptions(): LabelledOption[] {
  return formatOptions(SENTENCE_STYLES);
}

/**
 * The five 學測 selection formats Lexiro stores and practises.
 *
 *  - vocabulary 詞彙題：一句一格 `_____`，四選一。
 *  - cloze      綜合測驗：一篇短文數格 `__1__`，每格自己四個選項。
 *  - wordBank   文意選填：一篇十格，共用十個選項，每個只能用一次。
 *  - discourse  篇章結構：一篇四格，五個整句選項擇四。
 *  - reading    閱讀測驗：一篇文章，三到五題理解題。
 */
export const QUESTION_KINDS = ["vocabulary", "cloze", "wordBank", "discourse", "reading"] as const;
export type QuestionKind = (typeof QUESTION_KINDS)[number];
export type PassageKind = Exclude<QuestionKind, "vocabulary">;
export type Difficulty = 1 | 2 | 3;

export interface PassageSpec {
  /** Most blanks a passage may have; `reading` has none. */
  blanks: number;
  /** Options per blank, or the size of the shared bank. */
  options: number;
  sharedBank: boolean;
}

export const PASSAGE_SPECS: Record<PassageKind, PassageSpec> = {
  cloze: { blanks: 5, options: 4, sharedBank: false },
  wordBank: { blanks: 10, options: 10, sharedBank: true },
  discourse: { blanks: 4, options: 5, sharedBank: true },
  reading: { blanks: 0, options: 4, sharedBank: false },
};

export const READING_ITEMS = { min: 3, max: 5 } as const;
export const SENTENCE_BLANK = "_____";
export const BLANK_PATTERN = /__(\d+)__/g;

export const isPassageKind = (kind: QuestionKind): kind is PassageKind => kind !== "vocabulary";

/** Blank numbers in a passage, in the order they appear. */
export function blankNumbers(passage: string): number[] {
  return [...passage.matchAll(BLANK_PATTERN)].map((match) => Number(match[1]));
}

/** Contractions and hyphenated forms count once; blank markers do not count. */
export function countEnglishWords(text: string): number {
  return (text.replace(/__\d+__|_____/g, "").match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) ?? []).length;
}

/** Lexiro's editorial length ranges in English words, before blanks are cut. */
export const LENGTH_RANGES: Record<QuestionKind, Record<Difficulty, [number, number]>> = {
  vocabulary: { 1: [18, 32], 2: [24, 40], 3: [28, 48] },
  cloze: { 1: [180, 220], 2: [200, 260], 3: [230, 300] },
  wordBank: { 1: [200, 260], 2: [240, 320], 3: [280, 360] },
  discourse: { 1: [220, 280], 2: [260, 340], 3: [300, 400] },
  reading: { 1: [180, 240], 2: [240, 320], 3: [300, 400] },
};

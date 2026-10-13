import { z } from "zod";
import type { QuestionKind as GeneratedQuestionKind } from "@lexiro/ai-contract";
import { READING_SKILLS } from "@lexiro/ai-contract";
const text = z.string();
const english = text.min(1).regex(/^[^\u3400-\u9fff]*[A-Za-z][^\u3400-\u9fff]*$/);
const chinese = text.min(1).regex(/[\u3400-\u9fff]/).describe("繁體中文解說，不可整項只用英文。");
const prose = text.min(1).regex(/^[^_\u3400-\u9fff]*[A-Za-z][^_\u3400-\u9fff]*$/).describe("完整英文原文，包含答案，不得使用底線、空格標記或中文翻譯。");
const texts = z.array(english);
export const teaching = (count: number) => ({
  explanation: chinese,
  whyWrong: z.array(z.object({ option: english, reason: chinese })).length(count),
});
// Meaning items gloss each wrong option; only a confusable one adds "；" and one short note.
const glossTeaching = {
  explanation: chinese,
  whyWrong: z.array(z.object({ option: english, reason: chinese.describe("該選項本身的簡短繁中詞義，如「顧客」；只有與正解易混淆時才加「；」與一短句差異。文法選形則寫一短句選形障礙。") })).length(3),
};
const sharedExplanation = { explanation: chinese };
const optionMeanings = z.array(z.object({ option: english, meaning: chinese.describe("此選項的簡短繁中詞義，整組只寫一次。") })).length(10);
const unusedReason = chinese.describe("未使用的那句為何放在任何空格都不合，一句話。");
const anchoredUsage = english.describe("先定位原文中恰好一處的完整自然用法span；目標answer只需在該usage內恰好一次，其他位置可有同字，依明確usage定位實際空格。可保留分離片語中的受詞。");
export const wordBankSourceRef = text.regex(/^s[1-9]\d*$/).describe("本空格對應的來源 ref，逐字複製 sources.ref；每個來源恰好一次。陣列位置不是來源身分。單題修復保留原題 targetRef。");
const wordBankBlank = z.object({ ref: wordBankSourceRef, usage: anchoredUsage, answer: english });
const choices = z.object({ usage: anchoredUsage, answer: english, distractors: texts.length(3) });
// Decide the context, anchor and exact hole before choosing its replacements.
export const sentenceQuestionItem = z.object({
  sentence: prose.describe("一至兩句完整情境，合計落在本輪字數範圍中段；先寫正文，保留目標詞的實際字形。"),
  usage: english.describe("原句內恰好一處的自然用法span；單字可用本身或必要的上下文以定位，片語保留完整實現，可含動詞與particle之間的受詞，如 took her coat off。"),
  answer: english.describe("真正挖掉與被選項替換的原文span，在已定位usage內恰好一次。片語可取完整實現如 took her coat off，或相容的局部如 took／made；每個候選須插入實際剪掉answer的句子，配合外面保留的aux／受詞／particle。"),
  distractors: texts.length(3).describe("答案範圍已確定，再選三個對應該辨析點且適合真實空格的候選；保留外面的冠詞、助動詞、受詞及particle，詞義題文法自然，詞形題由實際句法選形，排除依據只來自遮答後留下的情境。"),
});
export const readingQuestionItem = z.object({
  skill: z.enum(READING_SKILLS),
  evidence: texts.min(1).describe("先選支撐 skill 的完整原文句。inference 至少兩個必要事實，拿掉任一句後不能推出答案，本文保留事實而不預先說出結論。"),
  question: english,
  answer: english,
  distractors: texts.length(3),
});
export const clozeQuestionItem = choices;
/**
 * A word's meaning, and its part of speech when the source did not already
 * state one.
 *
 * `pos` is null rather than absent in that case. A field that may be omitted
 * cannot be expressed in the schema subset OpenAI accepts — strict mode
 * requires every property to be listed as required — and asking for one was
 * rejected outright, so the whole batch failed before a single word was
 * generated. Null says the same thing and is a value the schema can hold.
 */
export const wordOutput = ({ min, max }: { min: number; max: number }) =>
  z.object({
    items: z.array(
      z.object({
        senses: z
          .array(
            z.object({ pos: text.nullable(), meaningZh: text, example: text }),
          )
          .min(min)
          .max(max),
      }),
    ),
  });
export function questionOutput(kind: GeneratedQuestionKind) {
  if (kind === "vocabulary")
    return z.object({ items: z.array(sentenceQuestionItem.extend(glossTeaching)) });
  if (kind === "cloze")
    return z.object({ title: english, passage: prose, blanks: z.array(choices.extend(glossTeaching)) });
  if (kind === "wordBank")
    return z.object({
      title: english,
      passage: prose,
      options: texts.length(10),
      optionMeanings,
      blanks: z.array(wordBankBlank.extend(sharedExplanation)).min(1).max(10),
    });
  if (kind === "discourse")
    return z.object({
      title: english,
      passage: prose,
      options: texts.length(5),
      unusedReason,
      removals: z.array(z.object({ sentence: english, ...sharedExplanation })).length(4),
    });
  return z.object({
    title: english,
    passage: prose.describe("完整英文閱讀本文，包含支撐題目的事實與可逐字引用的句子；推論結論不必出現在本文，留在answer以兩個必要事實推出。"),
    items: z.array(readingQuestionItem.extend(teaching(3))).min(3).max(5),
  });
}
export function questionItemOutput(kind: GeneratedQuestionKind) {
  const item = kind === "cloze" ? choices.extend(glossTeaching)
    : kind === "wordBank" ? wordBankBlank.extend(sharedExplanation)
    : kind === "discourse" ? z.object({ sentence: english, ...sharedExplanation })
    : readingQuestionItem.extend(teaching(3));
  return z.object({ items: z.array(item).length(1) });
}
export const jsonSchema = (schema: z.ZodType): Record<string, unknown> => {
  const { $schema: _version, ...result } = z.toJSONSchema(schema);
  return result;
};

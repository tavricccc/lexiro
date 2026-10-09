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
const blank = z.object({ answer: english });
const choices = z.object({ answer: english, distractors: texts.length(3) });
// Structured Outputs follows property order: write the context, then quote its answer.
export const sentenceQuestionItem = z.object({
  distractors: texts.length(3).describe("先定本題學習的詞義或合法詞形，選三個對應該辨析點的候選；詞義題候選文法自然，詞形題由實際句法選形，避免另一同時成立的合法屬性。"),
  sentence: prose.describe("一至兩句完整情境，合計落在本輪字數範圍中段；先寫正文，保留目標詞的實際字形。"),
  usage: english.describe("原句內恰好一處的自然用法span；單字可用本身或必要的上下文以定位，片語保留完整實現，可含動詞與particle之間的受詞，如 took her coat off。"),
  answer: english.describe("從最終 usage 逐字複製的實際目標詞形，在已定位的usage內恰好一次；句中其他位置的同字不影響此span。片語可取 took her coat off 的 took，或 is made up of three parts 的 made。"),
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
    return z.object({ items: z.array(sentenceQuestionItem.extend(teaching(3))) });
  if (kind === "cloze")
    return z.object({ title: english, passage: prose, blanks: z.array(choices.extend(teaching(3))) });
  if (kind === "wordBank")
    return z.object({
      title: english,
      passage: prose,
      options: texts.length(10),
      blanks: z.array(blank.extend(teaching(9))).min(1).max(10),
    });
  if (kind === "discourse")
    return z.object({
      title: english,
      passage: prose,
      options: texts.length(5),
      removals: z.array(z.object({ sentence: english, ...teaching(4) })).length(4),
    });
  return z.object({
    title: english,
    passage: prose.describe("完整英文閱讀本文，包含支撐題目的事實與可逐字引用的句子；推論結論不必出現在本文，留在answer以兩個必要事實推出。"),
    items: z.array(readingQuestionItem.extend(teaching(3))).min(3).max(5),
  });
}
export function questionItemOutput(kind: GeneratedQuestionKind) {
  const item = kind === "cloze" ? choices.extend(teaching(3))
    : kind === "wordBank" ? blank.extend(teaching(9))
    : kind === "discourse" ? z.object({ sentence: english, ...teaching(4) })
    : readingQuestionItem.extend(teaching(3));
  return z.object({ items: z.array(item).length(1) });
}
export const jsonSchema = (schema: z.ZodType): Record<string, unknown> => {
  const { $schema: _version, ...result } = z.toJSONSchema(schema);
  return result;
};

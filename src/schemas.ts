import { z } from "zod";
import type { QuestionKind as GeneratedQuestionKind } from "@lexiro/ai-contract";
import { READING_SKILLS } from "@lexiro/ai-contract";
const teaching = (count: number) => ({ explanation: z.string().min(1), whyWrong: z.array(z.string().min(1)).length(count) });

const text = z.string();
const texts = z.array(text);
const blank = z.object({ answer: text });
const choices = z.object({ answer: text, distractors: texts });
// Structured Outputs follows property order: write the context, then quote its answer.
export const sentenceQuestionItem = z.object({ sentence: text, usage: text, answer: text, distractors: texts });
export const readingQuestionItem = choices.extend({
  question: text,
  skill: z.enum(READING_SKILLS),
  evidence: texts,
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
    return z.object({ title: text, passage: text, blanks: z.array(choices.extend(teaching(3))) });
  if (kind === "wordBank")
    return z.object({
      title: text,
      passage: text,
      extraOptions: texts,
      blanks: z.array(blank.extend(teaching(9))),
    });
  if (kind === "discourse")
    return z.object({
      title: text,
      passage: text,
      extraOption: text,
      removals: z.array(z.object({ sentence: text, ...teaching(4) })),
    });
  return z.object({
    title: text,
    passage: text,
    items: z.array(readingQuestionItem.extend(teaching(3))),
  });
}
export function questionItemOutput(kind: GeneratedQuestionKind) {
  const item = kind === "cloze" ? choices.extend(teaching(3))
    : kind === "wordBank" ? blank.extend(teaching(9))
    : kind === "discourse" ? z.object({ sentence: text, ...teaching(4) })
    : readingQuestionItem.extend(teaching(3));
  return z.object({ items: z.array(item).length(1) });
}
export const jsonSchema = (schema: z.ZodType): Record<string, unknown> => {
  const { $schema: _version, ...result } = z.toJSONSchema(schema);
  return result;
};

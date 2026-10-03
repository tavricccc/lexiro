import { z } from "zod";
import type { QuestionKind as GeneratedQuestionKind } from "@lexiro/ai-contract";
import { READING_SKILLS } from "@lexiro/ai-contract";

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
    return z.object({ items: z.array(sentenceQuestionItem) });
  if (kind === "cloze")
    return z.object({ title: text, passage: text, blanks: z.array(choices) });
  if (kind === "wordBank")
    return z.object({
      title: text,
      passage: text,
      blanks: z.array(blank),
      extraOptions: texts,
    });
  if (kind === "discourse")
    return z.object({
      title: text,
      passage: text,
      removals: texts,
      extraOption: text,
    });
  return z.object({
    title: text,
    passage: text,
    items: z.array(readingQuestionItem),
  });
}
export const jsonSchema = (schema: z.ZodType): Record<string, unknown> => {
  const { $schema: _version, ...result } = z.toJSONSchema(schema);
  return result;
};

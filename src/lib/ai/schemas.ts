import { z } from "zod";
import type { GeneratedQuestionKind } from "@/types";

const text = z.string();
const texts = z.array(text);
const blank = z.object({ ref: text, answer: text });
const choices = z.object({ ref: text, answer: text, distractors: texts });
export const wordOutput = z.object({
  words: z.array(
    z.object({
      sourceRef: text,
      senses: z.array(
        z.object({ pos: text, meaningZh: text, examples: texts }),
      ),
    }),
  ),
});
export function questionOutput(kind: GeneratedQuestionKind) {
  if (kind === "vocabulary" || kind === "grammar")
    return z.object({ items: z.array(choices.extend({ sentence: text })) });
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
    items: z.array(choices.extend({ question: text })),
  });
}
export const jsonSchema = (schema: z.ZodType): Record<string, unknown> => {
  const { $schema: _version, ...result } = z.toJSONSchema(schema);
  return result;
};

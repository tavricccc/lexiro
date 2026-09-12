import type { LibraryState } from "@/types";
import { z } from "zod";

/**
 * The set editor's form shape lives apart from its markup so the word rows can
 * be typed against it without importing the page component.
 */
const wordSchema = z.object({
  word: z.string().trim().min(1),
  pos: z.string().trim().min(1),
  meaningZh: z.string().trim().min(1),
  examples: z.array(z.string()),
});

export const setFormSchema = z.object({
  setName: z.string().trim().min(1),
  folderId: z.string(),
  words: z.array(wordSchema).min(1),
});

export type SetFormValues = z.infer<typeof setFormSchema>;

export const emptyWord = {
  examples: [""],
  meaningZh: "",
  pos: "",
  word: "",
};

/** Flattens a stored set back into the flat word/sense rows the form edits. */
export function getSetWords(
  state: LibraryState,
  setId: string,
): SetFormValues["words"] {
  return (state.memberships[setId] ?? []).flatMap((membership) => {
    const word = state.words[membership.wordKey];
    if (!word) return [];
    return membership.senseIds.flatMap((senseId) => {
      const sense = word.senses.find((entry) => entry.id === senseId);
      return sense
        ? [
            {
              examples: sense.examples,
              meaningZh: sense.meaningZh,
              pos: sense.pos,
              word: word.word,
            },
          ]
        : [];
    });
  });
}

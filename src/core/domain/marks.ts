// Synced from the lexiro web repo by scripts/sync-core.mjs; edit there, not here.
import { normalizeWord, type SetContent } from "@/core/contract";
import { isCustomStep, type CustomStep } from "./custom";
import type { PracticeItem, Step } from "./practice";

/** A word of the chosen sets, found by its spelling. */
export interface SetWord { setId: string; wordId: string; word: string; meaning: string; starred: boolean }

export function wordIndex(contents: SetContent[]): Map<string, SetWord> {
  const index = new Map<string, SetWord>();
  for (const content of contents) for (const word of content.words) {
    const key = normalizeWord(word.word);
    if (!index.has(key)) index.set(key, { setId: content.set.id, wordId: word.id, word: word.word, meaning: word.senses.map((sense) => sense.meaning).join("；"), starred: word.starred });
  }
  return index;
}

const latin = (text: string | undefined) => !!text && /[A-Za-z]/.test(text) ? text : undefined;

/** The English word an option stands for: the option itself, or the word a meaning belongs to. */
export function optionWord(step: Step | CustomStep, index: number): string | undefined {
  if (isCustomStep(step)) return step.mode === "single" || step.mode === "multiple" ? latin(step.options[index]) : undefined;
  return latin(step.options[index]) ?? latin(step.glosses?.[index]);
}

/** The word the question is about: the word asked, or the right answer of a blank. */
export function promptWord(item: PracticeItem, step: Step | CustomStep): string | undefined {
  if (item.kind === "meaning" || item.kind === "reverse") return item.word;
  if (isCustomStep(step)) return step.mode === "single" ? latin(step.options[step.answer]) : undefined;
  return optionWord(step, step.answer);
}

export const isMarked = (marked: string[], word: string) => marked.some((entry) => normalizeWord(entry) === normalizeWord(word));

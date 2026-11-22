// Synced from the lexiro web repo by scripts/sync-core.mjs; edit there, not here.
import type { CustomItem } from "@/core/contract";
import { shuffle, type Step } from "./practice";

interface Base {
  prompt: string;
  senseId: string;
  wordId: string;
  explanation?: string;
}

/** One 自由題型 item ready to answer: orders and right columns already shuffled. */
export type CustomStep = Base & (
  | { mode: "single"; options: string[]; answer: number; whyWrong?: Record<string, string> }
  | { mode: "multiple"; options: string[]; answers: number[]; whyWrong?: Record<string, string> }
  | { mode: "input"; accepted: string[] }
  /** `pieces` as shown; `order` is the right sequence of their indices. */
  | { mode: "order"; pieces: string[]; order: number[] }
  /** `right` as shown; `match[i]` is the index in `right` that pairs with `left[i]`. */
  | { mode: "match"; left: string[]; right: string[]; match: number[] }
);

/**
 * What a learner answered: an option index, a set of indices (multiple), typed
 * text (input), or a sequence of indices (order: pieces in the chosen order;
 * match: for each left, the right picked). `null` is a skip.
 */
export type Choice = number | number[] | string;

export const isCustomStep = (step: Step | CustomStep): step is CustomStep => "mode" in step;

/** Typed answers compare without case, extra spaces, curly quotes or a final full stop. */
export const normalizeTyped = (value: string) =>
  value.normalize("NFKC").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim().replace(/[.!?。]$/, "").toLocaleLowerCase();

const sameSequence = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((value, index) => value === b[index]);

export function isRight(step: Step | CustomStep, choice: Choice | null | undefined): boolean {
  if (choice === null || choice === undefined) return false;
  if (!isCustomStep(step) || step.mode === "single") return choice === step.answer;
  switch (step.mode) {
    case "multiple":
      return Array.isArray(choice) && sameSequence([...choice].sort((a, b) => a - b), [...step.answers].sort((a, b) => a - b));
    case "input":
      return typeof choice === "string" && step.accepted.some((answer) => normalizeTyped(answer) === normalizeTyped(choice));
    case "order":
      return Array.isArray(choice) && sameSequence(choice, step.order);
    case "match":
      return Array.isArray(choice) && sameSequence(choice, step.match);
  }
}

/** The right answer in words, for feedback and the list of missed cards. */
export function rightAnswerText(step: Step | CustomStep): string {
  if (!isCustomStep(step) || step.mode === "single") return step.options[step.answer];
  switch (step.mode) {
    case "multiple": return step.answers.map((index) => step.options[index]).join("、");
    case "input": return step.accepted[0];
    case "order": return step.order.map((index) => step.pieces[index]).join(" ");
    case "match": return step.left.map((left, index) => `${left} → ${step.right[step.match[index]]}`).join("、");
  }
}

/** Shuffles a list so that, with two or more entries, it never comes out in its original order. */
function scramble<T>(values: readonly T[], random: () => number): number[] {
  const indices = values.map((_, index) => index);
  if (indices.length < 2) return indices;
  for (let attempt = 0; attempt < 8; attempt++) {
    const order = shuffle(indices, random);
    if (order.some((value, index) => value !== index)) return order;
  }
  return [...indices.slice(1), indices[0]];
}

export function customStep(item: CustomItem, wordId: string, random: () => number): CustomStep {
  const base = { prompt: item.prompt, senseId: item.senseId, wordId, explanation: item.explanation };
  switch (item.mode) {
    case "single": return { ...base, mode: "single", options: item.options, answer: item.answer, whyWrong: item.whyWrong };
    case "multiple": return { ...base, mode: "multiple", options: item.options, answers: item.answers, whyWrong: item.whyWrong };
    case "input": return { ...base, mode: "input", accepted: item.accepted };
    case "order": {
      // shown[k] is the original index of the k-th piece shown; the right sequence lists shown positions in original order.
      const shown = scramble(item.pieces, random);
      return { ...base, mode: "order", pieces: shown.map((index) => item.pieces[index]), order: item.pieces.map((_, original) => shown.indexOf(original)) };
    }
    case "match": {
      const shown = scramble(item.pairs, random);
      return { ...base, mode: "match", left: item.pairs.map(([left]) => left), right: shown.map((index) => item.pairs[index][1]), match: item.pairs.map((_, original) => shown.indexOf(original)) };
    }
  }
}

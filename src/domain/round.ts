import type { PracticeItem } from "./practice";

/** A round in progress: which card and step, and every choice made so far. */
export interface Round {
  id: string;
  setIds: string[];
  items: PracticeItem[];
  index: number;
  step: number;
  /** choices[card][step]: the option picked, or null when skipped. */
  choices: (number | null)[][];
  revealed: boolean;
  startedAt: string;
}

export const newRound = (items: PracticeItem[], setIds: string[]): Round => ({
  id: crypto.randomUUID(),
  setIds,
  items,
  index: 0,
  step: 0,
  choices: items.map(() => []),
  revealed: false,
  startedAt: new Date().toISOString(),
});

export const finished = (round: Round) => round.index >= round.items.length;
export const currentStep = (round: Round) => round.items[round.index]?.steps[round.step];

/** Picks an option (or skips with null) and reveals the answer. Picking twice changes nothing. */
export function choose(round: Round, option: number | null): Round {
  if (round.revealed || finished(round)) return round;
  const choices = round.choices.map((card, index) => (index === round.index ? Object.assign([...card], { [round.step]: option }) : card));
  return { ...round, choices, revealed: true };
}

/** On to the next step of the card, or the next card. */
export function advance(round: Round): Round {
  if (!round.revealed) return round;
  const item = round.items[round.index];
  if (round.step + 1 < item.steps.length) return { ...round, step: round.step + 1, revealed: false };
  return { ...round, index: round.index + 1, step: 0, revealed: false };
}

export interface RoundResult {
  total: number;
  correct: number;
  /** Cards with at least one wrong or skipped step. */
  missed: PracticeItem[];
}

export function result(round: Round): RoundResult {
  let total = 0, correct = 0;
  const missed: PracticeItem[] = [];
  round.items.forEach((item, index) => {
    let clean = true;
    item.steps.forEach((step, at) => {
      total += 1;
      if (round.choices[index][at] === step.answer) correct += 1;
      else clean = false;
    });
    if (!clean) missed.push(item);
  });
  return { total, correct, missed };
}

/** Options already used on earlier blanks of a shared bank, which this blank cannot take. */
export function usedBankOptions(round: Round): Set<number> {
  const item = round.items[round.index];
  if (!item || !("bank" in item) || !item.bank) return new Set();
  return new Set(round.choices[round.index].slice(0, round.step).filter((choice): choice is number => choice !== null));
}

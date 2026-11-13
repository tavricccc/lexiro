import { describe, expect, it } from "vitest";
import { advance, choose, finished, newRound, result, usedBankOptions } from "@/domain/round";
import type { PracticeItem } from "@/domain/practice";

const step = (answer: number) => ({ prompt: "p", options: ["a", "b", "c", "d"], answer, senseId: "s", wordId: "w" });
const items: PracticeItem[] = [
  { kind: "vocabulary", questionId: "q1", steps: [step(0)] },
  { kind: "wordBank", questionId: "q2", passage: "__1__ __2__", bank: ["a", "b", "c", "d"], steps: [step(1), step(2)] },
];

describe("a practice round", () => {
  it("reveals the answer once an option is picked", () => {
    expect(choose(newRound(items, []), 0).revealed).toBe(true);
  });

  it("keeps the first pick when picked again", () => {
    expect(choose(choose(newRound(items, []), 0), 3).choices[0]).toEqual([0]);
  });

  it("moves through a passage's steps before the next card", () => {
    let round = advance(choose(newRound(items, []), 0));
    round = advance(choose(round, 1));
    expect([round.index, round.step]).toEqual([1, 1]);
  });

  it("finishes after the last step", () => {
    let round = newRound(items, []);
    for (const pick of [0, 1, 2]) round = advance(choose(round, pick));
    expect(finished(round)).toBe(true);
  });

  it("counts right steps and lists cards with a miss", () => {
    let round = newRound(items, []);
    for (const pick of [0, 1, null]) round = advance(choose(round, pick));
    const outcome = result(round);
    expect([outcome.correct, outcome.total, outcome.missed.map((item) => item.kind)]).toEqual([2, 3, ["wordBank"]]);
  });

  it("marks bank options used on earlier blanks", () => {
    const round = advance(choose(advance(choose(newRound(items, []), 0)), 1));
    expect([...usedBankOptions(round)]).toEqual([1]);
  });
});

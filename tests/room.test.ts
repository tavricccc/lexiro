import { describe, expect, it } from "vitest";
import type { PracticeItem } from "@/domain/practice";
import { roomQuestions } from "@/domain/room";

const step = (blank?: number) => ({ prompt: blank ? "" : "Pick one", options: ["a", "b", "c"], answer: 1, senseId: "s", wordId: "w", ...(blank ? { blank } : {}) });

describe("roomQuestions", () => {
  it("turns each step into one live question without the answer in display", () => {
    const items: PracticeItem[] = [
      { kind: "meaning", word: "rescue", sense: { id: "s", pos: "v.", meaning: "拯救", description: undefined } as never, steps: [step()] },
      { kind: "wordBank", questionId: "q1", title: "T", passage: "x __1__ y __2__", bank: ["a", "b", "c"], steps: [step(1), step(2)] },
    ];
    const questions = roomQuestions(items);
    expect(questions).toHaveLength(3);
    expect(questions[0].display).toEqual({ type: "meaning", prompt: "rescue", options: ["a", "b", "c"] });
    expect(questions[2].display).toMatchObject({ type: "wordBank", blank: 2, sharedBank: true, passage: { id: "q1", title: "T" } });
    expect(questions.every((question) => question.answerIndex === 1 && !("answer" in question.display))).toBe(true);
  });
});

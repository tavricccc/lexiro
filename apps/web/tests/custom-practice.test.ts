import { describe, expect, it } from "vitest";
import { emptyLearning, type CustomQuestion, type SetContent } from "@lexiro/contract";
import { customStep, isRight, normalizeTyped, rightAnswerText, type CustomStep } from "@/domain/custom";
import { availableTasks, buildRound, type PracticeItem } from "@/domain/practice";
import { roomQuestions } from "@/domain/room";
import { acceptTyped, advance, choose, newRound, result } from "@/domain/round";

let seed = 7;
const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const base = { prompt: "p", senseId: "s1", explanation: undefined, id: "i" };

const question: CustomQuestion = {
  id: "q1", setId: "set", kind: "custom", difficulty: 2, label: "語序重組", instructions: undefined, passage: undefined, explanation: undefined, createdAt: "", updatedAt: "",
  items: [{ ...base, mode: "order", pieces: ["She", "has", "already", "left"] }],
};
const content: SetContent = {
  set: { id: "set", name: "S", folderId: null, hue: "mint", icon: "books", order: null, createdAt: "", updatedAt: "", wordCount: 1, questionCount: 1 },
  words: [{ id: "w1", setId: "set", word: "leave", starred: false, updatedAt: "", senses: [{ id: "s1", pos: "v.", meaning: "離開", examples: [], description: undefined, supplementary: false }] }],
  questions: [question],
};

describe("自由題型 grading", () => {
  it("counts a multiple choice right only with exactly the right options", () => {
    const step = customStep({ ...base, mode: "multiple", options: ["a", "b", "c"], answers: [0, 2] }, "w1", random);
    expect([isRight(step, [2, 0]), isRight(step, [0]), isRight(step, [0, 1, 2])]).toEqual([true, false, false]);
  });

  it("accepts a typed answer regardless of case, spacing, curly quotes and a final full stop", () => {
    const step = customStep({ ...base, mode: "input", accepted: ["can't wait"] }, "w1", random);
    expect(isRight(step, "  Can’t   WAIT. ")).toBe(true);
  });

  it("rejects a typed answer that is not accepted", () => {
    const step = customStep({ ...base, mode: "input", accepted: ["colour", "color"] }, "w1", random);
    expect(isRight(step, "collor")).toBe(false);
  });

  it("never shows order pieces already in their right order", () => {
    for (let run = 0; run < 20; run++) {
      const step = customStep(question.items[0], "w1", random) as Extract<CustomStep, { mode: "order" }>;
      expect(step.pieces).not.toEqual(["She", "has", "already", "left"]);
    }
  });

  it("counts an order right when the pieces are placed back in sequence", () => {
    const step = customStep(question.items[0], "w1", random) as Extract<CustomStep, { mode: "order" }>;
    const placed = ["She", "has", "already", "left"].map((piece) => step.pieces.indexOf(piece));
    expect([isRight(step, placed), rightAnswerText(step)]).toEqual([true, "She has already left"]);
  });

  it("counts a match right only when every left side gets its own right side", () => {
    const step = customStep({ ...base, mode: "match", pairs: [["big", "大"], ["small", "小"], ["tall", "高"]] }, "w1", random) as Extract<CustomStep, { mode: "match" }>;
    const right = step.left.map((_, index) => step.right.indexOf(["大", "小", "高"][index]));
    const swapped = [right[1], right[0], right[2]];
    expect([isRight(step, right), isRight(step, swapped)]).toEqual([true, false]);
  });

  it("normalizes full-width text typed on a phone keyboard", () => {
    expect(normalizeTyped("ＡＢＣ")).toBe("abc");
  });
});

describe("自由題型 in practice", () => {
  it("offers 自由題型 when the set has one", () => {
    expect(availableTasks([content])).toContain("custom");
  });

  it("puts a 自由題型 question in a round under its own label", () => {
    const [item] = buildRound({ contents: [content], tasks: ["custom"], amount: 5, focus: "all", learning: emptyLearning(), random });
    expect(item.kind === "custom" ? item.label : null).toBe("語序重組");
  });

  it("leaves 自由題型 out of room questions", () => {
    const items = buildRound({ contents: [content], tasks: ["custom"], amount: 5, focus: "all", learning: emptyLearning(), random });
    expect(roomQuestions(items)).toEqual([]);
  });

  it("scores a typed answer the learner marked right as right", () => {
    const items: PracticeItem[] = [{ kind: "custom", questionId: "q", label: "拼字", steps: [customStep({ ...base, mode: "input", accepted: ["colour"] }, "w1", random)] }];
    const round = acceptTyped(choose(newRound(items, []), "colr"));
    expect(result(advance(round)).correct).toBe(1);
  });

  it("does not let a skipped typed answer be marked right", () => {
    const items: PracticeItem[] = [{ kind: "custom", questionId: "q", label: "拼字", steps: [customStep({ ...base, mode: "input", accepted: ["colour"] }, "w1", random)] }];
    const round = acceptTyped(choose(newRound(items, []), null));
    expect(result(advance(round)).correct).toBe(0);
  });
});

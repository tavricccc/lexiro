import { describe, expect, it } from "vitest";
import { emptyLearning, type SetContent, type Word } from "@lexiro/contract";
import { availableTasks, buildRound, passageParts } from "@/domain/practice";

let seed = 1;
const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const word = (id: string, text: string, senses: [string, string][], starred = false): Word => ({
  id, setId: "s", word: text, starred, updatedAt: "",
  senses: senses.map(([pos, meaning], index) => ({ id: `${id}-${index}`, pos, meaning, examples: [], description: undefined, supplementary: false })),
});
const content = (words: Word[], questions: SetContent["questions"] = []): SetContent => ({
  set: { id: "s", name: "S", folderId: null, hue: "mint", icon: "books", order: null, createdAt: "", updatedAt: "", wordCount: words.length, questionCount: questions.length },
  words, questions,
});
const five = content([
  word("w1", "bank", [["n.", "銀行"], ["n.", "河岸"]]),
  word("w2", "river", [["n.", "河流"]]),
  word("w3", "shore", [["n.", "岸邊"]], true),
  word("w4", "run", [["v.", "跑"]]),
  word("w5", "swim", [["v.", "游泳"]]),
]);
const round = (overrides: Partial<Parameters<typeof buildRound>[0]> = {}) =>
  buildRound({ contents: [five], tasks: ["meaning"], amount: 50, focus: "all", learning: emptyLearning(), random, ...overrides });

describe("practice rounds", () => {
  it("asks each sense once per word task", () => {
    expect(round().length).toBe(6);
  });

  it("never offers another meaning of the same word as a wrong option", () => {
    const item = round().find((entry) => entry.steps[0].prompt === "bank")!;
    expect(item.steps[0].options.filter((option) => option === "銀行" || option === "河岸")).toHaveLength(1);
  });

  it("puts the right answer among the options", () => {
    expect(round().every((item) => item.steps[0].options[item.steps[0].answer] !== undefined)).toBe(true);
  });

  it("does not offer two words sharing the asked meaning in a reverse task", () => {
    const shared = content([word("a", "big", [["adj.", "大的"]]), word("b", "large", [["adj.", "大的"]]), word("c", "red", [["adj.", "紅的"]])]);
    const items = round({ contents: [shared], tasks: ["reverse"] });
    const big = items.find((item) => item.steps[0].prompt === "大的")!;
    expect(big.steps[0].options.filter((option) => option === "big" || option === "large")).toHaveLength(1);
  });

  it("practises only starred words when asked to", () => {
    expect(round({ focus: "starred" }).map((item) => item.steps[0].prompt)).toEqual(["shore"]);
  });

  it("brings the least familiar senses first", () => {
    const learning = emptyLearning();
    for (const id of ["w1-0", "w1-1", "w2-0", "w4-0", "w5-0"]) learning.senses[id] = { wordId: "", level: 3, answered: 3, correct: 3, lastDay: "2026-01-01" };
    expect(round({ focus: "weak", learning })[0].steps[0].senseId).toBe("w3-0");
  });

  it("interleaves tasks instead of running them in blocks", () => {
    expect(round({ tasks: ["meaning", "reverse"], amount: 4 }).map((item) => item.kind)).toEqual(["meaning", "reverse", "meaning", "reverse"]);
  });

  it("stops at the amount asked for", () => {
    expect(round({ amount: 3 })).toHaveLength(3);
  });

  it("offers question kinds only when the sets have such questions", () => {
    expect(availableTasks([five])).toEqual(["meaning", "reverse"]);
  });

  it("turns a shared-bank passage into one card with a step per blank", () => {
    const bank = ["bank", "river", "shore", "run", "swim", "a", "b", "c", "d", "e"];
    const withPassage = content(five.words, [{
      id: "q", setId: "s", kind: "wordBank", difficulty: 1, passage: "The __1__ and the __2__.", bank, createdAt: "", updatedAt: "",
      items: [{ id: "i1", blank: 1, answer: 0, senseId: "w1-0" }, { id: "i2", blank: 2, answer: 1, senseId: "w2-0" }],
    } as SetContent["questions"][number]]);
    const [item] = round({ contents: [withPassage], tasks: ["wordBank"] });
    expect(item.steps.map((step) => [step.blank, step.options.length, step.options[step.answer]])).toEqual([[1, 10, "bank"], [2, 10, "river"]]);
  });

  it("splits a passage into text and blank numbers", () => {
    expect(passageParts("A __1__ b __2__.")).toEqual(["A ", 1, " b ", 2, "."]);
  });
});

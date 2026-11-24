import { describe, expect, it } from "vitest";
import { checkQuestion } from "@lexiro/contract";

const senses = new Map([["s1", "w1"]]);
const custom = (item: object) => ({ kind: "custom", difficulty: 2, label: "搭配詞判斷", items: [{ prompt: "Pick one", senseId: "s1", ...item }] });
const errorCodes = (value: unknown) => {
  const check = checkQuestion(value, senses);
  return check.ok ? [] : check.errors.map((error) => error.code);
};

describe("自由題型 check", () => {
  it("accepts one item of every answer mode", () => {
    const check = checkQuestion({
      kind: "custom", difficulty: 1, label: "混合", items: [
        { mode: "single", prompt: "a", senseId: "s1", options: ["x", "y"], answer: 1 },
        { mode: "multiple", prompt: "b", senseId: "s1", options: ["x", "y", "z"], answers: [0, 2] },
        { mode: "input", prompt: "c", senseId: "s1", accepted: ["colour", "color"] },
        { mode: "order", prompt: "d", senseId: "s1", pieces: ["I", "ran", "home"] },
        { mode: "match", prompt: "e", senseId: "s1", pairs: [["big", "大"], ["small", "小"]] },
      ],
    }, senses);
    expect(check.ok && check.question.kind === "custom" ? check.question.items.map((item) => item.mode) : []).toEqual(["single", "multiple", "input", "order", "match"]);
  });

  it("rejects a single answer outside the options", () => {
    expect(errorCodes(custom({ mode: "single", options: ["x", "y"], answer: 2 }))).toEqual(["answer_range"]);
  });

  it("rejects repeated answers of a multiple item", () => {
    expect(errorCodes(custom({ mode: "multiple", options: ["x", "y"], answers: [1, 1] }))).toEqual(["duplicate_answer"]);
  });

  it("rejects a reason given for a right option of a multiple item", () => {
    expect(errorCodes(custom({ mode: "multiple", options: ["x", "y"], answers: [0], whyWrong: { x: "no" } }))).toEqual(["invalid_why_wrong"]);
  });

  it("rejects repeated pieces, whose order would be ambiguous", () => {
    expect(errorCodes(custom({ mode: "order", pieces: ["the", "cat", "the"] }))).toEqual(["duplicate_piece"]);
  });

  it("rejects a repeated right side of a match", () => {
    expect(errorCodes(custom({ mode: "match", pairs: [["big", "大"], ["large", "大"]] }))).toEqual(["duplicate_pair"]);
  });

  it("rejects an item bound to a sense outside the set", () => {
    expect(errorCodes({ ...custom({ mode: "input", accepted: ["x"] }), items: [{ mode: "input", prompt: "c", senseId: "nope", accepted: ["x"] }] })).toEqual(["unknown_sense"]);
  });

  it("rejects a question without its label", () => {
    expect(errorCodes({ kind: "custom", difficulty: 2, items: [{ mode: "input", prompt: "c", senseId: "s1", accepted: ["x"] }] })).toEqual(["invalid_structure"]);
  });
});

import { describe, expect, it } from "vitest";
import { countEnglishWords, questionLengthRange } from "@lexiro/ai-contract";
import { questionTask } from "@/src/lib/ai/tasks";
import { asSenseId, normalizeWordKey } from "@/src/lib/library";
import { generatedQuestionLengthIssue } from "@/src/lib/question-quality";
import type { WordEntry } from "@/types";

const source: WordEntry = {
  word: "detect",
  wordKey: normalizeWordKey("detect"),
  updatedAt: "2026-10-02",
  senses: [
    {
      id: asSenseId("detect-sense"),
      pos: "v.",
      meaningZh: "察覺",
      examples: [],
      supplementary: false,
    },
  ],
};
const item = {
  sentence:
    "During the chemistry lesson, a sensor could detect a small gas leak before anyone smelled it, so the teacher immediately opened the windows and led everyone outside.",
  answer: "detect",
  usage: "detect",
  distractors: ["prevent", "repair", "contain"],
};

describe("high-school generation quality gate", () => {
  it("counts contractions and hyphenated words once without counting blank numbers", () => {
    expect(
      countEnglishWords("The well-known student can't fill __10__ or _____."),
    ).toBe(6);
  });

  it("rejects a short ambiguous stem and missing distractors at the actual task parser", () => {
    const [step] = questionTask([source], "vocabulary", 2).steps;
    expect(() =>
      step.parse(
        JSON.stringify({
          items: [{ ...item, sentence: "They detect leaks." }],
        }),
      ),
    ).toThrow(/24–40/);
    const { distractors: _distractors, ...missing } = item;
    expect(() => step.parse(JSON.stringify({ items: [missing] }))).toThrow(
      /干擾選項/,
    );
    const [question] = step.parse(JSON.stringify({ items: [item] }));
    expect(
      question.kind === "multipleChoice" &&
        question.options[question.answerIndex],
    ).toBe("detect");
  });

  it("checks full passage length even for a final batch with one blank", () => {
    const [step] = questionTask([source], "wordBank", 2).steps;
    const reply = {
      title: "A safety project",
      passage: `Students detect ${Array.from({ length: 238 }, () => "signals").join(" ")}.`,
      blanks: [{ answer: "detect" }],
      extraOptions: [
        "repair",
        "contain",
        "prevent",
        "support",
        "observe",
        "record",
        "compare",
        "measure",
        "repeat",
      ],
    };
    const [pack] = step.parse(JSON.stringify(reply));
    expect(pack.kind === "reading" && pack.questions).toHaveLength(1);
    expect(pack.kind === "reading" && pack.optionBank).toHaveLength(10);
    expect(() =>
      step.parse(
        JSON.stringify({ ...reply, passage: "Students detect signals." }),
      ),
    ).toThrow(/240–320/);
  });

  it("applies both limits to original passages before cutting whole sentences", () => {
    const range = questionLengthRange("discourse", 3);
    const prose = (count: number) =>
      Array.from({ length: count }, () => "text").join(" ");
    expect(
      generatedQuestionLengthIssue(
        { passage: prose(range.min) },
        "discourse",
        3,
      ),
    ).toBeNull();
    expect(
      generatedQuestionLengthIssue(
        { passage: prose(range.max + 1) },
        "discourse",
        3,
      ),
    ).toMatch(/400/);
  });
});

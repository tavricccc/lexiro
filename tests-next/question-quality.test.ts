import { describe, expect, it } from "vitest";
import { countEnglishWords, questionLengthRange } from "@lexiro/ai-contract";
import { questionTask } from "@/src/lib/ai/tasks";
import { asSenseId, normalizeWordKey } from "@/src/lib/library";
import { generatedQuestionQualityIssue } from "@/src/lib/question-quality";
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
  explanation: "感測器先察覺漏氣，才採取後續處理。",
  whyWrong: ["尚未阻止漏氣。", "尚未進行修理。", "沒有圍堵漏氣。"],
};

describe("high-school generation quality gate", () => {
  it("requires a main idea, a cross-sentence inference and verifiable quoted evidence in reading", () => {
    const first = "The school had only one ladder.";
    const second =
      "Three teams planned to paint different rooms at the same time.";
    const reply = {
      title: "A school project",
      passage: `${first} ${second} ${Array.from({ length: 230 }, () => "context").join(" ")}.`,
      items: [
        {
          question: "What is the main idea?",
          answer: "Planning a school project.",
          distractors: [
            "Buying classroom furniture.",
            "Organizing a sports contest.",
            "Choosing books for a library.",
          ],
          skill: "mainIdea",
          evidence: [first],
        },
        {
          question: "What can be inferred about the teams?",
          answer: "Some teams would need to wait.",
          distractors: [
            "They would cancel the entire project.",
            "They had already completed every room.",
            "They would buy several new buildings.",
          ],
          skill: "inference",
          evidence: [first, second],
        },
        {
          question: "How many teams planned to paint?",
          answer: "Three teams.",
          distractors: ["Two teams.", "Four teams.", "Five teams."],
          skill: "detail",
          evidence: [second],
        },
      ],
    };
    reply.items.forEach((entry) => Object.assign(entry, {
      explanation: "依據文章所述的行動與限制判斷。",
      whyWrong: ["文章不支持這個選項。", "與文章情境矛盾。", "將可能性誤當成事實。"],
    }));
    const [step] = questionTask([source], "reading", 2).steps;
    const [pack] = step.parse(JSON.stringify(reply));
    expect(pack.kind === "reading" && pack.questions).toHaveLength(3);
    const noInference = {
      ...reply,
      items: reply.items.map((entry) => ({
        ...entry,
        skill: entry.skill === "inference" ? "detail" : entry.skill,
      })),
    };
    expect(() => step.parse(JSON.stringify(noInference))).toThrow(/推論題/);
    const repeatedEvidence = {
      ...reply,
      items: reply.items.map((entry) => ({
        ...entry,
        evidence: [first, first],
      })),
    };
    expect(() => step.parse(JSON.stringify(repeatedEvidence))).toThrow(
      /兩處不同句子/,
    );
    const inventedEvidence = {
      ...reply,
      items: reply.items.map((entry) => ({
        ...entry,
        evidence: ["They bought new equipment."],
      })),
    };
    expect(() => step.parse(JSON.stringify(inventedEvidence))).toThrow(
      /逐字引用/,
    );
  });

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
      blanks: [{ answer: "detect", explanation: "察覺到訊號。", whyWrong: Array.from({ length: 9 }, () => "情境未描述這個行動。") }],
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
      generatedQuestionQualityIssue(
        { passage: prose(range.min) },
        "discourse",
        3,
      ),
    ).toBeNull();
    expect(
      generatedQuestionQualityIssue(
        { passage: prose(range.max + 1) },
        "discourse",
        3,
      ),
    ).toMatch(/400/);
  });
});

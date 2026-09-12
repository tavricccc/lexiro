import { describe, expect, it } from "vitest";
import type { WordEntry } from "@/types";
import { asSenseId, normalizeWordKey } from "@/src/lib/library";
import { isWordForm, sentenceContainsWordForm } from "@/src/lib/word-forms";
import { assembleGeneratedQuestions } from "@/src/lib/question-assembly";
import { buildQuestionPrompt } from "@/src/lib/question-prompts";
import { splitGenerationBatches } from "@/src/lib/question-generation";
import { questionTask } from "@/src/lib/ai/tasks";
import { buildRequest } from "@/src/lib/ai/request";
import { createAiSession } from "@/src/lib/ai/session";
import { defaultAiSettings } from "@/src/lib/ai/catalog";
import {
  buildWordGenerationSources,
  parseWordGenerationJson,
} from "@/src/lib/word-generation";

const word = (value: string, meanings = ["測試"], pos = "v."): WordEntry => ({
  word: value,
  wordKey: normalizeWordKey(value),
  updatedAt: "2026-09-12",
  senses: meanings.map((meaningZh, index) => ({
    id: asSenseId(`${value}-${index}`),
    pos,
    meaningZh,
    examples: [],
  })),
});
const assemble = (
  source: WordEntry,
  answer: string,
  sentence: string,
  distractors: string[],
  kind: "vocabulary" | "grammar",
  pool: WordEntry[] = [],
) =>
  assembleGeneratedQuestions(
    { items: [{ ref: "s1", answer, sentence, distractors }] },
    kind,
    2,
    [source],
    pool,
  ).payload.questions as {
    answerIndex: number;
    options: string[];
    prompt: string;
  }[];

describe("issues found in real Luna prompt trials", () => {
  it("accepts the compact Luna low word result and keeps program-parsed words", () => {
    const sources = buildWordGenerationSources(
      "adapt 適應\nrun into 偶然遇見\nsubtle adj. 微妙的",
    );
    const result = parseWordGenerationJson(
      JSON.stringify({
        items: [
          {
            pos: "v.",
            meaningZh: "適應",
            example: "Children adapt quickly to change.",
          },
          {
            pos: "phr. v.",
            meaningZh: "偶然遇見",
            example: "I ran into an old friend yesterday.",
          },
          {
            meaningZh: "微妙的",
            example: "There is a subtle difference between them.",
          },
        ],
      }),
      sources,
      true,
    );
    expect(result.map((entry) => entry.word)).toEqual([
      "adapt",
      "run into",
      "subtle",
    ]);
  });

  it("accepts the compact no-ref Luna low vocabulary result", () => {
    const words = [
      word("detect", ["察覺；發現"]),
      word("reluctant", ["不情願的"], "adj."),
      word("consequence", ["後果"], "n."),
    ];
    const [step] = questionTask(words, words, "vocabulary", 2).steps;
    const questions = step.parse(
      JSON.stringify({
        items: [
          {
            sentence: "A sensor can detect a gas leak before anyone smells it.",
            answer: "detect",
            distractors: ["prevent", "repair", "announce"],
          },
          {
            sentence:
              "Although Mia was reluctant to speak at first, she shared her idea after her classmates encouraged her.",
            answer: "reluctant",
            distractors: ["eager", "proud", "ready"],
          },
          {
            sentence:
              "One consequence of leaving the freezer door open was that all the food spoiled overnight.",
            answer: "consequence",
            distractors: ["benefit", "symptom", "decision"],
          },
        ],
      }),
    );
    expect(questions).toHaveLength(3);
    expect(
      questions.map((question) =>
        question.kind === "reading" ? "" : question.wordKey,
      ),
    ).toEqual(["detect", "reluctant", "consequence"]);
  });
  it.each([
    ["go", "went"],
    ["take", "took"],
    ["take", "taken"],
    ["look after", "looked after"],
    ["carry out", "carried out"],
    ["run", "running"],
  ])("accepts the legitimate %s → %s form", (base, form) =>
    expect(isWordForm(form, base)).toBe(true),
  );
  it("does not confuse a shared prefix with a form of the target word", () => {
    expect(isWordForm("wanderer", "wander")).toBe(false);
    expect(isWordForm("gold", "go")).toBe(false);
    expect(sentenceContainsWordForm("They went home.", "go")).toBe(true);
    expect(
      sentenceContainsWordForm("The golden statue stood outside.", "go"),
    ).toBe(false);
  });
  it("preserves grammar forms supplied by the model rather than replacing them with library verbs", () => {
    const questions = assemble(
      word("go"),
      "went",
      "Yesterday, Mei went to the library.",
      ["go", "goes", "going"],
      "grammar",
      [word("walk"), word("jump"), word("sleep")],
    );
    expect(new Set(questions[0].options)).toEqual(
      new Set(["went", "go", "goes", "going"]),
    );
  });
  it("can test a related grammar feature while retaining the selected vocabulary in context", () => {
    const [question] = assemble(
      word("interested", ["感興趣的"], "adj."),
      "in",
      "Mia is interested in studying ancient maps.",
      ["on", "at", "to"],
      "grammar",
    );
    expect(question.prompt).toBe(
      "Mia is interested _____ studying ancient maps.",
    );
    expect(() =>
      assemble(
        word("interested"),
        "in",
        "Mia lives in Taipei.",
        ["on", "at", "to"],
        "grammar",
      ),
    ).toThrow();
  });
  it("accepts competing multiword verb forms for a single-word grammar answer", () => {
    const [question] = assemble(
      word("go"),
      "went",
      "Last Friday, Mei went to the museum.",
      ["has gone", "goes", "going"],
      "grammar",
    );
    expect(question.options).toContain("has gone");
  });
  it("preserves context-designed vocabulary distractors", () => {
    const [question] = assemble(
      word("detect"),
      "detect",
      "The sensor can detect leaks before the pipe bursts.",
      ["repair", "prevent", "cause"],
      "vocabulary",
      [word("jump"), word("sleep"), word("eat")],
    );
    expect(new Set(question.options)).toEqual(
      new Set(["detect", "repair", "prevent", "cause"]),
    );
  });
  it("does not embed a first-segment output count into persistent context", () => {
    const words = [
      "adapt",
      "apply",
      "avoid",
      "begin",
      "bring",
      "build",
      "carry",
      "choose",
      "close",
    ].map((w) => word(w));
    const task = questionTask(words, words, "vocabulary", 2);
    expect(task.context).not.toContain("共 8 筆");
    expect(task.context).toContain("同一個 ref 可在追加新題時再次指定");
    expect(task.steps[1].prompt).toContain("items 恰好 1 筆");
    expect(task.steps[1].prompt).toContain('"s9"');
    expect(task.steps[1].prompt).not.toContain("不要重複先前已完成的來源");
  });
  it("has a single coherent discourse length at medium difficulty", () => {
    const prompt = buildQuestionPrompt("discourse", [word("observe")], 2).text;
    expect(prompt).toContain("至少 10 句");
    expect(prompt).not.toContain("6 至 8");
    expect(prompt).toContain("不得移除相鄰句");
  });
  it("separates repeated spellings without adding unnecessary passages", () => {
    const words = [
      ...["observe", "measure", "record", "compare", "predict"].map((w) =>
        word(w),
      ),
      word("current", ["水流", "目前的"]),
    ];
    const packs = splitGenerationBatches(words, "reading");
    expect(packs).toHaveLength(2);
    expect(
      packs.every(
        (pack) =>
          pack.length <= 5 &&
          new Set(pack.map((w) => w.wordKey)).size === pack.length,
      ),
    ).toBe(true);
    expect(packs.flat().flatMap((w) => w.senses)).toHaveLength(7);
  });
  it("uses the tested low effort for the built-in Luna preset", () => {
    const request = buildRequest(
      createAiSession(defaultAiSettings, "context"),
      "next",
      {},
    );
    expect(request.body.reasoning).toEqual({ effort: "low" });
  });
});

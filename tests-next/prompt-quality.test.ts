import { describe, expect, it } from "vitest";
import type { WordEntry } from "@/types";
import { asSenseId, normalizeWordKey } from "@/src/lib/library";
import { assembleGeneratedQuestions } from "@/src/lib/question-assembly";
import { splitGenerationBatches } from "@/src/lib/question-generation";
import { questionTask } from "@/src/lib/ai/tasks";
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
    supplementary: false,
  })),
});
const assemble = (
  source: WordEntry,
  answer: string,
  sentence: string,
  distractors: string[],
  kind: "vocabulary",
  usage = answer,
) =>
  assembleGeneratedQuestions(
    { items: [{ ref: "s1", answer, usage, sentence, distractors }] },
    kind,
    2,
    [source],
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
            senses: [
              {
                pos: "v.",
                meaningZh: "適應",
                example: "Children adapt quickly to change.",
              },
            ],
          },
          {
            senses: [
              {
                pos: "phr. v.",
                meaningZh: "偶然遇見",
                example: "I ran into an old friend yesterday.",
              },
            ],
          },
          {
            senses: [
              {
                pos: null,
                meaningZh: "微妙的",
                example: "There is a subtle difference between them.",
              },
            ],
          },
        ],
      }),
      sources,
    );
    expect(result.map((entry) => entry.word)).toEqual([
      "adapt",
      "run into",
      "subtle",
    ]);
  });

  it("maps no-ref vocabulary results with sufficient context to their source senses", () => {
    const words = [
      word("detect", ["察覺；發現"]),
      word("reluctant", ["不情願的"], "adj."),
      word("consequence", ["後果"], "n."),
    ];
    const [step] = questionTask(words, "vocabulary", 2).steps;
    const questions = step.parse(
      JSON.stringify({
        items: [
          {
            sentence: "During the chemistry lesson, a sensor could detect a small gas leak before anyone smelled it, so the teacher opened the windows and led everyone outside.",
            answer: "detect",
            usage: "detect",
            explanation: "這是結構測試用的審題解說。",
            whyWrong: ["prevent", "repair", "announce"].map((option, index) => ({ option, reason: ["不符線索一。", "不符線索二。", "不符線索三。"][index] })),
            distractors: ["prevent", "repair", "announce"],
          },
          {
            sentence:
              "Although Mia was reluctant to speak during the class debate at first, she finally shared her idea after her classmates encouraged her and listened patiently.",
            answer: "reluctant",
            usage: "reluctant",
            explanation: "這是結構測試用的審題解說。",
            whyWrong: ["eager", "proud", "ready"].map((option, index) => ({ option, reason: ["不符線索一。", "不符線索二。", "不符線索三。"][index] })),
            distractors: ["eager", "proud", "ready"],
          },
          {
            sentence:
              "One consequence of leaving the freezer door open throughout the night was that all the food spoiled, forcing the restaurant to cancel its planned lunch service.",
            answer: "consequence",
            usage: "consequence",
            explanation: "這是結構測試用的審題解說。",
            whyWrong: ["benefit", "symptom", "decision"].map((option, index) => ({ option, reason: ["不符線索一。", "不符線索二。", "不符線索三。"][index] })),
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
  it("preserves context-designed vocabulary distractors", () => {
    const [question] = assemble(
      word("detect"),
      "detect",
      "The sensor can detect leaks before the pipe bursts.",
      ["repair", "prevent", "cause"],
      "vocabulary",
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
      "create", "cross", "decide", "deliver", "discover", "explain", "finish", "follow",
      "close",
    ].map((w) => word(w));
    const task = questionTask(words, "vocabulary", 2);
    const request = JSON.parse(task.steps.at(-1)!.prompt);
    expect(request.sources).toHaveLength(1);
    expect(request.sources[0].ref).toBe("s17");
    expect(request).not.toHaveProperty("instructions");
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
});

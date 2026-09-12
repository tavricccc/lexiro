import type { WordEntry } from "@/types";
import { describe, expect, it } from "vitest";

import { buildImportPrompt } from "@/src/lib/importPrompt";
import {
  buildQuestionGenerationPrompt,
  questionBatchSize,
  splitGenerationBatches,
} from "@/src/lib/question-generation";
import { asSenseId, normalizeWordKey } from "@/src/lib/library";
import {
  buildWordGenerationSources,
  parseWordGenerationJson,
} from "@/src/lib/word-generation";

const word: WordEntry = {
  wordKey: normalizeWordKey("adapt"),
  word: "adapt",
  senses: [
    {
      id: asSenseId("adapt:v:1"),
      pos: "v.",
      meaningZh: "適應",
      examples: ["We adapt quickly."],
    },
  ],
  updatedAt: "2026-08-16T00:00:00.000Z",
};

describe("AI prompts", () => {
  it("keeps word generation small and JSON-only", () => {
    const prompt = buildImportPrompt("adapt 適應", undefined, true);
    expect(prompt).toContain("每項只回傳最常見");
    expect(prompt).toContain("不要 Markdown");
    expect(prompt).not.toContain("```json");
  });

  it("accepts fenced JSON from less compliant models", () => {
    const sources = buildWordGenerationSources("adapt");
    const response =
      '```json\n{"items":[{"pos":"v.","meaningZh":"適應"}]}\n```';
    expect(parseWordGenerationJson(response, sources, false)[0]?.word).toBe(
      "adapt",
    );
  });

  it("parses an explicit part of speech in code and sends it separately", () => {
    const [source] = buildWordGenerationSources("subtle adj. 微妙的");
    expect(source).toMatchObject({
      word: "subtle",
      posHint: "adj.",
      hint: "微妙的",
    });
    const prompt = buildImportPrompt("subtle adj. 微妙的");
    expect(prompt).toContain(
      '"word":"subtle","posHint":"adj.","hint":"微妙的"',
    );
    expect(prompt).not.toContain('"word":"subtle adj"');
    expect(
      buildWordGenerationSources("look after phr. v. 照顧")[0],
    ).toMatchObject({
      word: "look after",
      posHint: "phr. v.",
      hint: "照顧",
    });
    expect(buildWordGenerationSources("run 動詞 跑步")[0]).toMatchObject({
      word: "run",
      posHint: "v.",
      hint: "跑步",
    });
  });

  it("never asks the model for the blank, the answer index or an id", () => {
    for (const kind of [
      "vocabulary",
      "grammar",
      "cloze",
      "wordBank",
      "discourse",
      "reading",
    ] as const) {
      const prompt = buildQuestionGenerationPrompt([word], kind, 2);
      expect(prompt, kind).not.toContain("answerIndex");
      expect(prompt, kind).not.toContain("_____");
      expect(prompt, kind).not.toContain("fingerprint");
      expect(prompt, kind).toContain("不要輸出 ref");
      expect(prompt, kind).toContain("只輸出一個 JSON object");
      expect(prompt, kind).not.toContain("```json");
    }
  });

  it("tells the model to leave the target word in the prose", () => {
    for (const kind of ["vocabulary", "cloze", "wordBank"] as const)
      expect(buildQuestionGenerationPrompt([word], kind, 2), kind).toContain(
        "原封不動",
      );
  });

  it("names the Taiwanese exam format it is imitating", () => {
    expect(buildQuestionGenerationPrompt([word], "vocabulary", 2)).toContain(
      "詞彙題",
    );
    expect(buildQuestionGenerationPrompt([word], "cloze", 2)).toContain(
      "綜合測驗",
    );
    expect(buildQuestionGenerationPrompt([word], "wordBank", 2)).toContain(
      "文意選填",
    );
    expect(buildQuestionGenerationPrompt([word], "discourse", 2)).toContain(
      "篇章結構",
    );
    expect(buildQuestionGenerationPrompt([word], "reading", 2)).toContain(
      "閱讀測驗",
    );
  });

  it("varies the difficulty guidance rather than repeating one line", () => {
    const [easy, medium, hard] = ([1, 2, 3] as const).map((level) =>
      buildQuestionGenerationPrompt([word], "vocabulary", level),
    );
    expect(new Set([easy, medium, hard]).size).toBe(3);
    expect(easy).toContain("線索直接且充分");
    expect(hard).toContain("跨句資訊整合");
  });

  it("drops the distractor request when the library can supply them", () => {
    const withDistractors = buildQuestionGenerationPrompt(
      [word],
      "vocabulary",
      2,
      { needDistractors: true },
    );
    const withoutDistractors = buildQuestionGenerationPrompt(
      [word],
      "vocabulary",
      2,
      { needDistractors: false },
    );
    expect(withDistractors).toContain("distractors");
    expect(withoutDistractors).toContain("由程式");
  });
});

describe("question batching", () => {
  const manySenses = (count: number): WordEntry[] =>
    Array.from({ length: count }, (_, index) => ({
      wordKey: normalizeWordKey(`word-${index}`),
      word: `word-${index}`,
      senses: [
        {
          id: asSenseId(`word-${index}:v:1`),
          pos: "v.",
          meaningZh: "測試",
          examples: [],
        },
      ],
      updatedAt: "2026-08-16T00:00:00.000Z",
    }));

  it("sizes a batch from the format rather than one global constant", () => {
    expect(questionBatchSize("wordBank")).toBeGreaterThan(
      questionBatchSize("discourse"),
    );
  });

  it("splits a selection larger than one request into whole batches", () => {
    const size = questionBatchSize("vocabulary");
    const batches = splitGenerationBatches(manySenses(20), "vocabulary");
    expect(batches).toHaveLength(Math.ceil(20 / size));
    expect(batches.every((batch) => batch.length <= size)).toBe(true);
  });

  it("covers every selected sense exactly once", () => {
    const covered = splitGenerationBatches(
      manySenses(20),
      "vocabulary",
    ).flatMap((batch) =>
      batch.flatMap((entry) => entry.senses.map((sense) => sense.id)),
    );
    expect(covered).toHaveLength(20);
    expect(new Set(covered).size).toBe(20);
  });

  it("makes one passage per batch instead of dropping the rest", () => {
    const packs = splitGenerationBatches(manySenses(20), "cloze");
    expect(packs).toHaveLength(Math.ceil(20 / questionBatchSize("cloze")));
    expect(packs.flat()).toHaveLength(20);
  });

  it("never leaves a word without senses in a batch", () => {
    const batches = splitGenerationBatches(manySenses(9), "vocabulary");
    expect(
      batches.every((batch) => batch.every((entry) => entry.senses.length > 0)),
    ).toBe(true);
  });
});

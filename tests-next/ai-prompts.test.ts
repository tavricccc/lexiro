import type { WordEntry } from "@/types";
import { describe, expect, it } from "vitest";

import {
  questionBatchSize,
  splitGenerationBatches,
} from "@/src/lib/question-generation";
import { asSenseId, normalizeWordKey } from "@/src/lib/library";
import {
  buildWordGenerationSources,
  parseWordGenerationJson,
} from "@/src/lib/word-generation";

describe("AI prompts", () => {
  it("accepts fenced JSON from less compliant models", () => {
    const sources = buildWordGenerationSources("adapt");
    const response =
      '```json\n{"items":[{"senses":[{"pos":"v.","meaningZh":"適應","example":"Children adapt quickly."}]}]}\n```';
    expect(parseWordGenerationJson(response, sources)[0]?.word).toBe("adapt");
  });

  it("parses an explicit part of speech in code and sends it separately", () => {
    const [source] = buildWordGenerationSources("subtle adj. 微妙的");
    expect(source).toMatchObject({
      word: "subtle",
      posHint: "adj.",
      hint: "微妙的",
    });
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

  // Organization now puts a part of speech on every line it returns, so these
  // are the shapes the generation step is handed in practice.
  it("splits every shape the organizer emits into word, part of speech and hint", () => {
    expect(buildWordGenerationSources("adapt v. 適應")[0]).toMatchObject({
      word: "adapt",
      posHint: "v.",
      hint: "適應",
    });
    expect(
      buildWordGenerationSources("in spite of phr. 不管與雖然")[0],
    ).toMatchObject({
      word: "in spite of",
      posHint: "phr.",
      hint: "不管與雖然",
    });
    expect(buildWordGenerationSources("can modal v. 能夠")[0]).toMatchObject({
      word: "can",
      posHint: "modal v.",
      hint: "能夠",
    });
    // A source with no Chinese of its own stays that way: the generation step
    // chooses the meaning, and inventing one here would pre-empt it.
    const [bare] = buildWordGenerationSources("apple n.");
    expect(bare).toMatchObject({ word: "apple", posHint: "n." });
    expect(bare?.hint).toBeUndefined();
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

  it("uses 15 independent questions per batch while passage groups follow their format", () => {
    expect(questionBatchSize("vocabulary")).toBe(15);
    expect(questionBatchSize("grammar")).toBe(15);
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

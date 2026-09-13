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

// The ceiling on how many senses may come back is the only thing standing
// between a source and a model that pads. It is asserted here because a reply
// that quietly gains a meaning looks exactly like a good one.
describe("how many senses a source may come back with", () => {
  const reply = (...meanings: string[]) =>
    JSON.stringify({
      items: [
        {
          senses: meanings.map((meaningZh) => ({
            pos: "n.",
            meaningZh,
            example: "The example says what it means.",
          })),
        },
      ],
    });

  it("refuses a meaning the source never asked for", () => {
    const sources = buildWordGenerationSources("apple n. 蘋果");
    expect(parseWordGenerationJson(reply("蘋果"), sources)[0]?.senses).toHaveLength(1);
    expect(() => parseWordGenerationJson(reply("蘋果", "眼珠"), sources)).toThrow(
      /詞義數量不正確/,
    );
  });

  it("counts the meanings a hint names, however they are joined", () => {
    const both = buildWordGenerationSources("bank n. 銀行與河岸");
    expect(parseWordGenerationJson(reply("銀行", "河岸"), both)[0]?.senses).toHaveLength(2);
    expect(() =>
      parseWordGenerationJson(reply("銀行", "河岸", "銀行業"), both),
    ).toThrow(/詞義數量不正確/);
    const three = buildWordGenerationSources("break v. 故障並可指崩潰或分解");
    expect(
      parseWordGenerationJson(reply("故障", "崩潰", "分解"), three)[0]?.senses,
    ).toHaveLength(3);
  });

  it("allows one meaning for a source that names none", () => {
    const bare = buildWordGenerationSources("apple n.");
    expect(parseWordGenerationJson(reply("蘋果"), bare)[0]?.senses).toHaveLength(1);
    expect(() => parseWordGenerationJson(reply("蘋果", "眼珠"), bare)).toThrow(
      /詞義數量不正確/,
    );
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
          supplementary: false,
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

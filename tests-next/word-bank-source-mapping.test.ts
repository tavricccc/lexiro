import { describe, expect, it } from "vitest";
import type { WordEntry } from "@/types";
import { asSenseId, normalizeWordKey } from "@/src/lib/library";
import { questionTask } from "@/src/lib/ai/tasks";

const source = (word: string, pos: string, meaningZh: string): WordEntry => ({
  word,
  wordKey: normalizeWordKey(word),
  updatedAt: "2026-10-09",
  senses: [
    {
      id: asSenseId(`${word}:${meaningZh}`),
      pos,
      meaningZh,
      examples: [],
      supplementary: false,
    },
  ],
});

function fixture() {
  const plot = source("plot", "n.", "故事情節");
  const words = [
    source("mechanical", "adj.", "機械的"),
    plot,
    source("child", "n.", "孩子"),
    source("be", "aux.", "是"),
    source("take off", "phr. v.", "脫下"),
  ];
  const options = [
    "plot",
    "children",
    "is",
    "mechanical",
    "took",
    "current",
    "good",
    "bank",
    "adjusted",
    "reliable",
  ];
  const blank = (
    ref: string,
    answer: string,
    usage: string,
    explanation: string,
  ) => ({
    ref,
    answer,
    usage,
    explanation,
    whyWrong: options
      .filter((option) => option !== answer)
      .map((option) => ({
        option,
        reason: `${explanation}這個選項不符本格的線索。`,
      })),
  });
  // Raw order deliberately differs from both source order and prose order.
  const blanks = [
    blank("s5", "took", "took her wet coat off", "最後脫下外套。"),
    blank("s1", "mechanical", "mechanical clock", "中段以齒輪運作。"),
    blank("s3", "children", "children read", "兩個正在閱讀的孩子。"),
    blank("s4", "is", "is exciting", "小說目前令人興奮。"),
    blank("s2", "plot", "plot of the novel", "開頭描述小說的情節。"),
  ];
  const reply = {
    title: "A school project",
    passage: `The plot of the novel is exciting. The children read together. A mechanical clock works through gears. She took her wet coat off. ${Array.from({ length: 238 }, () => "context").join(" ")}.`,
    options,
    blanks,
  };
  return { words, reply };
}

describe("WordBank declared source ownership", () => {
  it("preserves word, sense and teaching while numbering actual spans in prose order", () => {
    const { words, reply } = fixture();
    const [step] = questionTask(words, "wordBank", 2).steps;
    for (const blanks of [reply.blanks, [...reply.blanks].reverse()]) {
      const [pack] = step.parse(JSON.stringify({ ...reply, blanks }));
      expect(pack.kind).toBe("reading");
      if (pack.kind !== "reading") throw new Error("Expected reading pack");
      expect(pack.passage).toContain(
        "The __1__ of the novel __2__ exciting. The __3__ read together. A __4__ clock works through gears. She __5__ her wet coat off.",
      );
      expect(
        pack.questions.map((item) => [item.wordKey, item.senseId]),
      ).toEqual([
        [words[1].wordKey, words[1].senses[0].id],
        [words[3].wordKey, words[3].senses[0].id],
        [words[2].wordKey, words[2].senses[0].id],
        [words[0].wordKey, words[0].senses[0].id],
        [words[4].wordKey, words[4].senses[0].id],
      ]);
      expect(
        pack.questions.map((item) => item.options[item.answerIndex]),
      ).toEqual(["plot", "is", "children", "mechanical", "took"]);
      expect(pack.questions.map((item) => item.explanation)).toEqual([
        "開頭描述小說的情節。",
        "小說目前令人興奮。",
        "兩個正在閱讀的孩子。",
        "中段以齒輪運作。",
        "最後脫下外套。",
      ]);
      expect(pack.questions[0].whyWrong?.current).toBe(
        "開頭描述小說的情節。這個選項不符本格的線索。",
      );
      expect(pack.questions[4].whyWrong?.current).toBe(
        "最後脫下外套。這個選項不符本格的線索。",
      );
    }
  });

  it("rejects missing, unknown, duplicated and uncovered refs without guessing positions", () => {
    const { words, reply } = fixture();
    const [step] = questionTask(words, "wordBank", 2).steps;
    for (const [blanks, message] of [
      [
        reply.blanks.map((blank, index) =>
          index === 0 ? { ...blank, ref: undefined } : blank,
        ),
        /缺少來源 ref/,
      ],
      [
        reply.blanks.map((blank, index) =>
          index === 0 ? { ...blank, ref: "s99" } : blank,
        ),
        /未知的來源 ref/,
      ],
      [
        reply.blanks.map((blank, index) =>
          index === 0 ? { ...blank, ref: "s1" } : blank,
        ),
        /來源 ref.*重複/,
      ],
      [reply.blanks.slice(1), /每個來源 ref.*一次/],
    ] as const) {
      const text = JSON.stringify({ ...reply, blanks });
      expect(() => step.parse(text)).toThrow(message);
      expect(step.recover!(text)).toBeNull();
    }
  });

  it("repairs the raw item position while retaining its declared ref and source form", () => {
    const { words, reply } = fixture();
    const [step] = questionTask(words, "wordBank", 2).steps;
    const original = reply.blanks[0];
    const invalid = {
      ...original,
      whyWrong: original.whyWrong.map((reason, index) =>
        index === 0 ? { ...reason, option: "invented" } : reason,
      ),
    };
    const recovery = step.recover!(
      JSON.stringify({ ...reply, blanks: [invalid, ...reply.blanks.slice(1)] }),
    );
    expect(recovery?.remaining).toHaveLength(1);
    const repair = recovery!.remaining[0];
    const input = JSON.parse(repair.prompt);
    expect(input.itemRepair.index).toBe(0);
    expect(input.itemRepair.items[0]).toMatchObject({
      ref: "s5",
      answer: "took",
    });
    expect(
      input.sources.find((item: { ref: string }) => item.ref === "s5").word,
    ).toBe("take off");
    expect(repair.stagedQuestions).toBe(4);
    expect(() =>
      repair.parse(JSON.stringify({ items: [{ ...original, ref: "s4" }] })),
    ).toThrow(/保留本格的來源 ref/);
    expect(() =>
      repair.parse(
        JSON.stringify({ items: [{ ...reply.blanks[4], ref: "s5" }] }),
      ),
    ).toThrow(/合法詞形/);
    expect(repair.stagedQuestions).toBe(4);
    const [pack] = repair.parse(JSON.stringify({ items: [original] }));
    expect(pack.kind === "reading" && pack.questions[4]).toMatchObject({
      wordKey: "take off",
      senseId: words[4].senses[0].id,
      explanation: original.explanation,
    });
  });

  it("uses batch-local refs after a prior WordBank passage without changing step identity", () => {
    const words = [
      "camera",
      "window",
      "button",
      "signal",
      "teacher",
      "student",
      "river",
      "bridge",
      "station",
      "letter",
      "parcel",
    ].map((word) => source(word, "n.", "目標"));
    const task = questionTask(words, "wordBank", 2);
    const last = task.steps.at(-1)!;
    const sources = JSON.parse(last.prompt).sources as Array<{
      ref: string;
      word: string;
    }>;
    expect(sources.map((item) => item.ref)).toEqual(
      sources.map((_, index) => `s${index + 1}`),
    );
    expect(last.id).not.toBe("s1");
    const options = [
      ...sources.map((item) => item.word),
      ...Array.from(
        { length: 10 - sources.length },
        (_, index) => `extra${index}`,
      ),
    ];
    const reply = {
      title: "Another passage",
      passage: `${sources.map((item) => `The ${item.word} arrived.`).join(" ")} ${Array.from({ length: 240 }, () => "context").join(" ")}.`,
      options,
      blanks: [...sources]
        .reverse()
        .map((item) => ({
          ref: item.ref,
          answer: item.word,
          usage: `The ${item.word} arrived`,
          explanation: "本格描述指定目標。",
          whyWrong: options
            .filter((option) => option !== item.word)
            .map((option) => ({ option, reason: "不是本格的指定目標。" })),
        })),
    };
    const [pack] = last.parse(JSON.stringify(reply));
    expect(
      pack.kind === "reading" && pack.questions.map((item) => item.wordKey),
    ).toEqual(sources.map((item) => item.word));
  });
});

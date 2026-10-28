import { describe, expect, it } from "vitest";
import type { SenseId, StudyWord, WordKey } from "@/types";
import {
  buildMeaningQuestionGroups,
  buildReverseQuestionGroups,
  isCorrectChoice,
} from "@/components/practice/meaning-questions";
import {
  buildPracticeQueue,
  entriesFromIds,
} from "@/components/practice/practice-queue";
import {
  buildSenseId,
  buildSetWordKey,
  descriptionPoints,
} from "@/src/lib/library";

function word(name: string, meaning: string): StudyWord {
  return {
    id: `${name}:${meaning}` as SenseId,
    wordKey: name as WordKey,
    word: name,
    pos: "n.",
    meaning,
    examples: [],
    example: "",
    supplementary: false,
    description: "",
  };
}
const words = [
  word("bank", "銀行"),
  word("bank", "河岸"),
  word("shore", "河岸"),
  word("apple", "蘋果"),
  word("cloud", "雲"),
  word("book", "書"),
];

describe("what a local word question reveals", () => {
  const described = [
    { ...word("rescue", "救援"), pos: "v.", description: "常用被動" },
    word("apple", "蘋果"),
    word("cloud", "雲"),
    word("book", "書"),
  ];
  it("shows the description only after answering, and each wrong option's meaning", () => {
    for (const item of [
      ...buildMeaningQuestionGroups(described),
      ...buildReverseQuestionGroups(described),
    ].flat()) {
      if (item.wordKey !== "rescue") continue;
      expect(item.prompt).not.toContain("常用被動");
      expect(item.options.join()).not.toContain("常用被動");
      expect(item.explanation).toBe("常用被動");
      const wrong = item.options.filter((_, index) => index !== item.answerIndex);
      expect(Object.keys(item.whyWrong!).sort()).toEqual([...wrong].sort());
    }
    const reverse = buildReverseQuestionGroups(described)
      .flat()
      .find((item) => item.wordKey === "apple")!;
    expect(reverse.whyWrong?.rescue).toBe("v. 救援");
    expect(reverse).not.toHaveProperty("explanation");
    const meaning = buildMeaningQuestionGroups(described)
      .flat()
      .find((item) => item.wordKey === "apple")!;
    expect(meaning.whyWrong?.["救援"]).toBe("rescue");
  });
});

describe("local English-to-Chinese questions", () => {
  it("keeps scoped accepted meanings independent while excluding all same-spelling senses and aliases from distractors", () => {
    const scoped = (setId: string, name: string, meaning: string) => {
      const wordKey = buildSetWordKey(setId, name);
      return {
        ...word(name, meaning),
        wordKey,
        id: buildSenseId(wordKey, "n.", meaning),
      };
    };
    const bankA = scoped("set-a", "bank", "銀行");
    const bankB = scoped("set-b", "BANK", "河岸");
    const items = buildMeaningQuestionGroups([
      bankA,
      bankB,
      scoped("set-b", "shore", "海岸、河岸"),
      scoped("set-a", "apple", "蘋果"),
      scoped("set-b", "cloud", "雲"),
      scoped("set-a", "book", "書"),
    ]).flat();
    const first = items.find((item) => item.wordKey === bankA.wordKey)!;
    const second = items.find((item) => item.wordKey === bankB.wordKey)!;
    expect(first.acceptedMeanings).toEqual(["銀行"]);
    expect(second.acceptedMeanings).toEqual(["河岸"]);
    expect(new Set(first.options)).toEqual(
      new Set(["銀行", "蘋果", "雲", "書"]),
    );
    expect(new Set(second.options)).toEqual(
      new Set(["河岸", "蘋果", "雲", "書"]),
    );
    expect(first.senseId).toBe(bankA.id);
    expect(second.senseId).toBe(bankB.id);
  });

  it("uses any saved sense as the answer and keeps exactly one target meaning among four distinct options", () => {
    const bankItems = buildMeaningQuestionGroups(words)
      .flat()
      .filter((item) => item.wordKey === "bank");
    expect(bankItems).toHaveLength(2);
    expect(
      new Set(bankItems.map((item) => item.options[item.answerIndex])),
    ).toEqual(new Set(["銀行", "河岸"]));
    for (const item of bankItems) {
      expect(item.options).toHaveLength(4);
      expect(new Set(item.options).size).toBe(4);
      expect(
        item.options.filter((_, index) => isCorrectChoice(item, index)),
      ).toHaveLength(1);
      expect(
        isCorrectChoice({ ...item, options: ["河岸", "蘋果", "雲", "書"] }, 0),
      ).toBe(true);
    }
  });
  it("does not invent distractors when fewer than three distinct wrong meanings exist", () => {
    expect(buildMeaningQuestionGroups(words.slice(0, 3))).toEqual([]);
  });
  it("asks one meaning per word and restores the exact saved choices", () => {
    const groups = buildMeaningQuestionGroups(words);
    const queue = buildPracticeQueue({
      amount: 20,
      tasks: ["meaning"],
      oneSensePerWord: false,
      allowedSenseIds: new Set(words.map((word) => word.id)),
      difficulty: "3",
      questionGroups: groups,
      studyItems: words,
    });
    const keys = queue.map((entry) => entry.item.wordKey);
    expect(new Set(keys).size).toBe(queue.length);
    const saved = Object.fromEntries(
      queue.flatMap((entry) =>
        entry.kind === "question"
          ? [
              [
                entry.id,
                {
                  options: [...entry.item.options].reverse(),
                  answerIndex: 3 - entry.item.answerIndex,
                },
              ],
            ]
          : [],
      ),
    );
    const restored = entriesFromIds(
      queue.map((entry) => entry.id),
      ["meaning"],
      [...words, word("river", "河流")],
      [],
      saved,
    );
    expect(
      restored?.map((entry) =>
        entry.kind === "question" ? entry.item.options : [],
      ),
    ).toEqual(
      queue.map((entry) =>
        entry.kind === "question" ? [...entry.item.options].reverse() : [],
      ),
    );
  });
});

describe("large libraries", () => {
  it("builds valid questions for thousands of senses without scanning the pool per word", () => {
    const pool = Array.from({ length: 3000 }, (_, index) =>
      word(`word${index}`, `意思${index}；解釋${index % 500}`),
    );
    const started = performance.now();
    const items = [
      ...buildMeaningQuestionGroups(pool),
      ...buildReverseQuestionGroups(pool),
    ].flat();
    expect(performance.now() - started).toBeLessThan(2000);
    expect(items).toHaveLength(6000);
    for (const item of items) {
      expect(new Set(item.options).size).toBe(4);
      expect(
        item.options.filter((_, index) => isCorrectChoice(item, index)),
      ).toHaveLength(1);
    }
  });
});

describe("a description with several points", () => {
  it("reads one point per line and drops typed bullets", () => {
    expect(
      descriptionPoints(" • 常用被動\n\n2. be rescued from \n① 名詞同形"),
    ).toEqual(["常用被動", "be rescued from", "名詞同形"]);
    expect(descriptionPoints("-ed 形容詞\n1.5 倍")).toEqual(["-ed 形容詞", "1.5 倍"]);
    expect(descriptionPoints(undefined)).toEqual([]);
  });

  it("reveals the points as bullets after answering", () => {
    const words = [
      { ...word("rescue", "救援"), pos: "v.", description: "常用被動\n名詞同形" },
      word("apple", "蘋果"),
      word("cloud", "雲"),
      word("book", "書"),
    ];
    const item = buildMeaningQuestionGroups(words)
      .flat()
      .find((question) => question.wordKey === "rescue")!;
    expect(item.explanation).toBe("• 常用被動\n• 名詞同形");
  });
});

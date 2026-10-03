import { describe, expect, it } from "vitest";
import type { SenseId, StudyWord, WordKey } from "@/types";
import {
  buildMeaningQuestionGroups,
  isCorrectChoice,
} from "@/components/practice/meaning-questions";
import {
  buildPracticeQueue,
  entriesFromIds,
} from "@/components/practice/practice-queue";

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

describe("local English-to-Chinese questions", () => {
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
      cards: {},
      difficulty: "3",
      leechOnly: false,
      questionGroups: groups,
      studyItems: words,
    });
    const keys = queue.map((entry) =>
      entry.item.wordKey,
    );
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

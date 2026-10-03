import { describe, expect, it } from "vitest";
import type { PassageFormat, ReadingPack, WordEntry, WordKey } from "@/types";
import { asSenseId, normalizeWordKey } from "@/src/lib/library";
import {
  readingFormFromPack,
  readingPackFromForm,
  migrateReadingFormDraft,
  updateReadingOptionBank,
} from "@/components/questions/reading-form";

const wordKey = normalizeWordKey("observe");
const senseId = asSenseId("observe:v.:1");
const word: WordEntry = {
  wordKey,
  word: "observe",
  updatedAt: "2026-10-03",
  senses: [
    {
      id: senseId,
      pos: "v.",
      meaningZh: "觀察",
      examples: [],
      supplementary: false,
    },
  ],
};
const words = { [wordKey]: word } as Record<WordKey, WordEntry>;

function pack(format: PassageFormat): ReadingPack {
  const optionBank = ["observe", "compare", "record", "collect"];
  return {
    id: "pack-1",
    fingerprint: "pack-1",
    kind: "reading",
    format,
    title: "A school experiment",
    passage: "The students __1__ the classroom before deciding what to change.",
    difficulty: 2,
    createdAt: "2026-10-01",
    updatedAt: "2026-10-02",
    wordKeys: [wordKey],
    ...(format === "cloze" ? {} : { optionBank }),
    explanation: "先觀察再推論。",
    questions: [
      {
        id: "child-1",
        kind: "multipleChoice",
        blank: 1,
        prompt: "Choose the answer for blank 1.",
        options: optionBank,
        answerIndex: 0,
        wordKey,
        senseId,
        explanation: "observe 表示有目的地觀察現象。",
        whyWrong: { compare: "尚未比較不同結果。" },
      },
    ],
  };
}

describe("passage question editing", () => {
  it.each(["cloze", "wordBank", "discourse"] as const)(
    "keeps %s format, blank identity and explanations after editing",
    (format) => {
      const original = pack(format);
      const draft = readingFormFromPack(original);
      draft.title = "An updated experiment";
      const saved = readingPackFromForm(draft, words, original);
      expect(saved.format).toBe(format);
      expect(saved.title).toBe("An updated experiment");
      expect(saved.optionBank).toEqual(original.optionBank);
      expect(saved.questions[0]).toEqual(original.questions[0]);
      expect(saved.explanation).toBe(original.explanation);
      expect(saved.createdAt).toBe(original.createdAt);
    },
  );

  it("rekeys shared-bank reasons independently and removes a newly correct option's reason on save", () => {
    const original = pack("wordBank");
    original.questions.push({
      ...original.questions[0],
      id: "child-2",
      blank: 2,
      whyWrong: { compare: "第二格沒有比較兩個事物。" },
    });
    const draft = updateReadingOptionBank(
      readingFormFromPack(original),
      1,
      " examine ",
    );
    expect(draft.children[0].whyWrong).toEqual({
      examine: "尚未比較不同結果。",
    });
    expect(draft.children[1].whyWrong).toEqual({
      examine: "第二格沒有比較兩個事物。",
    });
    const saved = readingPackFromForm(draft, words, original);
    expect(saved.optionBank![1]).toBe("examine");
    expect(saved.questions[0].options).toEqual(saved.optionBank);
    expect(saved.questions[0].whyWrong).toEqual({
      examine: "尚未比較不同結果。",
    });
    expect(readingFormFromPack(saved).children[1].whyWrong).toEqual({
      examine: "第二格沒有比較兩個事物。",
    });
    draft.children[0].answerIndex = 1;
    expect(
      readingPackFromForm(draft, words, original).questions[0].whyWrong,
    ).toBeUndefined();
  });

  it("migrates an old editor draft without losing its edited passage", () => {
    const initial = readingFormFromPack(pack("wordBank"));
    const {
      format: _format,
      optionBank: _bank,
      explanation: _explanation,
      ...legacy
    } = initial;
    legacy.passage = "The class __1__ a problem carefully.";
    const migrated = migrateReadingFormDraft(legacy, initial);
    expect(migrated.passage).toBe(legacy.passage);
    expect(migrated.format).toBe("wordBank");
    expect(migrated.optionBank).toEqual(initial.optionBank);
  });
});

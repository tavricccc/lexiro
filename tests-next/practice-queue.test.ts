import type {
  CardProgress,
  LibraryQuestion,
  SenseId,
  StudyWord,
  WordKey,
} from "@/types";
import { describe, expect, it } from "vitest";

import { buildQuestionGroups } from "@/components/practice/practice-content";
import {
  buildPracticeQueue,
  countQuestionAvailability,
  countTaskAvailability,
} from "@/components/practice/practice-queue";

function word(index: number): StudyWord {
  const id = `sense-${index}` as SenseId;
  return {
    id,
    wordKey: `word-${index}` as WordKey,
    word: `word${index}`,
    pos: "n.",
    meaning: `意思 ${index}`,
    supplementary: false,
    examples: [],
    example: "",
  };
}

/** Scheduled long ago, so `isDue` is true whenever the test runs. */
function dueCard(): CardProgress {
  return {
    due: "2020-01-01T00:00:00.000Z",
    stability: 1,
    difficulty: 5,
    elapsedDays: 1,
    scheduledDays: 1,
    learningSteps: 0,
    reps: 1,
    lapses: 0,
    state: 2,
    lastReview: "2020-01-01T00:00:00.000Z",
    reviewCount: 1,
    correctCount: 1,
  };
}

function vocabularyQuestion(index: number): LibraryQuestion {
  return {
    kind: "multipleChoice",
    id: `q-${index}`,
    fingerprint: `fp-${index}`,
    wordKey: `word-${index}` as WordKey,
    senseId: `sense-${index}` as SenseId,
    questionStyle: "vocabulary",
    difficulty: 2,
    prompt: `prompt ${index}`,
    options: ["a", "b", "c", "d"],
    answerIndex: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function readingQuestion(senseIndexes: number[]): LibraryQuestion {
  return {
    kind: "reading",
    id: "r-1",
    fingerprint: "fp-r-1",
    wordKeys: senseIndexes.map((index) => `word-${index}` as WordKey),
    title: "一篇文章",
    format: "reading",
    difficulty: 2,
    passage: "passage",
    questions: senseIndexes.map((index) => ({
      id: `c-${index}`,
      kind: "multipleChoice" as const,
      wordKey: `word-${index}` as WordKey,
      senseId: `sense-${index}` as SenseId,
      prompt: `child ${index}`,
      options: ["a", "b", "c", "d"],
      answerIndex: 1,
    })),
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const studyItems = [1, 2, 3, 4].map(word);
const cards = Object.fromEntries(
  studyItems.map((item) => [item.id, dueCard()]),
) as Record<SenseId, CardProgress>;
const allowedSenseIds = new Set(studyItems.map((item) => item.id));

const base = {
  allowedSenseIds,
  cards,
  difficulty: "all" as const,
  leechOnly: false,
  oneSensePerWord: false,
  questionGroups: [],
  studyItems,
};

describe("practice queue", () => {
  it("mixes local meaning choices with saved exam questions in the same queue", () => {
    const queue = buildPracticeQueue({
      ...base,
      amount: 4,
      oneSensePerWord: true,
      questionGroups: buildQuestionGroups(
        [vocabularyQuestion(1), vocabularyQuestion(2)],
        {},
      ),
      tasks: ["meaning", "vocabulary"],
    });
    expect(queue).toHaveLength(4);
    expect(new Set(queue.map((entry) => entry.task))).toEqual(
      new Set(["meaning", "vocabulary"]),
    );
    expect(
      new Set(
        queue.map((entry) =>
          entry.item.wordKey,
        ),
      ).size,
    ).toBe(4);
  });
  it("stops at the requested length", () => {
    const queue = buildPracticeQueue({
      ...base,
      amount: 2,
      tasks: ["meaning"],
    });
    expect(queue).toHaveLength(2);
  });

  it("keeps the items of one passage together", () => {
    const questionGroups = buildQuestionGroups(
      [readingQuestion([1, 2, 3]), vocabularyQuestion(4)],
      {},
    );
    const queue = buildPracticeQueue({
      ...base,
      amount: 10,
      questionGroups,
      tasks: ["vocabulary", "reading"],
    });
    const positions = queue.flatMap((entry, index) =>
      entry.kind === "question" && entry.task === "reading" ? [index] : [],
    );
    expect(positions).toHaveLength(3);
    expect(positions[2] - positions[0]).toBe(2);
  });

  it("keeps retired grammar records out of active practice without mutating the stored question", () => {
    const retired = { ...vocabularyQuestion(1), questionStyle: "grammar" as const };
    expect(buildQuestionGroups([retired], {})).toEqual([[]]);
    expect(retired.questionStyle).toBe("grammar");
  });

  it("honors an exact question count even when a passage has more items", () => {
    const questionGroups = buildQuestionGroups(
      [readingQuestion([1, 2, 3])],
      {},
    );
    const queue = buildPracticeQueue({
      ...base,
      amount: 1,
      questionGroups,
      tasks: ["reading"],
    });
    expect(queue).toHaveLength(1);
    expect(queue[0].kind).toBe("question");
  });

  it("can include every saved question even when several test one sense", () => {
    const questionGroups = buildQuestionGroups(
      [
        vocabularyQuestion(1),
        { ...vocabularyQuestion(1), id: "q-1-b", fingerprint: "fp-1-b" },
      ],
      {},
    );
    const queue = buildPracticeQueue({
      ...base,
      amount: 2,
      questionGroups,
      tasks: ["vocabulary"],
    });
    expect(queue.map((entry) => entry.id).sort()).toEqual([
      "question:q-1",
      "question:q-1-b",
    ]);
  });

  it("draws one question per word when the shorter session is on", () => {
    const secondSense = {
      ...vocabularyQuestion(1),
      id: "q-1-sense-b",
      fingerprint: "fp-1-sense-b",
      senseId: "sense-1-b" as SenseId,
    };
    const questionGroups = buildQuestionGroups(
      [vocabularyQuestion(1), secondSense, vocabularyQuestion(2)],
      {},
    );
    const input = {
      ...base,
      allowedSenseIds: new Set([...allowedSenseIds, secondSense.senseId]),
      questionGroups,
      tasks: ["vocabulary" as const],
      oneSensePerWord: true,
    };
    expect(countQuestionAvailability(input)).toBe(2);
    const queue = buildPracticeQueue({ ...input, amount: 3 });
    expect(queue).toHaveLength(2);
    expect(
      new Set(
        queue.map((entry) =>
          entry.kind === "question" ? entry.item.wordKey : "",
        ),
      ).size,
    ).toBe(2);
    expect(
      countQuestionAvailability({ ...input, oneSensePerWord: false }),
    ).toBe(3);
  });

  it("counts what each task could contribute on its own", () => {
    const counts = countTaskAvailability({
      ...base,
      questionGroups: buildQuestionGroups([vocabularyQuestion(1)], {}),
    });
    expect(counts.meaning).toBe(4);
    expect(counts).not.toHaveProperty("spelling");
    expect(counts).not.toHaveProperty("grammar");
    expect(counts.vocabulary).toBe(1);
    expect(counts.reading).toBe(0);
  });


});

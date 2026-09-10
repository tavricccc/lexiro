import type { WordEntry } from "@/types";
import { describe, expect, it } from "vitest";

import {
  blankOutWord,
  buildVocabularyFromLibrary,
  libraryDistractors,
  placeAnswer,
} from "@/src/lib/question-builders";
import { assembleGeneratedQuestions } from "@/src/lib/question-assembly";

function word(name: string, pos = "v.", examples: string[] = []): WordEntry {
  return {
    senses: [{ examples, id: `${name}:${pos}:1`, meaningZh: "測試", pos }],
    updatedAt: "2026-08-16T00:00:00.000Z",
    word: name,
    wordKey: name,
  };
}

const pool = [
  word("wander", "v.", ["We wander through the old town."]),
  word("linger"),
  word("drift"),
  word("roam"),
  word("subtle", "adj."),
];

describe("blanking out a word", () => {
  it("replaces a whole-word occurrence", () => {
    expect(blankOutWord("We wander home.", "wander")).toBe("We _____ home.");
  });

  it("ignores the word inside a longer word", () => {
    expect(blankOutWord("The wanderer left.", "wander")).toBeNull();
  });

  it("is case insensitive but keeps the rest of the sentence intact", () => {
    expect(blankOutWord("Wander with me.", "wander")).toBe("_____ with me.");
  });

  it("refuses an inflected form rather than guessing at morphology", () => {
    expect(blankOutWord("We wandered home.", "wander")).toBeNull();
  });
});

describe("placing the answer", () => {
  it("reports the index the answer actually landed on", () => {
    for (const seed of ["a", "b", "c", "d", "e", "f"]) {
      const { answerIndex, options } = placeAnswer("right", ["x", "y", "z"], seed);
      expect(options).toHaveLength(4);
      expect(options[answerIndex]).toBe("right");
    }
  });

  it("is stable for the same seed", () => {
    expect(placeAnswer("a", ["b", "c", "d"], "seed")).toEqual(
      placeAnswer("a", ["b", "c", "d"], "seed"),
    );
  });
});

describe("library distractors", () => {
  it("only offers words of the same part of speech", () => {
    const distractors = libraryDistractors(pool[0], "v.", pool, 3, "seed");
    expect(distractors).toHaveLength(3);
    expect(distractors).not.toContain("subtle");
    expect(distractors).not.toContain("wander");
  });

  it("returns fewer than asked rather than inventing words", () => {
    expect(libraryDistractors(pool[4], "adj.", pool, 3, "seed")).toHaveLength(0);
  });
});

describe("building a question with no model at all", () => {
  it("uses the learner's own example sentence", () => {
    const built = buildVocabularyFromLibrary(pool[0], pool[0].senses[0], pool, 2);
    expect(built).not.toBeNull();
    expect(built?.prompt).toBe("We _____ through the old town.");
    expect(built?.options[built.answerIndex]).toBe("wander");
    expect(built?.options).toHaveLength(4);
    expect(built?.questionStyle).toBe("vocabulary");
  });

  it("declines when the example does not contain the base form", () => {
    const awkward = word("adapt", "v.", ["They adapted quickly."]);
    expect(buildVocabularyFromLibrary(awkward, awkward.senses[0], pool, 2)).toBeNull();
  });
});

describe("assembling the model's reply", () => {
  const target = [word("wander", "v.")];

  it("cuts the blank itself instead of trusting the model to type one", () => {
    const payload = assembleGeneratedQuestions(
      { items: [{ answer: "wandered", distractors: ["ran", "sat", "grew"], ref: "s1", sentence: "They wandered for hours." }] },
      "vocabulary",
      2,
      target,
      pool,
    ).payload as { questions: Array<{ answerIndex: number; options: string[]; prompt: string }> };
    const question = payload.questions[0];
    expect(question.prompt).toBe("They _____ for hours.");
    expect(question.options[question.answerIndex]).toBe("wandered");
  });

  it("drops an item whose answer is not in its sentence, keeping the rest", () => {
    const two = [word("wander", "v."), word("linger", "v.")];
    const result = assembleGeneratedQuestions(
      {
        items: [
          { answer: "wander", distractors: ["ran", "sat", "grew"], ref: "s1", sentence: "They wander for hours." },
          { answer: "lingered", distractors: ["ran", "sat", "grew"], ref: "s2", sentence: "Nobody stayed behind." },
        ],
      },
      "vocabulary",
      2,
      two,
      pool,
    );
    expect((result.payload.questions as unknown[])).toHaveLength(1);
    expect(result.dropped).toHaveLength(1);
  });

  it("rejects an answer that belongs to a different word", () => {
    // Nothing survives, so the batch fails and can be retried rather than
    // silently saving a question about a word the learner never chose.
    expect(() =>
      assembleGeneratedQuestions(
        { items: [{ answer: "sprinted", distractors: ["ran", "sat", "grew"], ref: "s1", sentence: "They sprinted home." }] },
        "vocabulary",
        2,
        target,
        pool,
      ),
    ).toThrow(/wander/);
  });

  it("falls back to positional matching when the model mangles a ref", () => {
    const payload = assembleGeneratedQuestions(
      { items: [{ answer: "wander", distractors: ["ran", "sat", "grew"], ref: "source-1-1", sentence: "They wander far." }] },
      "vocabulary",
      2,
      target,
      pool,
    ).payload as { questions: Array<{ sourceRef: string }> };
    expect(payload.questions[0].sourceRef).toBe("source-1-1");
  });

  it("numbers cloze blanks in reading order regardless of the reply order", () => {
    const words = [word("linger", "v."), word("wander", "v.")];
    const payload = assembleGeneratedQuestions(
      {
        blanks: [
          { answer: "linger", distractors: ["ran", "sat", "grew"], ref: "s1" },
          { answer: "wander", distractors: ["ran", "sat", "grew"], ref: "s2" },
        ],
        passage: "First they wander outside, and later they linger by the door.",
        title: "A walk",
      },
      "cloze",
      2,
      words,
      pool,
    ).payload as { questions: Array<{ passage: string; questions: Array<{ blank: number }> }> };
    const pack = payload.questions[0];
    expect(pack.passage).toBe("First they __1__ outside, and later they __2__ by the door.");
    expect(pack.questions.map((child) => child.blank)).toEqual([1, 2]);
  });

  it("gives a word-bank passage one shared bank with every answer in it", () => {
    const words = [word("linger", "v."), word("wander", "v.")];
    const payload = assembleGeneratedQuestions(
      {
        blanks: [{ answer: "wander", ref: "s2" }, { answer: "linger", ref: "s1" }],
        extraOptions: ["drift", "roam"],
        passage: "They wander at dawn and linger at dusk.",
        title: "A day",
      },
      "wordBank",
      2,
      words,
      pool,
    ).payload as {
      questions: Array<{ optionBank: string[]; questions: Array<{ answerIndex: number; options: string[] }> }>;
    };
    const pack = payload.questions[0];
    expect(pack.optionBank).toHaveLength(4);
    expect(new Set(pack.optionBank).size).toBe(4);
    const chosen = pack.questions.map((child) => child.options[child.answerIndex]);
    expect(new Set(chosen).size).toBe(chosen.length);
    expect(chosen.sort()).toEqual(["linger", "wander"]);
  });

  it("removes whole sentences for 篇章結構 and offers one extra", () => {
    const payload = assembleGeneratedQuestions(
      {
        extraOption: "Nobody ever returned.",
        passage: "The town was quiet. They wandered in. A dog followed them. The sun set.",
        removals: ["They wandered in.", "A dog followed them."],
        title: "Quiet town",
      },
      "discourse",
      2,
      [word("wander", "v.")],
      pool,
    ).payload as {
      questions: Array<{ optionBank: string[]; passage: string; questions: unknown[] }>;
    };
    const pack = payload.questions[0];
    expect(pack.passage).toBe("The town was quiet. __1__ __2__ The sun set.");
    expect(pack.optionBank).toHaveLength(3);
    expect(pack.questions).toHaveLength(2);
  });

  it("refuses a passage where an answer appears twice", () => {
    expect(() =>
      assembleGeneratedQuestions(
        {
          blanks: [{ answer: "wander", distractors: ["a", "b", "c"], ref: "s1" }],
          passage: "They wander, and they wander again.",
          title: "Twice",
        },
        "cloze",
        2,
        [word("wander", "v.")],
        pool,
      ),
    ).toThrow();
  });
});

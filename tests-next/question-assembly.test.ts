import type { WordEntry } from "@/types";
import { describe, expect, it } from "vitest";

import {
  blankOutWord,
  buildVocabularyFromLibrary,
  libraryDistractors,
  placeAnswer,
} from "@/src/lib/question-builders";
import { asSenseId, normalizeWordKey } from "@/src/lib/library";
import { assembleGeneratedQuestions } from "@/src/lib/question-assembly";

function word(name: string, pos = "v.", examples: string[] = []): WordEntry {
  return {
    senses: [{ examples, id: asSenseId(`${name}:${pos}:1`), meaningZh: "測試", pos, supplementary: false }],
    updatedAt: "2026-08-16T00:00:00.000Z",
    word: name,
    wordKey: normalizeWordKey(name),
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
      { items: [{ answer: "wandered", usage: "wandered", distractors: ["ran", "sat", "grew"], ref: "s1", sentence: "They wandered for hours." }] },
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
          { answer: "wander", usage: "wander", distractors: ["ran", "sat", "grew"], ref: "s1", sentence: "They wander for hours." },
          { answer: "lingered", usage: "lingered", distractors: ["ran", "sat", "grew"], ref: "s2", sentence: "Nobody stayed behind." },
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
        { items: [{ answer: "sprinted", usage: "sprinted", distractors: ["ran", "sat", "grew"], ref: "s1", sentence: "They sprinted home." }] },
        "vocabulary",
        2,
        target,
        pool,
      ),
    ).toThrow(/wander/);
  });

  it("rejects a vocabulary answer outside the named target usage", () => {
    expect(() => assembleGeneratedQuestions(
      { items: [{ answer: "helps", usage: "formula", distractors: ["method", "recipe", "plan"], ref: "s1", sentence: "The formula helps us solve it." }] },
      "vocabulary",
      2,
      [word("formula", "n.")],
      [word("formula", "n.")],
    )).toThrow(/formula/);
  });

  it("treats sb and sth as phrase slots while keeping the fixed preposition", () => {
    const targets = [
      word("convince sb of sth", "phr."),
      word("convince sb to", "v."),
    ];
    const result = assembleGeneratedQuestions(
      {
        items: [
          {
            answer: "convinced",
            usage: "convinced him of its strength",
            distractors: ["informed", "warned", "reminded"],
            sentence: "Seeing the engineers repeat the test convinced him of its strength.",
          },
          {
            answer: "convinced",
            usage: "convinced the players to attend practice",
            distractors: ["invited", "ordered", "reminded"],
            sentence: "The coach convinced the players to attend practice.",
          },
        ],
      },
      "vocabulary",
      2,
      targets,
      targets,
    );
    const questions = result.payload.questions as Array<{
      answerIndex: number;
      options: string[];
      prompt: string;
    }>;
    expect(result.dropped).toEqual([]);
    expect(questions.map((question) => question.prompt)).toEqual([
      "Seeing the engineers repeat the test _____ him of its strength.",
      "The coach _____ the players to attend practice.",
    ]);
    expect(questions.map((question) => question.options[question.answerIndex])).toEqual([
      "convinced",
      "convinced",
    ]);
  });

  it("does not accept the phrase head without its required words", () => {
    expect(() => assembleGeneratedQuestions(
      { items: [{
        answer: "convinced",
        usage: "convinced him that the bridge was safe",
        distractors: ["informed", "warned", "reminded"],
        sentence: "The report convinced him that the bridge was safe.",
      }] },
      "vocabulary",
      2,
      [word("convince sb of sth", "phr.")],
      pool,
    )).toThrow(/convince sb of sth/);
  });

  it("lets the model fill a phrase slot with a long clause and punctuation", () => {
    const usage = "convinced the committee members, who had carefully reviewed every previous report and interviewed several engineers over many weeks, of its safety";
    const result = assembleGeneratedQuestions(
      { items: [{
        answer: "convinced",
        usage,
        distractors: ["informed", "warned", "reminded"],
        sentence: `The repeated trials ${usage}.`,
      }] },
      "vocabulary",
      2,
      [word("convince sb of sth", "phr.")],
      pool,
    );
    const [question] = result.payload.questions as Array<{ prompt: string }>;
    expect(question.prompt).toBe(`The repeated trials _____${usage.slice("convinced".length)}.`);
    expect(result.dropped).toEqual([]);
  });

  it("allows natural modifiers between a phrase's ordered fixed words", () => {
    const usage = "gave the tired student a much-needed hand";
    const result = assembleGeneratedQuestions(
      { items: [{
        answer: "gave",
        usage,
        distractors: ["sent", "offered", "brought"],
        sentence: `Her teacher ${usage} with the project.`,
      }] },
      "vocabulary",
      2,
      [word("give sb a hand", "phr.")],
      pool,
    );
    expect((result.payload.questions as unknown[])).toHaveLength(1);
    expect(result.dropped).toEqual([]);
  });

  it("accepts a separable phrasal verb filled by the model", () => {
    const result = assembleGeneratedQuestions(
      { items: [{
        answer: "turned",
        usage: "turned the offer down",
        distractors: ["sent", "wrote", "kept"],
        sentence: "She turned the offer down after reading the details.",
      }] },
      "vocabulary",
      2,
      [word("turn down", "phr. v.")],
      pool,
    );
    const [question] = result.payload.questions as Array<{ prompt: string }>;
    expect(question.prompt).toBe("She _____ the offer down after reading the details.");
  });

  it("rejects a model-named usage that is absent from the sentence", () => {
    expect(() => assembleGeneratedQuestions(
      { items: [{
        answer: "convinced",
        usage: "convinced the committee of its safety",
        distractors: ["informed", "warned", "reminded"],
        sentence: "The report convinced the committee of the result.",
      }] },
      "vocabulary",
      2,
      [word("convince sb of sth", "phr.")],
      pool,
    )).toThrow(/目標用法/);
  });

  it("falls back to positional matching when the model mangles a ref", () => {
    const payload = assembleGeneratedQuestions(
      { items: [{ answer: "wander", usage: "wander", distractors: ["ran", "sat", "grew"], ref: "source-1-1", sentence: "They wander far." }] },
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

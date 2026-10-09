import type { WordEntry } from "@/types";
import { describe, expect, it } from "vitest";

import { placeAnswer } from "@/src/lib/question-builders";
import { asSenseId, normalizeWordKey } from "@/src/lib/library";
import { assembleGeneratedQuestions } from "@/src/lib/question-assembly";
import { getSetGenerationWords } from "@/src/lib/question-generation";

function word(name: string, pos = "v.", examples: string[] = []): WordEntry {
  return {
    senses: [{ examples, id: asSenseId(`${name}:${pos}:1`), meaningZh: "測試", pos, supplementary: false }],
    updatedAt: "2026-08-16T00:00:00.000Z",
    word: name,
    wordKey: normalizeWordKey(name),
  };
}

describe("whole-set generation scope", () => {
  it("includes every sense in the set and excludes other sets", () => {
    const first = word("wander");
    const secondSense = { ...first.senses[0], id: asSenseId("wander:v.:2"), meaningZh: "漫遊" };
    const multiSense = { ...first, senses: [...first.senses, secondSense] };
    const outsider = word("linger");
    const selected = getSetGenerationWords(
      [multiSense, outsider],
      [{ wordKey: multiSense.wordKey, senseIds: multiSense.senses.map((sense) => sense.id) }],
    );
    expect(selected).toEqual([multiSense]);
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

describe("assembling the model's reply", () => {
  const target = [word("wander", "v.")];

  it("cuts the blank itself instead of trusting the model to type one", () => {
    const payload = assembleGeneratedQuestions(
      { items: [{ answer: "wandered", usage: "wandered", distractors: ["ran", "sat", "grew"], ref: "s1", sentence: "They wandered for hours." }] },
      "vocabulary",
      2,
      target,
    ).payload as { questions: Array<{ answerIndex: number; options: string[]; prompt: string }> };
    const question = payload.questions[0];
    expect(question.prompt).toBe("They _____ for hours.");
    expect(question.options[question.answerIndex]).toBe("wandered");
  });

  it("accepts the complete inflected form of a fixed multiword phrase", () => {
    const phrase = "was found in possession of";
    const sentence = "During the school trip, a student was found in possession of a key that had gone missing from the science lab.";
    const result = assembleGeneratedQuestions(
      { items: [{
        answer: phrase,
        distractors: ["was accused of", "was charged with", "was suspected of"],
        sentence,
        usage: `${phrase} a key that had gone missing from the science lab`,
      }] },
      "vocabulary",
      2,
      [word("be found in possession of", "phr. v.")],
    );
    const [question] = result.payload.questions as Array<{ answerIndex: number; options: string[]; prompt: string }>;
    expect(result.dropped).toEqual([]);
    expect(question.options[question.answerIndex]).toBe(phrase);
    expect(question.prompt).toBe("During the school trip, a student _____ a key that had gone missing from the science lab.");
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
    );
    expect((result.payload.questions as unknown[])).toHaveLength(1);
    expect(result.dropped).toHaveLength(1);
  });

  it("keeps a structurally valid answer for the review step", () => {
    const result = assembleGeneratedQuestions(
      { items: [{ answer: "sprinted", usage: "sprinted", distractors: ["ran", "sat", "grew"], ref: "s1", sentence: "They sprinted home." }] },
      "vocabulary",
      2,
      target,
    );
    const [question] = result.payload.questions as Array<{ options: string[]; answerIndex: number; sourceRef: string }>;
    expect(result.dropped).toEqual([]);
    expect(question.options[question.answerIndex]).toBe("sprinted");
    expect(question.sourceRef).toBe("source-1-1");
  });

  it("rejects a vocabulary answer outside the named target usage", () => {
    expect(() => assembleGeneratedQuestions(
      { items: [{ answer: "helps", usage: "formula", distractors: ["method", "recipe", "plan"], ref: "s1", sentence: "The formula helps us solve it." }] },
      "vocabulary",
      2,
      [word("formula", "n.")],
    )).toThrow(/formula/);
  });

  it("rejects an answer that extends beyond its named usage", () => {
    expect(() => assembleGeneratedQuestions(
      { items: [{ answer: "formula helps", usage: "formula", distractors: ["method helps", "recipe helps", "plan helps"], ref: "s1", sentence: "The formula helps us solve it." }] },
      "vocabulary",
      2,
      [word("formula", "n.")],
    )).toThrow(/答案必須位於目標用法開頭且不超出範圍/);
  });

  it("blanks the model's verb in two placeholder phrase usages", () => {
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

  it("keeps unusual phrase wording for review", () => {
    const result = assembleGeneratedQuestions(
      { items: [{
        answer: "convinced",
        usage: "convinced him that the bridge was safe",
        distractors: ["informed", "warned", "reminded"],
        sentence: "The report convinced him that the bridge was safe.",
      }] },
      "vocabulary",
      2,
      [word("convince sb of sth", "phr.")],
    );
    expect((result.payload.questions as unknown[])).toHaveLength(1);
  });

  it("blanks a verb beside a long clause and punctuation", () => {
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
    );
    const [question] = result.payload.questions as Array<{ prompt: string }>;
    expect(question.prompt).toBe(`The repeated trials _____${usage.slice("convinced".length)}.`);
    expect(result.dropped).toEqual([]);
  });

  it("blanks a verb beside natural modifiers in a phrase", () => {
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
    )).toThrow(/目標用法/);
  });

  it("falls back to positional matching when the model mangles a ref", () => {
    const payload = assembleGeneratedQuestions(
      { items: [{ answer: "wander", usage: "wander", distractors: ["ran", "sat", "grew"], ref: "source-1-1", sentence: "They wander far." }] },
      "vocabulary",
      2,
      target,
    ).payload as { questions: Array<{ sourceRef: string }> };
    expect(payload.questions[0].sourceRef).toBe("source-1-1");
  });

  it("numbers cloze blanks in reading order regardless of the reply order", () => {
    const words = [word("linger", "v."), word("wander", "v.")];
    const payload = assembleGeneratedQuestions(
      {
        blanks: [
          { answer: "linger", distractors: ["ran", "sat", "grew"], ref: "s1", explanation: "停留在門邊。", whyWrong: [{ option: "sat", reason: "未坐下。" }, { option: "grew", reason: "未生長。" }, { option: "ran", reason: "未跑動。" }] },
          { answer: "wander", distractors: ["ran", "sat", "grew"], ref: "s2", explanation: "先在外面漫步。", whyWrong: [{ option: "ran", reason: "未跑動。" }, { option: "sat", reason: "未坐下。" }, { option: "grew", reason: "未生長。" }] },
        ],
        passage: "First they wander outside, and later they linger by the door.",
        title: "A walk",
      },
      "cloze",
      2,
      words,
    ).payload as { questions: Array<{ passage: string; questions: Array<{ blank: number; explanation: string; whyWrong: Record<string,string> }> }> };
    const pack = payload.questions[0];
    expect(pack.passage).toBe("First they __1__ outside, and later they __2__ by the door.");
    expect(pack.questions.map((child) => child.blank)).toEqual([1, 2]);
    expect(pack.questions.map((child) => child.explanation)).toEqual(["先在外面漫步。", "停留在門邊。"]);
    expect(pack.questions[0].whyWrong.ran).toBe("未跑動。");
  });

  it("gives a word-bank passage one shared bank with every answer in it", () => {
    const words = [word("linger", "v."), word("wander", "v.")];
    const payload = assembleGeneratedQuestions(
      {
        blanks: [{ answer: "wander", ref: "s2" }, { answer: "linger", ref: "s1" }],
        options: ["linger", "wander", "drift", "roam", "stay", "run", "jump", "skip", "sit", "walk"],
        passage: "They wander at dawn and linger at dusk.",
        title: "A day",
      },
      "wordBank",
      2,
      words,
    ).payload as {
      questions: Array<{ optionBank: string[]; questions: Array<{ answerIndex: number; options: string[] }> }>;
    };
    const pack = payload.questions[0];
    expect(pack.optionBank).toHaveLength(10);
    expect(new Set(pack.optionBank).size).toBe(10);
    const chosen = pack.questions.map((child) => child.options[child.answerIndex]);
    expect(new Set(chosen).size).toBe(chosen.length);
    expect(chosen.sort()).toEqual(["linger", "wander"]);
  });

  it("removes whole sentences for 篇章結構 and offers one extra", () => {
    const payload = assembleGeneratedQuestions(
      {
        options: ["The wind grew stronger.", "Nobody ever returned.", "They wandered in.", "A dog followed them.", "It was still early."],
        passage: "The town was quiet. They wandered in. A dog followed them. The sun set.",
        removals: [{sentence: "They wandered in."}, {sentence: "A dog followed them."}],
        title: "Quiet town",
      },
      "discourse",
      2,
      [word("wander", "v.")],
    ).payload as {
      questions: Array<{ optionBank: string[]; passage: string; questions: unknown[] }>;
    };
    const pack = payload.questions[0];
    expect(pack.passage).toBe("The town was quiet. __1__ __2__ The sun set.");
    expect(pack.optionBank).toHaveLength(5);
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
      ),
    ).toThrow();
  });

  it("does not cut nested answer spans into overlapping blanks", () => {
    const result = assembleGeneratedQuestions({
      title: "Tools", passage: "They repaired the chemical machinery at noon.",
      blanks: [
        { answer: "chemical machinery", distractors: ["the classroom", "the garden", "the kitchen"] },
        { answer: "machinery", distractors: ["machine", "equipment", "device"] },
      ],
    }, "cloze", 2, [word("chemical machinery", "n."), word("machinery", "n.")]);
    expect(result.dropped).toContain("「machinery」與其他空格重疊");
    expect(result.payload.questions).toMatchObject([{ passage: "They repaired the __1__ at noon." }]);
  });
});

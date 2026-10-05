import { describe, expect, it } from "vitest";
import type { LibraryQuestion, WordEntry, WordDraft } from "@/types";
import { asSenseId, normalizeWordKey } from "@/src/lib/library";
import { wordTask, questionTask } from "@/src/lib/ai/tasks";
import { buildWordGenerationSources } from "@/src/lib/word-generation";
import { runTask, type AiRun } from "@/src/lib/ai/runner";
import { createAiSession } from "@/src/lib/ai/session";

const word = (value: string): WordEntry => ({
  word: value,
  wordKey: normalizeWordKey(value),
  senses: [
    {
      id: asSenseId(value + "-sense"),
      pos: "v.",
      meaningZh: "測試",
      examples: [],
      supplementary: false,
    },
  ],
  updatedAt: "2026-09-12",
});
const generated = () => ({
  senses: [
    {
      pos: "n.",
      meaningZh: "測試字義",
      example: "This is a test.",
    },
  ],
});
describe("AI task boundaries", () => {
  it("places all sources in the first context and targets only the next stable references", () => {
    const sources = buildWordGenerationSources(
      Array.from({ length: 31 }, (_, index) => `word-${index + 1}`).join(", "),
    );
    const task = wordTask(sources);
    expect(task.steps.map((step) => step.count)).toEqual([30, 1]);
    expect(task.context).toContain("word-31");
    expect(JSON.parse(task.steps[1].prompt)).toEqual({
      kind: "words",
      raw: "word-31",
    });
  });
  it("keeps valid words from a partly invalid segment and requests only missing sources", async () => {
    const sources = buildWordGenerationSources("apple, banana");
    const task = wordTask(sources);
    const run: AiRun<WordDraft> = {
      task,
      session: createAiSession("lite", task.context),
      pending: [...task.steps],
      items: [],
      completed: 0,
      total: 2,
      segments: 0,
    };
    const prompts: string[] = [];
    await runTask(run, {
      signal: new AbortController().signal,
      onUpdate: () => {},
      send: async (_session, prompt) => {
        prompts.push(prompt);
        return {
          id: String(prompts.length),
          text: JSON.stringify({
            items: [generated()],
          }),
          complete: true,
          stopReason: "complete",
        };
      },
    });
    expect(prompts).toHaveLength(2);
    expect(JSON.parse(prompts[1])).toEqual({ kind: "words", raw: "banana" });
    expect(run.items.map((i) => i.word)).toEqual(["apple", "banana"]);
    expect(run.completed).toBe(2);
  });
  it("maps later-segment questions by position instead of model-echoed refs", () => {
    const words = [
      "adapt",
      "apply",
      "avoid",
      "begin",
      "bring",
      "build",
      "carry",
      "choose",
      "create", "cross", "decide", "deliver", "discover", "explain", "finish", "follow",
      "close",
    ].map(word);
    const task = questionTask(words, "vocabulary", 2);
    expect(task.steps[1].prompt).toContain("s17");
    const parsed = task.steps[1].parse(
      JSON.stringify({
        items: [
          {
            ref: "s17",
            sentence: "Please close the classroom door before we leave for lunch, because the students next door are taking a listening test and need a quiet environment.",
            answer: "close",
            usage: "close",
            explanation: "這是結構測試用的審題解說。",
            whyWrong: ["不符線索一。", "不符線索二。", "不符線索三。"],
            distractors: ["watch", "bring", "carry"],
          },
        ],
      }),
    );
    expect(parsed[0]).toMatchObject({
      wordKey: "close",
      senseId: "close-sense",
    });
    const withWrongEcho = task.steps[1].parse(
      JSON.stringify({
        items: [
          {
            ref: "s1",
            sentence: "Please close the classroom door before we leave for lunch, because the students next door are taking a listening test and need a quiet environment.",
            answer: "close",
            usage: "close",
            explanation: "這是結構測試用的審題解說。",
            whyWrong: ["不符線索一。", "不符線索二。", "不符線索三。"],
            distractors: ["watch", "bring", "carry"],
          },
        ],
      }),
    );
    expect(withWrongEcho[0]).toMatchObject({
      wordKey: "close",
      senseId: "close-sense",
    });
  });
  it("accepts a full phrase answer alongside two inflected senses of commit", () => {
    const phrase = word("be found in possession of");
    phrase.senses[0].pos = "phr. v.";
    phrase.senses[0].meaningZh = "被發現擁有……";
    phrase.senses[0].examples = [
      "He was found in possession of a stolen phone.",
    ];
    const commit = word("commit");
    commit.senses = [
      {
        ...commit.senses[0],
        id: asSenseId("commit-crime"),
        meaningZh: "犯（罪）",
      },
      {
        ...commit.senses[0],
        id: asSenseId("commit-dedicate"),
        meaningZh: "奉獻",
      },
    ];
    const [step] = questionTask(
      [phrase, commit],
      "vocabulary",
      2,
    ).steps;
    const questions = step.parse(
      JSON.stringify({
        items: [
          {
            answer: "was found in possession of",
            explanation: "這是結構測試用的審題解說。",
            whyWrong: ["不符線索一。", "不符線索二。", "不符線索三。"],
            distractors: [
              "was accused of",
              "was charged with",
              "was suspected of",
            ],
            sentence:
              "During the school trip, a student was found in possession of a key that had gone missing from the locked science lab earlier that morning.",
            usage:
              "was found in possession of a key that had gone missing from the locked science lab earlier that morning",
          },
          {
            answer: "committed",
            explanation: "這是結構測試用的審題解說。",
            whyWrong: ["不符線索一。", "不符線索二。", "不符線索三。"],
            distractors: ["witnessed", "prevented", "reported"],
            sentence:
              "The shop’s security video clearly showed that the thief committed the crime by breaking a window and taking several laptops while the owner was away.",
            usage: "committed",
          },
          {
            answer: "committed",
            explanation: "這是結構測試用的審題解說。",
            whyWrong: ["不符線索一。", "不符線索二。", "不符線索三。"],
            distractors: ["limited", "postponed", "considered"],
            sentence:
              "After volunteering at the animal shelter for a month, Leo committed himself to caring for abandoned pets every weekend instead of spending his free time playing games.",
            usage: "committed",
          },
        ],
      }),
    );
    expect(questions).toHaveLength(3);
    expect(questions.map((question) => question.kind === "reading" ? null : question.senseId)).toEqual([
      phrase.senses[0].id,
      commit.senses[0].id,
      commit.senses[1].id,
    ]);
  });
  it("keeps a valid question when another question in the same reply fails", async () => {
    const words = [word("adapt"), word("formula")];
    const task = questionTask(words, "vocabulary", 2);
    const run: AiRun<LibraryQuestion> = {
      task,
      session: createAiSession("lite", task.context),
      pending: [...task.steps],
      items: [],
      completed: 0,
      total: 2,
      segments: 0,
    };
    const valid = {
      sentence: "Students who move to a new school often adapt more quickly when classmates invite them to join activities and explain the routines of their new classroom.",
      answer: "adapt",
      usage: "adapt",
      explanation: "這是結構測試用的審題解說。",
      whyWrong: ["不符線索一。", "不符線索二。", "不符線索三。"],
      distractors: ["sleep", "wait", "leave"],
    };
    const invalid = {
      sentence: "The method helps students solve difficult mathematical problems by separating each problem into smaller steps, allowing them to check their calculations before writing a final answer.",
      answer: "method",
      usage: "formula",
      explanation: "這是結構測試用的審題解說。",
      whyWrong: ["不符線索一。", "不符線索二。", "不符線索三。"],
      distractors: ["plan", "rule", "formula"],
    };
    const replies = [
      { items: [valid, invalid] },
      { items: [invalid] },
      { items: [invalid] },
    ];
    let sent = 0;
    await expect(
      runTask(run, {
        signal: new AbortController().signal,
        onUpdate: () => {},
        send: async () => ({
          id: String(sent),
          text: JSON.stringify(replies[sent++]),
          complete: true,
          stopReason: "complete",
        }),
      }),
    ).rejects.toThrow("formula");
    expect(run.items).toHaveLength(1);
    expect(run.items[0]).toMatchObject({ wordKey: "adapt" });
    expect(run.completed).toBe(1);
    expect(run.pending).toHaveLength(1);
  });
  it("keeps a passage indivisible and adjusts a short final word-bank's extra options", () => {
    const words = [
      "adapt",
      "apply",
      "avoid",
      "begin",
      "bring",
      "build",
      "carry",
      "choose",
      "close",
      "create",
      "cross",
    ].map(word);
    const task = questionTask(words, "wordBank", 2);
    expect(task.steps).toHaveLength(2);
    expect(JSON.parse(task.steps[0].prompt).sources).toHaveLength(10);
    expect(JSON.parse(task.steps[1].prompt).sources).toHaveLength(1);
    expect(task.steps.every((s) => !s.split && s.count === 1)).toBe(true);
  });
});

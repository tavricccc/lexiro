import { describe, expect, it } from "vitest";
import type { WordEntry, WordDraft } from "@/types";
import { asSenseId, normalizeWordKey } from "@/src/lib/library";
import { wordTask, questionTask } from "@/src/lib/ai/tasks";
import { buildWordGenerationSources } from "@/src/lib/word-generation";
import { runTask, type AiRun } from "@/src/lib/ai/runner";
import { defaultAiSettings } from "@/src/lib/ai/catalog";
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
    },
  ],
  updatedAt: "2026-09-12",
});
const generated = () => ({ pos: "n.", meaningZh: "測試字義" });
describe("AI task boundaries", () => {
  it("places all sources in the first context and targets only the next stable references", () => {
    const sources = buildWordGenerationSources("apple, banana, cherry");
    const task = wordTask("", sources, false, 2);
    expect(task.context).toContain("cherry");
    expect(task.steps[1].prompt).toContain("source-3");
    expect(task.steps[1].prompt).not.toContain("source-1");
  });
  it("keeps valid words from a partly invalid segment and requests only missing sources", async () => {
    const sources = buildWordGenerationSources("apple, banana");
    const task = wordTask("", sources, false, 2);
    const run: AiRun<WordDraft> = {
      task,
      session: createAiSession(defaultAiSettings, task.context),
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
          usage: {},
        };
      },
    });
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain("source-2");
    expect(prompts[1]).not.toContain("source-1");
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
      "close",
    ].map(word);
    const task = questionTask(words, words, "vocabulary", 2);
    expect(task.steps[1].prompt).toContain("s9");
    const parsed = task.steps[1].parse(
      JSON.stringify({
        items: [
          {
            ref: "s9",
            sentence: "Please close the door before we leave.",
            answer: "close",
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
            sentence: "Please close the door.",
            answer: "close",
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
    const task = questionTask(words, words, "wordBank", 2);
    expect(task.steps).toHaveLength(2);
    expect(task.steps[1].prompt).toContain("extraOptions 恰好 7 個");
    expect(task.steps.every((s) => !s.split && s.count === 1)).toBe(true);
  });
});

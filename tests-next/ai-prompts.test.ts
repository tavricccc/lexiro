import type { WordEntry } from "@/types";
import { describe, expect, it } from "vitest";

import { buildImportPrompt } from "@/src/lib/importPrompt";
import { buildQuestionGenerationPrompt, normalizeQuestionGenerationJson, QUESTION_BATCH_SIZE } from "@/src/lib/question-generation";
import { buildWordGenerationSources, parseWordGenerationJson } from "@/src/lib/word-generation";

const word: WordEntry = {
  wordKey: "adapt",
  word: "adapt",
  senses: [{ id: "adapt:v:1", pos: "v.", meaningZh: "適應", examples: ["We adapt quickly."] }],
  updatedAt: "2026-08-16T00:00:00.000Z",
};

describe("AI prompts", () => {
  it("keeps word generation small and JSON-only", () => {
    const prompt = buildImportPrompt("adapt 適應", undefined, true);
    expect(prompt).toContain("每筆只回傳 1 個");
    expect(prompt).toContain("不要 Markdown");
    expect(prompt).not.toContain("```json");
  });

  it("accepts fenced JSON from less compliant models", () => {
    const sources = buildWordGenerationSources("adapt");
    const response = '```json\n{"words":[{"sourceRef":"source-1","senses":[{"pos":"v.","meaningZh":"適應","examples":[]}]}]}\n```';
    expect(parseWordGenerationJson(response, sources, false)[0]?.word).toBe("adapt");
  });

  it("limits question batches and keeps the response schema compact", () => {
    expect(QUESTION_BATCH_SIZE).toBe(8);
    const prompt = buildQuestionGenerationPrompt([word], "multipleChoice", 2);
    expect(prompt).toContain("每個 sense 恰好 1 題");
    expect(prompt).toContain("只輸出 JSON object");
    expect(prompt).not.toContain("```json");
  });

  it("normalizes fenced question JSON", () => {
    const response = '```json\n{"questions":[{"sourceRef":"source-1-1","prompt":"Which word means to adjust to change?","options":["adapt","avoid","delay","remove"],"answerIndex":0}]}\n```';
    const normalized = JSON.parse(normalizeQuestionGenerationJson(response, "multipleChoice", 2, [word])) as { questions: unknown[] };
    expect(normalized.questions).toHaveLength(1);
  });
});

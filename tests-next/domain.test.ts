import { describe, expect, it } from "vitest";

import { buildSenseId, canonicalizeQuestion, normalizePartOfSpeech, normalizeWordKey } from "@/src/lib/library";
import { createInitialProgress, isDue, reviewCard } from "@/src/lib/fsrs";

describe("canonical vocabulary", () => {
  it("normalizes word and part of speech identity", () => {
    expect(normalizeWordKey("  Take   Off ")).toBe("take off");
    expect(normalizePartOfSpeech("Verb")).toBe("v.");
    expect(buildSenseId("Word", "noun", "文字")).toBe(buildSenseId("word", "n.", "文字"));
  });

  it("creates stable question fingerprints from content", () => {
    const base = {
      id: "one",
      fingerprint: "old",
      kind: "multipleChoice" as const,
      questionStyle: "standard" as const,
      difficulty: 1 as const,
      wordKey: "word",
      senseId: "sense",
      prompt: "Which option is correct?",
      options: ["word", "bird", "tree", "road"],
      answerIndex: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    expect(canonicalizeQuestion(base).fingerprint).toBe(canonicalizeQuestion({ ...base, id: "two" }).fingerprint);
  });
});

describe("FSRS review", () => {
  it("schedules Again and Good ratings", () => {
    const now = new Date("2026-08-12T00:00:00.000Z");
    const initial = createInitialProgress(now);
    expect(isDue(initial, now)).toBe(true);
    expect(reviewCard(initial, "again", now).reviewCount).toBe(1);
    expect(reviewCard(initial, "good", now).correctCount).toBe(1);
  });
});

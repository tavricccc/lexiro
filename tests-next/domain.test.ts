import { describe, expect, it } from "vitest";

import { asSenseId, buildSenseId, canonicalizeQuestion, normalizePartOfSpeech, normalizeWordKey } from "@/src/lib/library";
import { createInitialProgress, isLeech, isMastered, reviewCard } from "@/src/lib/card-progress";
import { hasLegacyCardFields, normalizeLearningProgress } from "@/src/lib/share";

describe("canonical vocabulary", () => {
  it("normalizes word and part of speech identity", () => {
    expect(normalizeWordKey("  Take   Off ")).toBe("take off");
    expect(normalizePartOfSpeech("Verb")).toBe("v.");
    expect(buildSenseId(normalizeWordKey("Word"), "noun", "文字")).toBe(buildSenseId(normalizeWordKey("word"), "n.", "文字"));
  });

  it("creates stable question fingerprints from content", () => {
    const base = {
      id: "one",
      fingerprint: "old",
      kind: "multipleChoice" as const,
      questionStyle: "vocabulary" as const,
      difficulty: 1 as const,
      wordKey: normalizeWordKey("word"),
      senseId: asSenseId("sense"),
      prompt: "The plan seemed _____ at first.",
      options: ["word", "bird", "tree", "road"],
      answerIndex: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    expect(canonicalizeQuestion(base).fingerprint).toBe(canonicalizeQuestion({ ...base, id: "two" }).fingerprint);
  });
});

describe("card progress", () => {
  it("counts answers, tracks the streak and flags leeches", () => {
    const now = new Date("2026-08-12T00:00:00.000Z");
    const initial = createInitialProgress();
    const wrong = reviewCard(initial, "again", now);
    expect(wrong).toEqual({ reviewCount: 1, correctCount: 0, wrongCount: 1, streak: 0, lastReview: now.toISOString() });
    let card = reviewCard(wrong, "good", now);
    card = reviewCard(card, "good", now);
    expect(isMastered(card)).toBe(false);
    card = reviewCard(card, "good", now);
    expect(isMastered(card)).toBe(true);
    expect(isMastered(reviewCard(card, "again", now))).toBe(false);
    let leech = initial;
    for (let i = 0; i < 4; i += 1) leech = reviewCard(leech, "again", now);
    expect(isLeech(leech)).toBe(true);
  });
});

describe("legacy card cleanup", () => {
  it("drops spaced-repetition fields and keeps answer counts", () => {
    const legacy = {
      cards: {
        a: { due: "2026-01-01T00:00:00.000Z", stability: 3, difficulty: 5, elapsedDays: 1, scheduledDays: 2, learningSteps: 0, reps: 5, lapses: 1, state: 2, reviewCount: 5, correctCount: 3, lastReview: "2026-01-01T00:00:00.000Z" },
      },
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    expect(hasLegacyCardFields(legacy)).toBe(true);
    const cleaned = normalizeLearningProgress(legacy);
    expect(cleaned.cards[asSenseId("a")]).toEqual({ reviewCount: 5, correctCount: 3, wrongCount: 2, streak: 0, lastReview: "2026-01-01T00:00:00.000Z" });
    expect(hasLegacyCardFields(cleaned)).toBe(false);
  });
});

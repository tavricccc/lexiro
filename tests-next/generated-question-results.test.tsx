import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { GeneratedQuestionResults } from "@/components/questions/generated-question-results";
import { asSenseId, normalizeWordKey } from "@/src/lib/library";
import type { LibraryQuestion, WordEntry } from "@/types";

afterEach(cleanup);

describe("generated question review", () => {
  it("shows the assigned source meaning beside the model's answer", () => {
    const source: WordEntry = {
      word: "wander",
      wordKey: normalizeWordKey("wander"),
      updatedAt: "2026-09-26",
      senses: [{
        id: asSenseId("wander-roam"),
        pos: "v.",
        meaningZh: "漫遊",
        examples: [],
        supplementary: false,
      }],
    };
    const question: LibraryQuestion = {
      id: "generated-1",
      fingerprint: "generated-1",
      kind: "multipleChoice",
      questionStyle: "vocabulary",
      difficulty: 2,
      createdAt: "2026-09-26",
      updatedAt: "2026-09-26",
      wordKey: source.wordKey,
      senseId: source.senses[0].id,
      prompt: "They _____ home.",
      options: ["sprinted", "ran", "sat", "grew"],
      answerIndex: 0,
    };

    render(<GeneratedQuestionResults items={[question]} words={[source]} />);
    expect(screen.getByText("目標：wander · 漫遊")).toBeInTheDocument();
    expect(screen.getByText("sprinted")).toBeInTheDocument();
  });
});

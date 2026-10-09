import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GeneratedQuestionResults } from "@/components/questions/generated-question-results";
import { QuestionPreview } from "@/components/questions/question-preview";
import { asSenseId, normalizeWordKey } from "@/src/lib/library";
import type { LibraryQuestion, WordEntry } from "@/types";

afterEach(cleanup);

describe("generated question review", () => {
  it("shows the assigned source meaning beside the model's answer", () => {
    const source: WordEntry = {
      word: "wander",
      wordKey: normalizeWordKey("wander"),
      updatedAt: "2026-09-26",
      senses: [
        {
          id: asSenseId("wander-roam"),
          pos: "v.",
          meaningZh: "漫遊",
          examples: [],
          supplementary: false,
        },
      ],
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
    expect(screen.getByText("題幹 3 個英文詞")).toBeInTheDocument();
  });

  it("shows passage length and each shared-bank blank's answer for proofreading", () => {
    const optionBank = [
      "The tools were ready.",
      "They thanked the helpers.",
      "The doors were unlocked.",
      "Nobody came to the workshop.",
      "Everyone learned a new skill.",
    ];
    const question: LibraryQuestion = {
      id: "discourse-1",
      fingerprint: "discourse-1",
      kind: "reading",
      format: "discourse",
      title: "A community workshop",
      passage:
        "The volunteers arrived early. __1__ They prepared the tools. __2__ Everyone began working. __3__ The workshop closed. __4__",
      optionBank,
      difficulty: 2,
      createdAt: "2026-10-02",
      updatedAt: "2026-10-02",
      wordKeys: [normalizeWordKey("workshop")],
      questions: [2, 0, 4, 1].map((answerIndex, index) => ({
        id: `blank-${index + 1}`,
        kind: "multipleChoice",
        blank: index + 1,
        prompt: `Choose the sentence for blank ${index + 1}.`,
        options: optionBank,
        answerIndex,
        wordKey: normalizeWordKey("workshop"),
        senseId: asSenseId("workshop:n.:1"),
      })),
    };

    render(<QuestionPreview question={question} />);
    expect(screen.getByText("文章 31 個英文詞")).toBeInTheDocument();
    expect(screen.getByText("空格答案")).toBeInTheDocument();
    fireEvent.click(screen.getByText("空格答案"));
    expect(screen.getByText("第 1 格")).toBeInTheDocument();
    expect(
      screen.getByText("C · The doors were unlocked."),
    ).toBeInTheDocument();
    expect(screen.getByText("A · The tools were ready.")).toBeInTheDocument();
    expect(
      screen.getByText("E · Everyone learned a new skill."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("B · They thanked the helpers."),
    ).toBeInTheDocument();
  });

  it("reviews one item at a time and can exclude the current question from saving", () => {
    const items: LibraryQuestion[] = [
      "The river _____ through the valley.",
      "The museum _____ its oldest painting.",
    ].map((prompt, index) => ({
      id: `question-${index}`,
      fingerprint: `question-${index}`,
      kind: "multipleChoice",
      questionStyle: "vocabulary",
      difficulty: 2,
      createdAt: "2026-10-03",
      updatedAt: "2026-10-03",
      wordKey: normalizeWordKey("preserve"),
      senseId: asSenseId("preserve:v.:1"),
      prompt,
      options: ["preserves", "measures", "observes", "collects"],
      answerIndex: 0,
    }));
    const onToggle = vi.fn();
    const { rerender } = render(
      <GeneratedQuestionResults items={items} words={[]} onToggle={onToggle} />,
    );
    expect(
      screen.getByText(
        items[0].kind === "multipleChoice" ? items[0].prompt : "",
      ),
    ).toBeVisible();
    expect(
      screen.queryByText("The museum _____ its oldest painting."),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "下一題" }));
    expect(
      screen.getByText("The museum _____ its oldest painting."),
    ).toBeVisible();
    expect(
      screen.queryByText("The river _____ through the valley."),
    ).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: "納入題庫" }));
    expect(onToggle).toHaveBeenCalledWith("question-1");
    rerender(
      <GeneratedQuestionResults
        items={[items[0]]}
        words={[]}
        onToggle={onToggle}
      />,
    );
    expect(
      screen.getByText("The river _____ through the valley."),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "下一題" })).toBeDisabled();
  });
});

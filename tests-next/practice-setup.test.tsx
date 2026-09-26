import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PracticeSetup } from "@/components/practice/practice-setup";
import { PRACTICE_QUESTION_TASKS } from "@/constants";
import type { PracticeTask } from "@/types";

afterEach(cleanup);

function counts(questions: number): Record<PracticeTask, number> {
  return Object.fromEntries(
    ["flashcard", "spelling", ...PRACTICE_QUESTION_TASKS].map((task) => [
      task,
      task === "vocabulary" ? questions : 0,
    ]),
  ) as Record<PracticeTask, number>;
}

describe("practice setup", () => {
  it("shows a single useful action when no questions exist", () => {
    render(
      <PracticeSetup
        amount={10}
        availableQuestionCount={0}
        backHref="/app"
        cardCount={0}
        counts={counts(0)}
        difficulty="all"
        hasWords
        hasQuestionContent={false}
        leechOnly={false}
        oneSensePerWord
        onAmountChange={vi.fn()}
        onBegin={vi.fn()}
        onDifficultyChange={vi.fn()}
        onLeechOnlyChange={vi.fn()}
        onOneSenseChange={vi.fn()}
        onSetChange={vi.fn()}
        onTasksChange={vi.fn()}
        onTrackChange={vi.fn()}
        queueLength={0}
        setId=""
        sets={[]}
        tasks={["vocabulary"]}
        track="questions"
        trackPreset="questions"
      />,
    );
    expect(
      screen.getByRole("link", { name: "用 AI 產生題目" }),
    ).toHaveAttribute("href", "/app/questions/generate");
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByText("步驟 1 / 1")).toBeNull();
  });

  it("offers the whole available question range and starts from the same screen", () => {
    const onAmountChange = vi.fn();
    const props = {
      amount: 10,
      availableQuestionCount: 47,
      backHref: "/app",
      cardCount: 0,
      counts: counts(47),
      difficulty: "all" as const,
      hasWords: true,
      hasQuestionContent: true,
      leechOnly: false,
      oneSensePerWord: true,
      onAmountChange,
      onBegin: vi.fn(),
      onDifficultyChange: vi.fn(),
      onLeechOnlyChange: vi.fn(),
      onOneSenseChange: vi.fn(),
      onSetChange: vi.fn(),
      onTasksChange: vi.fn(),
      onTrackChange: vi.fn(),
      queueLength: 10,
      setId: "",
      sets: [],
      tasks: ["vocabulary" as const],
      track: "questions" as const,
      trackPreset: "questions" as const,
    };
    const { rerender } = render(<PracticeSetup {...props} />);
    const slider = screen.getByRole("slider", { name: "題數" });
    expect(slider).toHaveAttribute("min", "1");
    expect(slider).toHaveAttribute("max", "47");
    expect(screen.getByRole("button", { name: "開始這 10 題" })).toBeVisible();

    fireEvent.change(slider, { target: { value: "46" } });
    expect(onAmountChange).toHaveBeenCalledWith(46);

    rerender(
      <PracticeSetup
        {...props}
        amount={46}
        availableQuestionCount={3}
        counts={counts(3)}
        queueLength={3}
      />,
    );
    expect(screen.getByRole("slider", { name: "題數" })).toHaveAttribute(
      "max",
      "3",
    );
    expect(screen.getByRole("slider", { name: "題數" })).toHaveValue("3");
    expect(screen.getByRole("button", { name: "開始這 3 題" })).toBeVisible();
  });
});

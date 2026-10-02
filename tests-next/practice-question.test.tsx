import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuestionCard } from "@/components/practice/question-card";
import { PracticeSessionView } from "@/components/practice/practice-session-view";
import type { QuestionItem } from "@/components/practice/practice-content";
import type { ReadingPack } from "@/types";

const passage: ReadingPack = {
  id: "passage-one",
  kind: "reading",
  fingerprint: "passage-one",
  format: "cloze",
  difficulty: 2,
  title: "A student project",
  passage: "The __1__ studied the __2__ carefully.",
  wordKeys: ["committee", "evidence"],
  explanation: "Whole-passage answers must remain private.",
  createdAt: "2026-10-03",
  updatedAt: "2026-10-03",
  questions: [
    {
      id: "one",
      kind: "multipleChoice",
      blank: 1,
      prompt: "",
      options: ["committee", "weather", "shadow", "building"],
      answerIndex: 0,
      wordKey: "committee",
      senseId: "sense-one",
    },
    {
      id: "two",
      kind: "multipleChoice",
      blank: 2,
      prompt: "",
      options: ["evidence", "shelter", "direction", "schedule"],
      answerIndex: 0,
      wordKey: "evidence",
      senseId: "sense-two",
    },
  ],
};

function itemAt(index: number): QuestionItem {
  const child = passage.questions[index];
  return {
    ...child,
    id: `reading:${passage.id}:${child.id}`,
    question: passage,
    type: "cloze",
    difficulty: 2,
    meaning: "",
    explanation: "This question follows the subject of studied.",
    whyWrong: { weather: "Weather cannot perform this investigation." },
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("practice reading workspace", () => {
  it("keeps feedback private while saving and reveals only this question's explanation", () => {
    const props = {
      item: itemAt(0),
      selected: null as number | null,
      pendingChoice: 1 as number | null,
      busy: true,
      answeredBlanks: {},
      onAnswer: vi.fn(),
    };
    const { rerender } = render(<QuestionCard {...props} />);
    expect(screen.getByRole("button", { name: /weather/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByText("這題答錯了")).toBeNull();
    expect(screen.queryByText(props.item.explanation!)).toBeNull();
    rerender(
      <QuestionCard
        {...props}
        selected={1}
        pendingChoice={null}
        busy={false}
      />,
    );
    expect(
      screen.getByText("Weather cannot perform this investigation."),
    ).toBeVisible();
    expect(screen.getByText(props.item.explanation!)).toBeVisible();
    expect(screen.queryByText(passage.explanation!)).toBeNull();
  });

  it("locates the current blank and retains the article tab, scroll and revealed context for the next item", async () => {
    const scrollIntoView = vi.fn();
    const original = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "scrollIntoView",
    );
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    const props = {
      entry: {
        id: itemAt(0).id,
        kind: "question" as const,
        task: "cloze" as const,
        item: itemAt(0),
      },
      index: 0,
      total: 2,
      progressRatio: 0,
      persistence: "idle" as const,
      revealed: false,
      selected: null,
      pendingChoice: null,
      answeredBlanks: {},
      marked: false,
      busy: false,
      animateCard: false,
      onLeave: vi.fn(),
      onReveal: vi.fn(),
      onRate: vi.fn(),
      onToggleMark: vi.fn(),
      onSkip: vi.fn(),
      onAnswer: vi.fn(),
      onCheckSpelling: vi.fn(),
      onNext: vi.fn(),
    };
    try {
      const { rerender } = render(<PracticeSessionView {...props} />);
      expect(screen.getByRole("tab", { name: "題目" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      fireEvent.click(screen.getByRole("button", { name: "找到第 1 格" }));
      await waitFor(() => expect(scrollIntoView).toHaveBeenCalledOnce());
      expect(screen.getByRole("tab", { name: "文章" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      const article = screen.getByRole("tabpanel", { name: "文章" });
      expect(screen.getByRole("tab", { name: "文章" })).toHaveAttribute(
        "aria-controls",
        article.id,
      );
      const scrollPane = article.querySelector("div")!;
      scrollPane.scrollTop = 120;
      rerender(
        <PracticeSessionView
          {...props}
          entry={{ ...props.entry, id: itemAt(1).id, item: itemAt(1) }}
          index={1}
          answeredBlanks={{ 1: { answer: "committee" } }}
        />,
      );
      expect(screen.getByRole("tab", { name: "文章" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      expect(scrollPane).toBeInTheDocument();
      expect(scrollPane.scrollTop).toBe(120);
      expect(article).toHaveTextContent("committee");
    } finally {
      if (original)
        Object.defineProperty(
          HTMLElement.prototype,
          "scrollIntoView",
          original,
        );
      else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
    }
  });
});

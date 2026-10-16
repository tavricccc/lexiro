import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuestionCard } from "@/components/practice/question-card";
import { QuestionFeedback } from "@/components/practice/question-feedback";
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
    whyWrong: {
      weather: "Weather cannot perform this investigation.",
      shadow: "A shadow cannot study evidence.",
      building: "A building cannot act as the investigating group.",
    },
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("practice option notes", () => {
  it("shows vocabulary meanings beside each option and the answer meaning once", () => {
    const item: QuestionItem = {
      id: "question:victim",
      question: null,
      prompt: "The _____ reported the stolen bicycle.",
      options: ["customer", "officer", "victim", "witness"],
      answerIndex: 2,
      wordKey: "victim",
      senseId: "victim-sense",
      type: "vocabulary",
      difficulty: 2,
      meaning: "受害者",
      explanation: "句中女子是腳踏車遭偷的受害者。",
      whyWrong: {
        customer: "「customer」意為「顧客」，與女子是腳踏車遭偷的受害者不符。",
        officer: "警員",
        witness: "目擊者；只看見事件，句中女子是失主",
      },
    };
    const { container } = render(<QuestionFeedback item={item} selected={2} />);
    expect(screen.getByText("受害者")).toBeVisible();
    expect(screen.getByText("顧客")).toBeVisible();
    expect(screen.getByText("警員")).toBeVisible();
    expect(screen.getByText("目擊者")).toBeVisible();
    expect(screen.getByText("只看見事件，句中女子是失主")).toBeVisible();
    expect(container.textContent).not.toContain("不符");
    expect(container.querySelectorAll("p").length).toBe(3);
  });

  it("keeps only meanings in a word bank and only the unused sentence in discourse", () => {
    const bank = ["plot", "current", "bank"];
    const base = {
      ...itemAt(0),
      options: bank,
      optionBank: bank,
      answerIndex: 0,
    };
    const { unmount } = render(
      <QuestionFeedback
        item={{
          ...base,
          type: "wordBank",
          whyWrong: {
            current: "目前的",
            bank: "這個選項不符合本格描述的情節線索。",
          },
        }}
        selected={0}
      />,
    );
    expect(screen.getByText("目前的")).toBeVisible();
    expect(screen.queryByText(/不符合本格/)).toBeNull();
    unmount();
    const group = {
      ...passage,
      format: "discourse" as const,
      questions: [
        { ...passage.questions[0], options: bank, answerIndex: 0 },
        { ...passage.questions[1], options: bank, answerIndex: 1 },
      ],
    };
    render(
      <QuestionFeedback
        item={{
          ...base,
          question: group,
          type: "discourse",
          whyWrong: {
            current: "第二格的句子。",
            bank: "放棄計畫與後文矛盾，放哪裡都不合。",
          },
        }}
        selected={0}
      />,
    );
    expect(
      screen.getByText("放棄計畫與後文矛盾，放哪裡都不合。"),
    ).toBeVisible();
    expect(screen.queryByText("第二格的句子。")).toBeNull();
  });
});

describe("practice reading workspace", () => {
  it("marks a revealed bank answer as used and prevents selecting it for the next blank", () => {
    const onAnswer = vi.fn();
    const item = {
      ...itemAt(1),
      type: "wordBank" as const,
      optionBank: ["committee", "evidence", "shadow"],
      options: ["committee", "evidence", "shadow"],
      answerIndex: 1,
    };
    render(
      <QuestionCard
        item={item}
        selected={null}
        pendingChoice={null}
        readOnly={false}
        answeredBlanks={{ 1: { answer: "committee" } }}
        onAnswer={onAnswer}
      />,
    );
    const used = screen.getByRole("button", {
      name: /committee.*已用於第 1 格/,
    });
    expect(used).toBeDisabled();
    fireEvent.click(used);
    expect(onAnswer).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /evidence/ }));
    expect(onAnswer).toHaveBeenCalledWith(1);
  });
  it.each([0, 1])(
    "keeps feedback private while a choice is pending and reveals every option reason after confirming %i",
    (choice) => {
      const props = {
        item: itemAt(0),
        selected: null as number | null,
        pendingChoice: 1 as number | null,
        readOnly: false,
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
      for (const reason of Object.values(props.item.whyWrong!)) {
        expect(screen.queryByText(reason)).toBeNull();
      }
      rerender(
        <QuestionCard {...props} selected={choice} pendingChoice={null} />,
      );
      for (const reason of Object.values(props.item.whyWrong!)) {
        expect(screen.getByText(reason)).toBeVisible();
      }
      expect(screen.getByText("正確答案：committee")).toBeVisible();
      expect(screen.getByText(props.item.explanation!)).toBeVisible();
      expect(screen.queryByText(passage.explanation!)).toBeNull();
    },
  );

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
      selected: null,
      pendingChoice: null,
      answeredBlanks: {},
      marked: false,
      reviewing: false,
      canGoBack: false,
      animateCard: false,
      backHref: "/app",
      onToggleMark: vi.fn(),
      onSkip: vi.fn(),
      onSelect: vi.fn(),
      onConfirm: vi.fn(),
      onNext: vi.fn(),
      onPrevious: vi.fn(),
      onForward: vi.fn(),
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

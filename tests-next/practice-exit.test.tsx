import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PracticePage } from "@/components/practice/practice-page";
import { emptyLibraryState } from "@/src/lib/library-repository";
import { buildSenseId, buildSetWordKey } from "@/src/lib/library";
import { practiceStorageKey } from "@/src/lib/practice-storage";
import { useLibraryStore } from "@/stores/library-store";

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({
    href,
    onNavigate,
    ...props
  }: ComponentProps<"a"> & { href: string; onNavigate?: () => void }) => (
    <a
      {...props}
      href={href}
      onClick={(event) => {
        event.preventDefault();
        onNavigate?.();
        navigate(href);
      }}
    />
  ),
}));

beforeEach(() => {
  localStorage.clear();
  navigate.mockClear();
  const library = emptyLibraryState();
  const wordKey = buildSetWordKey("set", "bank");
  const senseId = buildSenseId(wordKey, "n.", "銀行");
  const timestamp = "2026-10-11T00:00:00.000Z";
  library.words[wordKey] = {
    wordKey,
    word: "bank",
    senses: [
      {
        id: senseId,
        pos: "n.",
        meaningZh: "銀行",
        examples: [],
        supplementary: false,
      },
    ],
    updatedAt: timestamp,
  };
  library.sets = [
    {
      id: "set",
      setName: "Finance",
      folderId: "",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];
  library.memberships.set = [{ wordKey, senseIds: [senseId] }];
  library.questions = [
    {
      id: "question",
      kind: "multipleChoice",
      questionStyle: "vocabulary",
      difficulty: 2,
      wordKey,
      senseId,
      prompt: "Which bank is open?",
      options: ["A", "B", "C", "D"],
      answerIndex: 0,
      fingerprint: "bank",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];
  useLibraryStore.setState({ state: library, status: "ready" });
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("leaving practice", () => {
  it.each([
    ["", "/app"],
    ["set", "/app/sets/set"],
  ])(
    "exits directly to %s's parent and only offers resume on the next visit",
    async (initialSet, destination) => {
      const view = render(
        <PracticePage initialSet={initialSet} initialTrack="questions" />,
      );
      fireEvent.click(
        await screen.findByRole("button", { name: "開始這 1 題" }),
      );
      fireEvent.click(await screen.findByRole("button", { name: /A$/ }));
      expect(screen.queryByRole("button", { name: "查看結果" })).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "確認答案" }));
      await screen.findByRole("button", { name: "查看結果" });
      const saved = localStorage.getItem(practiceStorageKey());
      expect(JSON.parse(saved!)).toMatchObject({
        selected: expect.any(Number),
        correct: 1,
        answerChoices: [expect.any(Number)],
      });
      const exit = screen.getByRole("link", { name: "退出練習" });
      expect(exit).toHaveAttribute("href", destination);
      fireEvent.click(exit);
      expect(navigate).toHaveBeenCalledWith(destination);
      expect(
        screen.queryByRole("button", { name: "接續上次" }),
      ).not.toBeInTheDocument();
      view.unmount();
      expect(localStorage.getItem(practiceStorageKey())).toBe(saved);

      render(<PracticePage initialSet={initialSet} initialTrack="questions" />);
      fireEvent.click(await screen.findByRole("button", { name: "接續上次" }));
      expect(
        await screen.findByRole("button", { name: "查看結果" }),
      ).toBeVisible();
    },
  );
});

describe("moving through practice", () => {
  it("confirms a picked answer and lets the learner look back at it", async () => {
    const library = structuredClone(useLibraryStore.getState().state);
    const wordKey = buildSetWordKey("set", "river");
    const senseId = buildSenseId(wordKey, "n.", "河流");
    const [first] = library.questions;
    library.words[wordKey] = {
      ...library.words[first.wordKey],
      wordKey,
      word: "river",
      senses: [{ ...library.words[first.wordKey].senses[0], id: senseId }],
    };
    library.memberships.set.push({ wordKey, senseIds: [senseId] });
    library.questions.push({
      ...first,
      id: "question-2",
      wordKey,
      senseId,
      prompt: "Which river is long?",
      fingerprint: "river",
    });
    useLibraryStore.setState({ state: library });
    render(<PracticePage initialSet="set" initialTrack="questions" />);
    fireEvent.click(await screen.findByRole("button", { name: /開始這 2 題/ }));

    const confirm = await screen.findByRole("button", { name: "確認答案" });
    expect(confirm).toBeDisabled();
    expect(screen.queryByRole("button", { name: /上一題/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^B/ }));
    fireEvent.click(screen.getByRole("button", { name: /^A/ }));
    expect(screen.queryByText("答對了")).toBeNull();
    fireEvent.click(confirm);
    const firstPrompt = screen.getByRole("heading", { level: 1 }).textContent;
    fireEvent.click(await screen.findByRole("button", { name: "下一題" }));

    const secondPrompt = screen.getByRole("heading", { level: 1 }).textContent;
    expect(secondPrompt).not.toBe(firstPrompt);
    fireEvent.click(screen.getByRole("button", { name: /^C/ }));
    fireEvent.click(screen.getByRole("button", { name: /上一題/ }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      firstPrompt!,
    );
    expect(screen.getByText("回顧中")).toBeVisible();
    expect(screen.getByRole("button", { name: /^A/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^A/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: /往後一題/ }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      secondPrompt!,
    );
    // The pick made before looking back is still waiting for confirmation.
    expect(screen.getByRole("button", { name: /^C/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "確認答案" })).toBeEnabled();
  });
});

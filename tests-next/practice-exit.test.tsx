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
      fireEvent.click(await screen.findByRole("button", { name: /A.*A/ }));
      await screen.findByRole("button", { name: "查看結果" });
      const saved = localStorage.getItem(practiceStorageKey());
      expect(JSON.parse(saved!)).toMatchObject({
        selected: 0,
        correct: 1,
        answerChoices: [0],
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

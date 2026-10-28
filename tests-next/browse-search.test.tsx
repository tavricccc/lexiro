import { useState } from "react";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { render } from "./render";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchField } from "@/components/ui/search-field";
import { QuestionList } from "@/components/questions/question-list";
import { SetView } from "@/components/library/set-view";
import { emptyLibraryState } from "@/src/lib/library-repository";
import { buildSenseId, normalizeWordKey } from "@/src/lib/library";
import { UNCATEGORIZED_FOLDER_ID } from "@/src/lib/folders";
import { setMatchesQuery } from "@/src/lib/library-search";
import {
  libraryBrowseHref,
  readBrowseReturn,
  replaceBrowseHref,
} from "@/lib/browse-routes";
import { useLibraryStore } from "@/stores/library-store";

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => vi.fn(),
}));

function library() {
  const state = emptyLibraryState();
  const wordKey = normalizeWordKey("bank");
  const selected = buildSenseId(wordKey, "n.", "銀行");
  const excluded = buildSenseId(wordKey, "n.", "河岸");
  const timestamp = "2026-10-02T00:00:00.000Z";
  state.words[wordKey] = {
    wordKey,
    word: "bank",
    updatedAt: timestamp,
    senses: [
      {
        id: selected,
        pos: "n.",
        meaningZh: "銀行",
        examples: ["The bank is open."],
        supplementary: false,
      },
      {
        id: excluded,
        pos: "n.",
        meaningZh: "河岸",
        examples: ["A river flows nearby."],
        supplementary: false,
      },
    ],
  };
  state.sets = [
    {
      id: "set",
      setName: "Finance",
      folderId: UNCATEGORIZED_FOLDER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];
  state.memberships.set = [{ wordKey, senseIds: [selected] }];
  state.questions = [
    {
      id: "question",
      kind: "multipleChoice",
      questionStyle: "vocabulary",
      difficulty: 2,
      wordKey,
      senseId: selected,
      prompt: "Which bank is open?",
      options: ["A", "B", "C", "D"],
      answerIndex: 0,
      fingerprint: "bank",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];
  return state;
}

beforeEach(() => {
  useLibraryStore.setState({ state: library(), status: "ready" });
});
afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

describe("collection search and return paths", () => {
  it("preserves custom history state while letting Next.js process filtering", () => {
    const routerTree = { tree: ["app", "library"] };
    window.history.replaceState(
      {
        __NA: true,
        __PRIVATE_NEXTJS_INTERNALS_TREE: routerTree,
        __lexiroHistoryIndex: 7,
        scrollPosition: 120,
      },
      "",
      "/app/library",
    );
    const historyLength = window.history.length;
    const replace = vi.spyOn(window.history, "replaceState");
    replaceBrowseHref("/app/library?q=bank");
    expect(replace.mock.calls[0][0]).not.toHaveProperty("__NA");
    expect(window.history.state).toMatchObject({
      __lexiroHistoryIndex: 7,
      scrollPosition: 120,
      __PRIVATE_NEXTJS_INTERNALS_TREE: routerTree,
    });
    expect(window.history.length).toBe(historyLength);
    replace.mockRestore();
  });

  it("clears with one tap or Escape, restores input focus, and respects IME composition", () => {
    function Search() {
      const [value, setValue] = useState("bank");
      return (
        <SearchField label="Search" value={value} onValueChange={setValue} />
      );
    }
    render(<Search />);
    const input = screen.getByRole("searchbox", { name: "Search" });
    fireEvent.click(screen.getByRole("button", { name: "清除搜尋" }));
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: "銀行" } });
    fireEvent.keyDown(input, { key: "Escape", isComposing: true });
    expect(input).toHaveValue("銀行");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveValue("");
  });

  it("keeps bank filters in edit links and restores them on return, with a one-step empty-result reset", () => {
    window.history.replaceState(null, "", "/app/questions");
    const first = render(
      <QuestionList
        initialFilters={{ q: "bank", kind: "vocabulary", difficulty: "2" }}
      />,
    );
    const href = screen
      .getByRole("link", { name: /Which bank is open\?/ })
      .getAttribute("href")!;
    const returnHref = new URL(href, window.location.origin).searchParams.get(
      "returnTo",
    )!;
    expect(returnHref).toBe(
      "/app/questions?q=bank&kind=vocabulary&difficulty=2",
    );
    expect(window.location.pathname + window.location.search).toBe(returnHref);
    first.unmount();
    const params = new URL(returnHref, window.location.origin).searchParams;
    render(<QuestionList initialFilters={Object.fromEntries(params)} />);
    expect(screen.getByRole("searchbox", { name: "搜尋題目" })).toHaveValue(
      "bank",
    );
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "unmatched" },
    });
    fireEvent.click(screen.getByRole("button", { name: "清除篩選" }));
    expect(
      screen.getByRole("link", { name: /Which bank is open\?/ }),
    ).toBeVisible();
    expect(window.location.search).toBe("");
  });

  it("searches only meanings and examples that belong to the visible set", () => {
    const state = library();
    expect(setMatchesQuery(state, "set", "銀行")).toBe(true);
    expect(setMatchesQuery(state, "set", "open")).toBe(true);
    expect(setMatchesQuery(state, "set", "bank")).toBe(true);
    expect(setMatchesQuery(state, "set", "河岸")).toBe(false);
    expect(setMatchesQuery(state, "set", "river")).toBe(false);
  });

  it("returns a set's question edit to the same tab while retaining the parent folder search", () => {
    window.history.replaceState(null, "", "/app/sets/set");
    const parent = libraryBrowseHref("parent", "銀行 & bank");
    render(<SetView setId="set" initialTab="questions" returnTo={parent} />);
    const href = screen
      .getByRole("link", { name: /Which bank is open\?/ })
      .getAttribute("href")!;
    const returnHref = new URL(href, window.location.origin).searchParams.get(
      "returnTo",
    )!;
    const destination = new URL(returnHref, window.location.origin);
    expect(destination.pathname).toBe("/app/sets/set");
    expect(destination.searchParams.get("tab")).toBe("questions");
    expect(destination.searchParams.get("returnTo")).toBe(parent);
    expect(readBrowseReturn(returnHref)).toBe(returnHref);
    expect(
      readBrowseReturn("https://example.com/app/questions"),
    ).toBeUndefined();
  });

  it("searches visible set senses and examples, preserves the edit return, and clears an empty result", () => {
    window.history.replaceState(null, "", "/app/sets/set");
    const parent = libraryBrowseHref("parent", "銀行 & bank");
    render(<SetView setId="set" initialQuery=" OPEN " returnTo={parent} />);
    const input = screen.getByRole("searchbox", {
      name: "搜尋本集單字、中文或例句",
    });
    expect(input).toHaveValue(" OPEN ");
    expect(screen.getByText("1 / 1 個單字")).toBeVisible();
    const edit = screen.getByRole("link", { name: /^bank/ });
    const returnTo = new URL(
      edit.getAttribute("href")!,
      window.location.origin,
    ).searchParams.get("returnTo")!;
    const destination = new URL(returnTo, window.location.origin);
    expect(destination.searchParams.get("q")).toBe(" OPEN ");
    expect(destination.searchParams.get("returnTo")).toBe(parent);
    fireEvent.change(input, { target: { value: "river" } });
    expect(screen.queryByText("bank")).not.toBeInTheDocument();
    expect(screen.getByText("本集中沒有符合的內容")).toBeVisible();
    expect(screen.getByRole("link", { name: "開始練這組字" })).toBeVisible();
    fireEvent.click(
      screen.getAllByRole("button", { name: "清除搜尋" }).at(-1)!,
    );
    expect(input).toHaveValue("");
    expect(screen.getByText("bank")).toBeVisible();
    expect(window.location.search).not.toContain("q=");
  });

  it("carries the set query between words and questions and restores it after editing", async () => {
    window.history.replaceState(null, "", "/app/sets/set");
    const view = render(<SetView setId="set" initialQuery="bank" />);
    const tab = screen.getByRole("tab", { name: "題目 1" });
    fireEvent.mouseDown(tab);
    fireEvent.click(tab);
    const link = await screen.findByRole("link", {
      name: /Which bank is open\?/,
    });
    const returnTo = new URL(
      link.getAttribute("href")!,
      window.location.origin,
    ).searchParams.get("returnTo")!;
    const destination = new URL(returnTo, window.location.origin);
    expect(destination.searchParams.get("q")).toBe("bank");
    expect(destination.searchParams.get("tab")).toBe("questions");
    view.unmount();
    render(
      <SetView
        setId="set"
        initialTab={destination.searchParams.get("tab")!}
        initialQuery={destination.searchParams.get("q")!}
      />,
    );
    expect(screen.getByRole("searchbox")).toHaveValue("bank");
    expect(screen.getByText("1 / 1 題／題組")).toBeVisible();
  });

  it("finds reading child prompts, individual options and shared options in both set and bank search", async () => {
    const state = library();
    const source = state.questions[0];
    if (source.kind !== "multipleChoice") throw new Error("Expected fixture");
    state.questions = [
      {
        ...source,
        id: "reading",
        kind: "reading",
        format: "wordBank",
        title: "A journey",
        passage: "People travel every year.",
        wordKeys: [source.wordKey],
        questions: [
          {
            ...source,
            id: "child",
            prompt: "Why visit?",
            options: ["airplane"],
          },
        ],
        optionBank: ["harbour"],
      },
    ];
    useLibraryStore.setState({ state });
    window.history.replaceState(null, "", "/app/sets/set");
    const view = render(
      <SetView setId="set" initialTab="questions" initialQuery="HARBOUR" />,
    );
    expect(screen.getByRole("link", { name: /A journey/ })).toBeVisible();
    view.unmount();
    window.history.replaceState(null, "", "/app/questions");
    render(<QuestionList initialFilters={{ q: "visit" }} />);
    expect(screen.getByRole("link", { name: /A journey/ })).toBeVisible();
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "airplane" },
    });
    await waitFor(() =>
      expect(screen.getByRole("link", { name: /A journey/ })).toBeVisible(),
    );
  });
});

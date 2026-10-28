import { cleanup, screen } from "@testing-library/react";
import { render } from "./render";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SetView } from "@/components/library/set-view";
import { emptyLibraryState } from "@/src/lib/library-repository";
import { buildSenseId, buildSetWordKey, compareWords } from "@/src/lib/library";
import { UNCATEGORIZED_FOLDER_ID } from "@/src/lib/folders";
import { setWordDrafts } from "@/src/lib/word-edit";
import { useLibraryStore } from "@/stores/library-store";

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => vi.fn(),
}));

/** A set whose stored memberships are deliberately out of order. */
function library(words: string[]) {
  const state = emptyLibraryState();
  const timestamp = "2026-10-02T00:00:00.000Z";
  state.sets = [
    {
      id: "set",
      setName: "Order",
      folderId: UNCATEGORIZED_FOLDER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];
  state.memberships.set = words.map((word) => {
    const wordKey = buildSetWordKey("set", word);
    const id = buildSenseId(wordKey, "n.", word);
    state.words[wordKey] = {
      wordKey,
      word,
      updatedAt: timestamp,
      senses: [
        {
          id,
          pos: "n.",
          meaningZh: word,
          examples: [],
          supplementary: false,
        },
      ],
    };
    return { wordKey, senseIds: [id] };
  });
  return state;
}

afterEach(cleanup);

describe("word order", () => {
  it("sorts A to Z ignoring case and accents, with numbers by value", () => {
    expect(
      ["zebra", "Apple", "item 10", "éclair", "item 2", "apple", "Banana"].sort(
        compareWords,
      ),
    ).toEqual([
      "Apple",
      "apple",
      "Banana",
      "éclair",
      "item 2",
      "item 10",
      "zebra",
    ]);
  });

  it("lists a set's words A to Z whatever order they were stored in", () => {
    useLibraryStore.setState({
      state: library(["cherry", "Apple", "banana"]),
      status: "ready",
    });
    render(<SetView setId="set" returnTo="/library" />);
    const shown = ["Apple", "banana", "cherry"].map(
      (word) => screen.getAllByText(word)[0],
    );
    for (let i = 1; i < shown.length; i++)
      expect(
        shown[i - 1].compareDocumentPosition(shown[i]) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
  });

  it("opens the set editor in the same order", () => {
    expect(
      setWordDrafts(library(["cherry", "Apple", "banana"]), "set").map(
        (draft) => draft.word,
      ),
    ).toEqual(["Apple", "banana", "cherry"]);
  });
});

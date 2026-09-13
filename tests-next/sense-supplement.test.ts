import { describe, expect, it, vi } from "vitest";

import { buildSenseId, normalizeWordKey } from "@/src/lib/library";
import { emptyLibraryState } from "@/src/lib/library-repository";
import { supplementTask } from "@/src/lib/ai/tasks";
import { prepareWordEdit, setWordDrafts } from "@/src/lib/word-edit";
import { useLibraryStore } from "@/stores/library-store";
import {
  parseSupplementaryJson,
  type SupplementSource,
} from "@/src/lib/word-generation";

vi.mock("@/src/lib/library-repository", async (original) => ({
  ...(await original<typeof import("@/src/lib/library-repository")>()),
  getLibraryRepository: () => ({ commit: async () => ({ changed: [], removed: [] }) }),
}));
vi.mock("@/src/lib/sync-journal", () => ({
  recordLocalChanges: async () => {},
  untrackChanges: async () => {},
}));

const bank: SupplementSource = {
  word: "bank",
  existing: [{ pos: "n.", meaningZh: "銀行" }],
};
const apple: SupplementSource = {
  word: "apple",
  existing: [{ pos: "n.", meaningZh: "蘋果" }],
};
const river = {
  pos: "n.",
  meaningZh: "河岸",
  example: "We sat on the bank of the river.",
};
const reply = (...items: unknown[][]) =>
  JSON.stringify({ items: items.map((senses) => ({ senses })) });

describe("supplementing a word's meanings", () => {
  it("reads an empty answer as an answer, not a failure", () => {
    const drafts = parseSupplementaryJson(reply([], [river]), [apple, bank], 2);
    expect(drafts[0]).toMatchObject({ word: "apple", senses: [] });
    expect(drafts[1].senses[0]).toMatchObject({ meaning: "河岸", pos: "n." });
  });

  it("marks every meaning it returns as supplementary", () => {
    const [draft] = parseSupplementaryJson(reply([river]), [bank], 1);
    expect(draft.senses.every((sense) => sense.supplementary)).toBe(true);
  });

  it("refuses more meanings than were asked for", () => {
    const second = { ...river, meaningZh: "銀行業" };
    expect(() =>
      parseSupplementaryJson(reply([river, second]), [bank], 1),
    ).toThrow(/詞義數量不正確/);
    expect(
      parseSupplementaryJson(reply([river, second]), [bank], 2)[0].senses,
    ).toHaveLength(2);
  });

  it("refuses a meaning the word already had", () => {
    const again = { pos: "n.", meaningZh: "銀行", example: "I went to the bank." };
    expect(() => parseSupplementaryJson(reply([again]), [bank], 2)).toThrow(
      /已經有的詞義/,
    );
    expect(() =>
      parseSupplementaryJson(reply([river, { ...river }]), [bank], 2),
    ).toThrow(/已經有的詞義/);
  });

  it("refuses a meaning that does not say its own part of speech", () => {
    expect(() =>
      parseSupplementaryJson(reply([{ ...river, pos: null }]), [bank], 1),
    ).toThrow(/pos/);
  });

  it("asks about each word once, whatever it already holds", () => {
    const task = supplementTask([bank, apple], 2);
    expect(task.kind).toBe("senses");
    expect(task.billableCount).toBe(2);
    const sent = JSON.parse(task.steps[0].prompt) as {
      limit: number;
      sources: { ref: string; word: string; meaningZh: string }[];
    };
    expect(sent.limit).toBe(2);
    expect(sent.sources.map((source) => source.meaningZh)).toEqual([
      "銀行",
      "蘋果",
    ]);
    expect(new Set(sent.sources.map((source) => source.ref)).size).toBe(2);
  });
});

describe("what a supplemented meaning survives", () => {
  it("stays marked through saving, reading back and a later edit", async () => {
    const state = emptyLibraryState();
    state.sets = [
      {
        id: "set",
        setName: "set",
        folderId: "folder",
        createdAt: "2026-09-13",
        updatedAt: "2026-09-13",
      },
    ];
    useLibraryStore.setState({ state, status: "ready" });
    await useLibraryStore.getState().saveSet({
      id: "set",
      setName: "set",
      folderId: "folder",
      words: [
        { word: "bank", pos: "n.", meaningZh: "銀行", examples: [], supplementary: false },
        { word: "bank", pos: "n.", meaningZh: "河岸", examples: [], supplementary: true },
      ],
    });
    const key = normalizeWordKey("bank");
    const saved = () => useLibraryStore.getState().state.words[key].senses;
    expect(saved().map((sense) => sense.supplementary)).toEqual([false, true]);
    expect(setWordDrafts(useLibraryStore.getState().state, "set")[1].supplementary).toBe(true);

    // Editing the word rewrites every row it owns, so the mark has to travel
    // with the row rather than being recreated from what is being edited.
    const current = useLibraryStore.getState().state;
    const input = prepareWordEdit(current, "set", key, {
      word: "bank",
      senses: current.words[key].senses.map((sense) => ({
        id: sense.id,
        pos: sense.pos,
        meaning: sense.meaningZh,
        examples: ["A bank sits by the river."],
        supplementary: sense.supplementary,
      })),
    });
    await useLibraryStore.getState().saveSet(input);
    expect(saved().find((sense) => sense.meaningZh === "河岸")?.supplementary).toBe(true);
    expect(saved().find((sense) => sense.meaningZh === "銀行")?.supplementary).toBe(false);
    expect(buildSenseId(key, "n.", "河岸")).toBe(
      saved().find((sense) => sense.meaningZh === "河岸")?.id,
    );
  });
});

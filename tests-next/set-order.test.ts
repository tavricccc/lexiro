import type { LibrarySet } from "@/types";
import { describe, expect, it } from "vitest";

import {
  createUncategorizedFolder,
  UNCATEGORIZED_FOLDER_ID,
} from "@/src/lib/folders";
import { buildSenseId, buildSetWordKey } from "@/src/lib/library";
import { normalizeLibraryState } from "@/src/lib/share";
import { compareSets, planSetReorder, sortSets } from "@/src/lib/set-order";

const timestamp = "2026-08-17T00:00:00.000Z";

function set(id: string, overrides: Partial<LibrarySet> = {}): LibrarySet {
  return {
    id,
    setName: id,
    folderId: UNCATEGORIZED_FOLDER_ID,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

function ordered(): LibrarySet[] {
  return [
    set("a", { order: 1024 }),
    set("b", { order: 2048 }),
    set("c", { order: 3072 }),
    set("d", { order: 4096 }),
  ];
}

describe("compareSets", () => {
  it("places sets without an order before sets that have one", () => {
    const unordered = set("new", { createdAt: "2026-08-18T00:00:00.000Z" });
    const orderedSet = set("old", {
      order: 1,
      createdAt: "2026-08-01T00:00:00.000Z",
    });
    expect(compareSets(unordered, orderedSet)).toBeLessThan(0);
    expect(compareSets(orderedSet, unordered)).toBeGreaterThan(0);
  });

  it("orders unplaced sets newest first, then by id", () => {
    const newer = set("newer", { createdAt: "2026-08-18T00:00:00.000Z" });
    const older = set("older", { createdAt: "2026-08-01T00:00:00.000Z" });
    expect(compareSets(newer, older)).toBeLessThan(0);
    expect(compareSets(set("a"), set("b"))).toBeLessThan(0);
  });

  it("orders placed sets by order, then newest, then id", () => {
    expect(
      compareSets(
        set("low", { order: 1, createdAt: "2026-08-01T00:00:00.000Z" }),
        set("high", { order: 2, createdAt: "2026-08-18T00:00:00.000Z" }),
      ),
    ).toBeLessThan(0);
    expect(
      compareSets(
        set("newer", { order: 1, createdAt: "2026-08-18T00:00:00.000Z" }),
        set("older", { order: 1, createdAt: "2026-08-01T00:00:00.000Z" }),
      ),
    ).toBeLessThan(0);
    expect(
      compareSets(set("a", { order: 1 }), set("b", { order: 1 })),
    ).toBeLessThan(0);
  });

  it("sorts a copy and leaves the original listing alone", () => {
    const listing = [set("placed", { order: 1 }), set("unplaced")];
    expect(sortSets(listing).map((entry) => entry.id)).toEqual([
      "unplaced",
      "placed",
    ]);
    expect(listing.map((entry) => entry.id)).toEqual(["placed", "unplaced"]);
  });
});

describe("planSetReorder", () => {
  it("writes only the moved set when it lands in the middle", () => {
    expect(planSetReorder(ordered(), "a", 2)).toEqual([
      { id: "a", order: 3584 },
    ]);
  });

  it("writes only the moved set when it lands at the start", () => {
    expect(planSetReorder(ordered(), "c", 0)).toEqual([{ id: "c", order: 0 }]);
  });

  it("writes only the moved set when it lands at the end", () => {
    expect(planSetReorder(ordered(), "a", 3)).toEqual([
      { id: "a", order: 5120 },
    ]);
  });

  it("renumbers the folder when any set has no order yet", () => {
    const listing = [
      set("a", { order: 1024 }),
      set("b"),
      set("c", { order: 2048 }),
    ];
    expect(planSetReorder(listing, "a", 2)).toEqual([
      { id: "b", order: 1024 },
      { id: "a", order: 3072 },
    ]);
  });

  it("renumbers when there is no precision left between neighbours", () => {
    const listing = [
      set("a", { order: 1 }),
      set("b", { order: 1 + Number.EPSILON }),
      set("c", { order: 1024 }),
    ];
    expect(planSetReorder(listing, "c", 1)).toEqual([
      { id: "a", order: 1024 },
      { id: "c", order: 2048 },
      { id: "b", order: 3072 },
    ]);
  });

  it("returns nothing when the position does not change or the set is absent", () => {
    expect(planSetReorder(ordered(), "b", 1)).toEqual([]);
    expect(planSetReorder(ordered(), "missing", 0)).toEqual([]);
  });
});

describe("normalizeLibraryState set order", () => {
  const wordKey = buildSetWordKey("set-1", "adapt");
  const senseId = buildSenseId(wordKey, "v.", "適應");

  function library(order?: unknown) {
    return {
      version: 2,
      words: {
        [wordKey]: {
          wordKey,
          word: "adapt",
          senses: [
            {
              id: senseId,
              pos: "v.",
              meaningZh: "適應",
              examples: [],
              supplementary: false,
            },
          ],
          updatedAt: timestamp,
        },
      },
      sets: [
        {
          id: "set-1",
          setName: "核心單字",
          folderId: UNCATEGORIZED_FOLDER_ID,
          ...(order === undefined ? {} : { order }),
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      memberships: { "set-1": [{ wordKey, senseIds: [senseId] }] },
      folders: [createUncategorizedFolder()],
      questions: [],
      updatedAt: timestamp,
    };
  }

  it("keeps a numeric order and leaves it absent otherwise", () => {
    expect(normalizeLibraryState(library(2048)).sets[0].order).toBe(2048);
    expect(normalizeLibraryState(library()).sets[0]).not.toHaveProperty(
      "order",
    );
  });

  it("rejects a non-numeric or non-finite order", () => {
    expect(() => normalizeLibraryState(library("2048"))).toThrow(
      "sets[0].order 格式錯誤",
    );
    expect(() => normalizeLibraryState(library(Number.NaN))).toThrow(
      "sets[0].order 格式錯誤",
    );
    expect(() =>
      normalizeLibraryState(library(Number.POSITIVE_INFINITY)),
    ).toThrow("sets[0].order 格式錯誤");
  });
});

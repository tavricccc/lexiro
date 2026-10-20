import { describe, expect, it } from "vitest";

import {
  liveSetIds,
  practiceScopeLabel,
  scopeSenseIds,
} from "@/components/practice/use-practice-pool";
import type { LibrarySet, LibraryState } from "@/types";

const sets = [
  { id: "a", setName: "Unit A" },
  { id: "b", setName: "Unit B" },
  { id: "c", setName: "Unit C" },
] as LibrarySet[];
const memberships = {
  a: [{ wordKey: "one", senseIds: ["one-1"] }],
  b: [{ wordKey: "two", senseIds: ["two-1", "two-2"] }],
  c: [{ wordKey: "one", senseIds: ["one-1"] }],
} as unknown as LibraryState["memberships"];

describe("practice scope", () => {
  it("draws from every chosen set, or the whole library when none is chosen", () => {
    expect([...scopeSenseIds(memberships, ["a", "b"])].sort()).toEqual([
      "one-1",
      "two-1",
      "two-2",
    ]);
    expect([...scopeSenseIds(memberships, [])].sort()).toEqual([
      "one-1",
      "two-1",
      "two-2",
    ]);
    expect([...scopeSenseIds(memberships, ["c"])]).toEqual(["one-1"]);
  });

  it("drops deleted sets so a scope of only deleted sets widens to all", () => {
    expect(liveSetIds(sets, ["b", "gone"])).toEqual(["b"]);
    expect(liveSetIds(sets, ["gone"])).toEqual([]);
  });

  it("names all sets, the one set, or how many are chosen", () => {
    expect(practiceScopeLabel(sets, [])).toBe("全部單字集");
    expect(practiceScopeLabel(sets, ["b"])).toBe("Unit B");
    expect(practiceScopeLabel(sets, ["a", "c"])).toBe("2 個單字集");
  });
});

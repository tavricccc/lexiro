import { describe, expect, it } from "vitest";
import type { Folder } from "@lexiro/contract";
import { folderTree } from "@/features/library/folders";

const folder = (id: string, name: string, parentId: string | null = null, order = 0): Folder => ({
  id,
  name,
  parentId,
  order,
  updatedAt: "",
});

describe("folderTree", () => {
  it("orders siblings by order then name and flattens parents before children", () => {
    const tree = folderTree([
      folder("b", "Beta", null, 1),
      folder("a", "Alpha", null, 0),
      folder("c", "Child", "a", 0),
      folder("d", "Deep", "c", 0),
    ]);
    expect(tree.children(null).map((entry) => entry.id)).toEqual(["a", "b"]);
    expect(tree.flat.map(({ folder: entry, depth }) => [entry.id, depth])).toEqual([
      ["a", 0],
      ["c", 1],
      ["d", 2],
      ["b", 0],
    ]);
    expect(tree.path("d")).toBe("Alpha / Child / Deep");
    expect([...tree.within("a")].sort()).toEqual(["a", "c", "d"]);
  });

  it("promotes orphan and cyclic folders to the top level so none become unreachable", () => {
    const tree = folderTree([
      folder("orphan", "Orphan", "missing", 0),
      folder("x", "Loop X", "y", 1),
      folder("y", "Loop Y", "x", 2),
    ]);
    expect(tree.children(null).map((entry) => entry.id)).toEqual(["orphan", "x", "y"]);
  });
});

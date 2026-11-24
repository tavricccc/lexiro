import { describe, expect, it } from "vitest";
import { presentationOf, tabOf } from "@/app/hierarchy";

describe("presentationOf", () => {
  it.each([
    ["/app", "tab"],
    ["/app/library", "tab"],
    ["/app/library/folder/f", "push"],
    ["/app/sets/a", "push"],
    ["/app/sets/a/questions/q", "push"],
    ["/app/practice", "push"],
    ["/app/me/data", "push"],
    ["/app/sets/new", "modal"],
    ["/app/sets/a/settings", "modal"],
    ["/app/sets/a/add", "modal"],
    ["/app/sets/a/words/w/edit", "modal"],
    ["/app/library/shared/code", "modal"],
    ["/app/sets/a/words/w", "sheet"],
    ["/app/practice/run", "full"],
    ["/app/rooms/123456", "full"],
    ["/app/sets/a/cards", "full"],
  ])("%s arrives as a %s", (path, presentation) => expect(presentationOf(path)).toBe(presentation));
});

describe("tabOf", () => {
  it("names the destination a page belongs to", () => {
    expect(tabOf("/app/sets/a/words/w")).toBe("/app/library");
    expect(tabOf("/app/starred")).toBe("/app/library");
    expect(tabOf("/app/practice/run")).toBe("/app");
    expect(tabOf("/app/me/data")).toBe("/app/me");
    expect(tabOf("/app/nowhere")).toBeNull();
  });
});

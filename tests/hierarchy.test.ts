import { describe, expect, it } from "vitest";
import { screenLevel, travelDirection } from "@/app/hierarchy";

describe("screenLevel", () => {
  it.each([
    ["/app", 0], ["/app/library", 0], ["/app/rooms", 0], ["/app/me", 0],
    ["/app/sets/new", 1], ["/app/sets/abc", 1], ["/app/practice", 1], ["/app/me/account", 1], ["/app/rooms/ABC234", 1],
    ["/app/sets/abc/words/w1", 2], ["/app/sets/abc/settings", 2], ["/app/practice/run", 2],
    ["/app/sets/abc/words/w1/edit", 3],
  ])("puts %s at level %i", (path, level) => expect(screenLevel(path)).toBe(level));
});

describe("travelDirection", () => {
  it("pushes into a child, pops back to a parent and fades between tabs", () => {
    expect(travelDirection("/app/library", "/app/sets/a")).toBe(1);
    expect(travelDirection("/app/sets/a/words/w", "/app/sets/a")).toBe(-1);
    expect(travelDirection("/app", "/app/progress")).toBe(0);
  });
});

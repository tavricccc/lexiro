import { describe, expect, it } from "vitest";
import { firstStack, nextStack, rested, type Stack, type Visit } from "@/app/stack";

const visit = (pathname: string, idx: number, rest: Partial<Visit> = {}): Visit => ({ pathname, search: "", idx, action: "PUSH", back: false, view: pathname, ...rest });
const back = (pathname: string, idx: number) => visit(pathname, idx, { action: "POP", back: true });
const walk = (first: Visit, ...rest: Visit[]) => rest.reduce<Stack>((stack, next) => rested(nextStack(stack, next)), firstStack(first));
const paths = (stack: Stack) => stack.entries.map((entry) => entry.key);
const leaving = (stack: Stack) => stack.leaving.map((entry) => entry.key);

describe("nextStack", () => {
  it("pushes a page over the one before and takes it away again on the way back", () => {
    const pushed = nextStack(firstStack(visit("/app/library", 0)), visit("/app/sets/a", 1));
    expect(paths(pushed)).toEqual(["/app/library", "/app/sets/a"]);
    expect(pushed.entering).toBe("/app/sets/a");
    const popped = nextStack(rested(pushed), back("/app/library", 0));
    expect(paths(popped)).toEqual(["/app/library"]);
    expect(leaving(popped)).toEqual(["/app/sets/a"]);
  });

  it("swaps destinations in place and keeps the ones opened before", () => {
    const stack = nextStack(firstStack(visit("/app", 0)), visit("/app/library", 1));
    expect(paths(stack)).toEqual(["/app/library"]);
    expect(stack.tabs.map((tab) => tab.key)).toEqual(["/app", "/app/library"]);
    expect(stack.instant).toBe(true);
  });

  it("stays where it is when only the query changes", () => {
    const before = walk(visit("/app/library", 0), visit("/app/sets/a", 1));
    const after = nextStack(before, visit("/app/sets/a", 1, { search: "?tab=questions", action: "REPLACE" }));
    expect(after.turn).toBe(before.turn);
    expect(after.entries.at(-1)?.search).toBe("?tab=questions");
  });

  it("puts a sheet away to go on to a page from it", () => {
    const stack = walk(visit("/app/library", 0), visit("/app/sets/a", 1), visit("/app/sets/a/words/w", 2));
    const on = nextStack(stack, visit("/app/sets/b", 3));
    expect(paths(on)).toEqual(["/app/library", "/app/sets/a", "/app/sets/b"]);
    expect(leaving(on)).toEqual(["/app/sets/a/words/w"]);
  });

  it("lays one sheet over another", () => {
    const stack = walk(visit("/app/sets/a", 0), visit("/app/sets/a/words/w", 1), visit("/app/sets/a/words/w/edit", 2));
    expect(paths(stack)).toEqual(["/app/sets/a", "/app/sets/a/words/w", "/app/sets/a/words/w/edit"]);
  });

  it("unwinds several screens at once, with only the one in use moving", () => {
    const stack = walk(visit("/app", 0), visit("/app/practice", 1), visit("/app/practice/run", 2));
    const home = nextStack(stack, back("/app", 0));
    expect(paths(home)).toEqual(["/app"]);
    expect(leaving(home)).toEqual(["/app/practice/run"]);
  });

  it("draws a deep-linked sheet as a page, and slides it out to its parent", () => {
    const stack = firstStack(visit("/app/sets/a/words/w", 0));
    expect(stack.entries[0].presentation).toBe("push");
    const parent = nextStack(stack, visit("/app/sets/a", 0, { action: "REPLACE", back: true }));
    expect(paths(parent)).toEqual(["/app/sets/a"]);
    expect(leaving(parent)).toEqual(["/app/sets/a/words/w"]);
  });

  it("does not repeat a move the browser has drawn", () => {
    const stack = walk(visit("/app/library", 0), visit("/app/sets/a", 1));
    const swiped = nextStack(stack, { ...back("/app/library", 0), instant: true });
    expect(swiped.instant).toBe(true);
    expect(swiped.leaving).toEqual([]);
  });
});

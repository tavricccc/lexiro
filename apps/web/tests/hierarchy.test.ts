import { describe, expect, it } from "vitest";
import { screenKey } from "@/app/hierarchy";

describe("screenKey", () => {
  it("draws a word over its set and every other path on its own", () => {
    expect(screenKey("/app/sets/a/words/w")).toBe("/app/sets/a");
    expect(screenKey("/app/sets/a/words/w/edit")).toBe("/app/sets/a/words/w/edit");
    expect(screenKey("/app/progress")).toBe("/app/progress");
  });
});

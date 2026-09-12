import { describe, expect, it } from "vitest";
import { encode } from "gpt-tokenizer";
import { prepareGeneration, upstreamRequest } from "../src/generation";
import { QUESTION_KINDS } from "@lexiro/ai-contract";

describe("private generation prompts", () => {
  it.each(["words", ...QUESTION_KINDS] as const)("keeps %s instructions stable across different sources", async (kind) => {
    const prepared = await Promise.all(["apple", "river"].map((word) => prepareGeneration({ kind, tier: "lite", session: crypto.randomUUID(), ...(kind === "words" ? { raw: word } : { sources: [{ ref: "s1", word, pos: "n.", meaningZh: "測試" }], difficulty: 2 }) }, word)));
    expect(prepared[0].instructions).toBe(prepared[1].instructions);
    expect(prepared[0].input).not.toBe(prepared[1].input);
    expect(encode(prepared[0].instructions).length).toBeGreaterThanOrEqual(1024);
    expect(prepared[0].cacheKey).toBe(prepared[1].cacheKey);
    expect(upstreamRequest(prepared[0]).reasoning).toEqual({ effort: "low" });
  });
});

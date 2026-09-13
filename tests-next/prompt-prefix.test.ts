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

  // Supplementing is a rare press. Sharing the word prefix byte for byte is
  // what keeps it warm, so a change that splits the two has to fail here.
  it("sends supplementing on the word prefix and the word cache key", async () => {
    const session = crypto.randomUUID();
    const words = await prepareGeneration(
      { kind: "words", tier: "lite", session, raw: "bank n. 銀行" },
      "uid",
    );
    const supplement = await prepareGeneration(
      {
        kind: "senses",
        tier: "lite",
        session,
        limit: 2,
        sources: [{ ref: "s1", word: "bank", pos: "n.", meaningZh: "銀行" }],
      },
      "uid",
    );
    expect(supplement.instructions).toBe(words.instructions);
    expect(supplement.cacheKey).toBe(words.cacheKey);
    expect(supplement.input).not.toBe(words.input);
    expect(supplement.input).toContain("銀行");
    expect(supplement.input).toContain("2");
  });

  it("charges supplementing by the word, however many meanings it already has", async () => {
    const prepared = await prepareGeneration(
      {
        kind: "senses",
        tier: "lite",
        session: crypto.randomUUID(),
        limit: 3,
        sources: [
          { ref: "s1", word: "bank", pos: "n.", meaningZh: "銀行" },
          { ref: "s2", word: "bank", pos: "n.", meaningZh: "河岸" },
          { ref: "s3", word: "current", pos: "adj.", meaningZh: "目前的" },
        ],
      },
      "uid",
    );
    expect(prepared.units).toHaveLength(2);
    expect(prepared.halfRate).toBe(2);
  });
});

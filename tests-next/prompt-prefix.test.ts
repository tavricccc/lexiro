import { describe, expect, it } from "vitest";
import { encode } from "gpt-tokenizer";
import { REASONING, prepareGeneration, upstreamRequest } from "../src/generation";
import { QUESTION_KINDS, AI_MODELS, TIERS, generationModel } from "@lexiro/ai-contract";
import { QUESTION_CACHE_KEY, TASK_RULES } from "../src/question-prompts";
import { prepareQuestionReview, QUESTION_REVIEW_CACHE_KEY, QUESTION_REVIEW_RULES } from "../src/question-review";

describe("private generation prompts", () => {
  it.each(AI_MODELS)("routes %s for every reasoning tier and keeps model-specific charge identities", async (model) => {
    for (const tier of TIERS) {
      const prepared = await prepareGeneration({ kind: "words", raw: "bank n. 銀行", model, tier, session: "00000000-0000-4000-8000-000000000001" }, "uid");
      expect(upstreamRequest(prepared)).toMatchObject({ model: generationModel(model, tier), reasoning: { effort: REASONING[tier] } });
      const other = await prepareGeneration({ ...prepared.request, model: model === "gpt-6-luna" ? "gpt-5.6-luna" : "gpt-6-luna" }, "uid");
      if (tier === "pro") expect(prepared.units[0].id).toBe(other.units[0].id);
      else expect(prepared.units[0].id).not.toBe(other.units[0].id);
    }
  });
  it("uses low effort for Pro's Sol model", () => {
    expect(REASONING).toEqual({
      lite: "low",
      thinking: "medium",
      pro: "low",
    });
  });
  it.each(["words", ...QUESTION_KINDS] as const)(
    "keeps %s instructions stable across different sources",
    async (kind) => {
      const prepared = await Promise.all(
        ["apple", "river"].map((word) =>
          prepareGeneration(
            {
              kind,
              model: "gpt-6-luna", tier: "lite",
              session: crypto.randomUUID(),
              ...(kind === "words"
                ? { raw: word }
                : {
                    sources: [
                      { ref: "s1", word, pos: "n.", meaningZh: "測試" },
                    ],
                    difficulty: 2,
                  }),
            },
            word,
          ),
        ),
      );
      expect(prepared[0].instructions).toBe(prepared[1].instructions);
      expect(prepared[0].input).not.toBe(prepared[1].input);
      expect(encode(prepared[0].instructions).length).toBeGreaterThanOrEqual(
        1024,
      );
      expect(prepared[0].cacheKey).toBe(prepared[1].cacheKey);
      const upstream = upstreamRequest(prepared[0]);
      expect(upstream.service_tier).toBe("default");
      expect(upstream.reasoning).toEqual({ effort: "low" });
      expect(upstream.prompt_cache_options).toEqual({
        mode: "explicit",
        ttl: "30m",
      });
      expect(upstream.input[0]).toEqual({
        role: "developer",
        content: [
          {
            type: "input_text",
            text: prepared[0].cachePrefix ?? prepared[0].instructions,
            prompt_cache_breakpoint: { mode: "explicit" },
          },
        ],
      });
    },
  );

  it("shares one cacheable question core across formats and difficulties", async () => {
    const prepared = await Promise.all(
      (["vocabulary", "reading"] as const).flatMap((kind) =>
        ([1, 3] as const).map((difficulty) =>
          prepareGeneration(
            {
              kind,
              model: "gpt-6-luna", tier: "lite",
              session: crypto.randomUUID(),
              sources: [
                { ref: "s1", word: "bank", pos: "n.", meaningZh: "銀行" },
              ],
              difficulty,
            },
            "uid",
          ),
        ),
      ),
    );
    expect(encode(TASK_RULES).length).toBeGreaterThanOrEqual(1024);
    expect(new Set(prepared.map((entry) => entry.cachePrefix))).toEqual(
      new Set([TASK_RULES]),
    );
    expect(new Set(prepared.map((entry) => entry.cacheKey))).toEqual(
      new Set([QUESTION_CACHE_KEY]),
    );
    expect(new Set(prepared.map((entry) => entry.instructions)).size).toBe(4);
  });

  it("keeps the review prefix, schema and settings stable before variable difficulty and draft data", async () => {
    const requests = await Promise.all(([1, 3] as const).map(async (difficulty) => {
      const prepared = await prepareGeneration({
        kind: "vocabulary", model: "gpt-6-luna", tier: difficulty === 1 ? "lite" : "thinking",
        session: crypto.randomUUID(), difficulty,
        sources: [{ ref: `source-${difficulty}`, word: difficulty === 1 ? "river" : "bank", pos: "n.", meaningZh: difficulty === 1 ? "河流" : "銀行" }],
      }, `user-${difficulty}`);
      return upstreamRequest(prepareQuestionReview(prepared, { items: [{ sentence: `draft-${difficulty}` }] }));
    }));
    expect(encode(QUESTION_REVIEW_RULES).length).toBeGreaterThanOrEqual(1024);
    expect(requests[0].input[0]).toEqual(requests[1].input[0]);
    expect(requests[0].input[0]).toEqual({ role: "developer", content: [{
      type: "input_text", text: QUESTION_REVIEW_RULES, prompt_cache_breakpoint: { mode: "explicit" },
    }] });
    expect(requests[0].input[1]).not.toEqual(requests[1].input[1]);
    expect(requests[0].text).toEqual(requests[1].text);
    for (const request of requests) {
      expect(request.input).toHaveLength(2);
      expect(request).toMatchObject({ model: "gpt-6-luna", reasoning: { effort: "medium" },
        prompt_cache_key: QUESTION_REVIEW_CACHE_KEY, prompt_cache_options: { mode: "explicit", ttl: "30m" } });
      expect(request).not.toHaveProperty("previous_response_id");
    }
  });

  // Supplementing is a rare press. Sharing the word prefix byte for byte is
  // what keeps it warm, so a change that splits the two has to fail here.
  it("sends supplementing on the word prefix and the word cache key", async () => {
    const session = crypto.randomUUID();
    const words = await prepareGeneration(
      { kind: "words", model: "gpt-6-luna", tier: "lite", session, raw: "bank n. 銀行" },
      "uid",
    );
    const supplement = await prepareGeneration(
      {
        kind: "senses",
        model: "gpt-6-luna", tier: "lite",
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
        model: "gpt-6-luna", tier: "lite",
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

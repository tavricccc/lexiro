import { describe, expect, it } from "vitest";
import { prepareGeneration } from "../src/generation";

const sources = [
  { ref: "s1", word: "recover", pos: "v.", meaningZh: "恢復健康" },
  { ref: "s2", word: "cloud", pos: "n.", meaningZh: "雲" },
];
const items = [
  { ref: "s2", usage: "A cloud covered the hill", answer: "cloud" },
  { ref: "s1", usage: "Lina began to recover", answer: "recover" },
];
const request = () => ({
  kind: "wordBank" as const, model: "gpt-5.6-luna" as const, tier: "thinking" as const,
  difficulty: 3 as const, session: crypto.randomUUID(), sources,
  itemRepair: { index: 0, passage: "A cloud covered the hill. Lina began to recover after treatment.", items },
});

describe("WordBank item repair source binding", () => {
  it("takes the target source from the raw item's ref rather than the source index", async () => {
    const value = request();
    const prepared = await prepareGeneration(value, "u");
    expect(JSON.parse(prepared.input)).toMatchObject({ index: 0, targetRef: "s2", sources, items });
    expect(prepared.request.itemRepair?.index).toBe(0);
    expect(prepared.units).toHaveLength(1);
  });

  it("rejects missing, malformed, unknown or nonexistent raw target refs", async () => {
    for (const item of [{}, { ref: "s0" }, { ref: "source-2" }, { ref: "s99" }]) {
      const value = request();
      await expect(prepareGeneration({ ...value, itemRepair: { ...value.itemRepair, items: [item] } }, "u"))
        .rejects.toMatchObject({ status: 400, code: "invalid_input", field: "wordBank.ref" });
    }
    const value = request();
    await expect(prepareGeneration({ ...value, itemRepair: { ...value.itemRepair, index: 2 } }, "u"))
      .rejects.toMatchObject({ status: 400, code: "invalid_input", field: "wordBank.ref" });
  });

  it("keeps cloze repair free of the WordBank-only ref contract", async () => {
    const value = request();
    const { ref: _ref, ...item } = value.itemRepair.items[0];
    const prepared = await prepareGeneration({ ...value, kind: "cloze", itemRepair: { ...value.itemRepair, items: [item] } }, "u");
    expect(JSON.parse(prepared.input)).not.toHaveProperty("targetRef");
    expect(prepared.units).toHaveLength(1);
  });
});

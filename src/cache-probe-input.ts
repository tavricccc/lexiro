import type { AiModel, Tier } from "@lexiro/ai-contract";
import { prepareGeneration, upstreamRequest } from "./generation";
export { responseCost } from "@lexiro/ai-contract";
export async function cacheProbeInput(model: AiModel, tier: Tier, word: string, streamId: string) {
  const prepared = await prepareGeneration({ kind: "vocabulary", model, tier, session: crypto.randomUUID(), difficulty: 2, sources: [{ ref: "s1", word, pos: "v.", meaningZh: word === "recover" ? "恢復" : word === "detect" ? "察覺" : "適應" }] }, "cache-probe");
  return { ...upstreamRequest(prepared, undefined, true, streamId), max_output_tokens: 128 };
}

import type { WordGenerationSource } from "./word-generation";
import prompts, { fillPrompt, JSON_ONLY } from "./prompts";
import { buildWordGenerationSources } from "./word-generation";

export function buildImportPrompt(
  rawInput: string,
  sources: WordGenerationSource[] = buildWordGenerationSources(rawInput),
  generateExamples = false,
): string {
  const promptSources = sources.map(({ sourceRef, word, posHint, hint }) => ({
    ref: sourceRef,
    word,
    ...(posHint ? { posHint } : {}),
    ...(hint ? { hint } : {}),
  }));
  const outputExample = generateExamples
    ? JSON.stringify({
        items: [
          {
            pos: "v.",
            meaningZh: "適應",
            example: "We adapt quickly.",
          },
        ],
      })
    : JSON.stringify({
        items: [{ pos: "v.", meaningZh: "適應" }],
      });
  return fillPrompt(prompts.generateWordSet, {
    "{{EXAMPLE_FIELD}}": generateExamples ? "、example" : "",
    "{{EXAMPLES_RULE}}": generateExamples
      ? "example 是一個自然、簡短、只示範該詞義的英文句子。"
      : "不要輸出例句欄位；程式會填入空陣列。",
    "{{OUTPUT_EXAMPLE}}": outputExample,
    "{{JSON_ONLY}}": JSON_ONLY,
    "{{SOURCES}}": JSON.stringify(promptSources),
  });
}

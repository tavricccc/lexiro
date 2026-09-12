import type { EditorSenseDraft, WordDraft } from "@/types";
import {
  mergeUniqueStrings,
  normalizePartOfSpeech,
  normalizeWordKey,
} from "./library";
import { assertKnownKeys } from "./schema";
import { containsHan } from "./validation";
import { extractJsonText } from "./ai/json";

export { buildWordGenerationSources } from "@lexiro/ai-contract";
import type { WordGenerationSource } from "@lexiro/ai-contract";
import { LIMITS } from "@lexiro/ai-contract";
export type { WordGenerationSource } from "@lexiro/ai-contract";

export function parseOrganizedWordInput(text: string): string[] {
  const data = JSON.parse(text);
  if (
    !data ||
    typeof data !== "object" ||
    !Array.isArray(data.lines) ||
    data.lines.some(
      (line: unknown) =>
        typeof line !== "string" || !line.trim() || line.length > LIMITS.source,
    )
  )
    throw new Error("整理結果格式錯誤");
  assertKnownKeys(data, ["lines"], "整理結果");
  if (data.lines.join("\n").length > LIMITS.input)
    throw new Error("整理結果超過輸入上限");
  return data.lines;
}

function parseJson(text: string): unknown {
  return JSON.parse(extractJsonText(text)) as unknown;
}

function requireText(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`${field} 不可為空`);
  return value.trim();
}

function normalizeGeneratedSense(
  value: unknown,
  wordIndex: number,
  senseIndex: number,
  posHint?: string,
): EditorSenseDraft {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`第 ${wordIndex + 1} 筆格式錯誤`);
  const source = value as Record<string, unknown>;
  assertKnownKeys(
    source,
    ["pos", "meaningZh", "example"],
    `items[${wordIndex}]`,
  );
  const pos =
    source.pos === null && posHint
      ? posHint
      : normalizePartOfSpeech(
          requireText(source.pos, `items[${wordIndex}].pos`),
        );
  const meaning = requireText(
    source.meaningZh,
    `items[${wordIndex}].meaningZh`,
  );
  if (!pos) throw new Error(`第 ${wordIndex + 1} 筆詞性不受支援`);
  if (!containsHan(meaning))
    throw new Error(`第 ${wordIndex + 1} 筆 meaningZh 必須包含繁體中文`);
  const examples = [requireText(source.example, `items[${wordIndex}].example`)];
  if (examples.some((example) => containsHan(example)))
    throw new Error(`第 ${wordIndex + 1} 筆例句必須使用英文`);
  return {
    id: `sense-draft-${wordIndex + 1}-${senseIndex + 1}`,
    pos,
    meaning,
    examples,
  };
}

export function mergeWordDrafts(drafts: WordDraft[]): WordDraft[] {
  const grouped = new Map<string, WordDraft>();
  for (const draft of drafts) {
    const wordKey = normalizeWordKey(draft.word);
    const existing = grouped.get(wordKey);
    if (!existing) {
      grouped.set(wordKey, {
        word: draft.word.trim(),
        senses: draft.senses.map((sense) => ({
          ...sense,
          examples: [...sense.examples],
        })),
      });
      continue;
    }
    for (const sense of draft.senses) {
      const senseKey = `${normalizePartOfSpeech(sense.pos)}\u0000${sense.meaning.trim()}`;
      const current = existing.senses.find(
        (item) =>
          `${normalizePartOfSpeech(item.pos)}\u0000${item.meaning.trim()}` ===
          senseKey,
      );
      if (current) {
        current.examples = mergeUniqueStrings(current.examples, sense.examples);
      } else {
        existing.senses.push({ ...sense, examples: [...sense.examples] });
      }
    }
  }
  return Array.from(grouped.values()).sort((first, second) =>
    normalizeWordKey(first.word).localeCompare(normalizeWordKey(second.word)),
  );
}

export function parseWordGenerationJson(
  text: string,
  sources: WordGenerationSource[],
): WordDraft[] {
  let data: unknown;
  try {
    data = parseJson(text);
  } catch {
    throw new Error("JSON 格式錯誤");
  }
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("JSON 必須是 object");
  const source = data as Record<string, unknown>;
  assertKnownKeys(source, ["items"], "AI 單字資料");
  if (!Array.isArray(source.items) || !source.items.length)
    throw new Error("缺少有效的 items 陣列");
  if (source.items.length !== sources.length)
    throw new Error(`AI 回覆必須依序提供 ${sources.length} 筆`);

  const drafts = source.items.map((value, wordIndex): WordDraft => {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error(`第 ${wordIndex + 1} 個單字格式錯誤`);
    const item = value as Record<string, unknown>;
    assertKnownKeys(item, ["senses"], `items[${wordIndex}]`);
    const expected = sources[wordIndex];
    if (!expected) throw new Error(`第 ${wordIndex + 1} 筆沒有對應來源`);
    const word = expected.word;
    if (containsHan(word))
      throw new Error(`第 ${wordIndex + 1} 個單字必須使用英文`);
    const maximum =
      Math.max(
        1,
        expected.hint?.split(/與|或|並可指/).filter(Boolean).length ?? 0,
      ) + 1;
    if (
      !Array.isArray(item.senses) ||
      !item.senses.length ||
      item.senses.length > maximum
    )
      throw new Error(`第 ${wordIndex + 1} 個單字詞義數量不正確`);
    return {
      word,
      senses: item.senses.map((sense, index) =>
        normalizeGeneratedSense(sense, wordIndex, index, expected.posHint),
      ),
    };
  });
  return mergeWordDrafts(drafts);
}

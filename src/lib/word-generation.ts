import type { EditorSenseDraft, WordDraft } from "@/types";
import {
  mergeUniqueStrings,
  normalizePartOfSpeech,
  normalizeWordKey,
} from "./library";
import { assertKnownKeys } from "./schema";
import { createSourceRef } from "./source-ref";
import { containsHan } from "./validation";
import { extractJsonText } from "./ai-provider";

export interface WordGenerationSource {
  sourceRef: string;
  word: string;
  posHint?: string;
  hint?: string;
  raw: string;
}

const POS_HINTS: ReadonlyArray<[RegExp, string]> = [
  [/\b(?:phrasal\s+verb|phr\.?\s+v\.?)\b/iu, "phr. v."],
  [/\b(?:modal\s+verb|modal\s+v\.?)\b/iu, "modal v."],
  [/\b(?:adjective|adj\.?)\b/iu, "adj."],
  [/\b(?:adverb|adv\.?)\b/iu, "adv."],
  [/\b(?:pronoun|pron\.?)\b/iu, "pron."],
  [/\b(?:preposition|prep\.?)\b/iu, "prep."],
  [/\b(?:conjunction|conj\.?)\b/iu, "conj."],
  [/\b(?:interjection|interj\.?)\b/iu, "interj."],
  [/\b(?:determiner|det\.?)\b/iu, "det."],
  [/\b(?:auxiliary|aux\.?)\b/iu, "aux."],
  [/\b(?:noun|n\.?)\b/iu, "n."],
  [/\b(?:verb|v\.?)\b/iu, "v."],
  [/\b(?:phrase|phr\.?)\b/iu, "phr."],
  [/(?:片語動詞|動詞片語)/u, "phr. v."],
  [/(?:情態動詞)/u, "modal v."],
  [/(?:形容詞)/u, "adj."],
  [/(?:副詞)/u, "adv."],
  [/(?:代名詞|代詞)/u, "pron."],
  [/(?:介系詞|介詞)/u, "prep."],
  [/(?:連接詞|連詞)/u, "conj."],
  [/(?:感嘆詞)/u, "interj."],
  [/(?:限定詞)/u, "det."],
  [/(?:助動詞)/u, "aux."],
  [/(?:名詞)/u, "n."],
  [/(?:動詞)/u, "v."],
  [/(?:片語|詞組)/u, "phr."],
];

function extractSource(
  segment: string,
): Omit<WordGenerationSource, "sourceRef"> {
  const marker = POS_HINTS.map(([pattern, pos]) => {
    const match = pattern.exec(segment);
    return match?.index === undefined
      ? null
      : { index: match.index, pos, text: match[0] };
  })
    .filter((value): value is { index: number; pos: string; text: string } =>
      Boolean(value),
    )
    .sort((a, b) => a.index - b.index)[0];
  const wordRegion = marker ? segment.slice(0, marker.index) : segment;
  const match = wordRegion.match(
    /[A-Za-z][A-Za-z'’-]*(?:\s+[A-Za-z][A-Za-z'’-]*)*/u,
  );
  if (!match || match.index === undefined)
    return { word: "", raw: segment, hint: segment };

  const english = match[0].trim();
  const tokens = english.split(/\s+/u);
  let word = english;
  let posHint = marker?.pos ?? "";
  for (const length of [2, 1]) {
    if (tokens.length <= length) continue;
    const candidate = tokens.slice(-length).join(" ");
    const normalized = normalizePartOfSpeech(candidate);
    if (normalized) {
      word = tokens.slice(0, -length).join(" ");
      posHint = normalized;
      break;
    }
  }
  const before = segment.slice(0, match.index);
  const afterWord = segment.slice(match.index + word.length);
  let hint = `${before}${afterWord}`.replace(/^[\s.:：—–-]+/u, "").trim();
  if (posHint)
    hint = hint
      .replace(marker?.text ?? "", "")
      .replace(
        /^(?:(?:phrasal|modal)\s+verb|noun|verb|adjective|adverb|pronoun|preposition|conjunction|interjection|determiner|auxiliary|phr(?:ase)?|modal\s+v|phr(?:\.?\s+)?v|n|v|adj|adv|pron|prep|conj|interj|det|aux)\.?\s*/iu,
        "",
      )
      .replace(
        /^(?:片語動詞|動詞片語|情態動詞|形容詞|副詞|代名詞|代詞|介系詞|介詞|連接詞|連詞|感嘆詞|限定詞|助動詞|名詞|動詞|片語|詞組)\s*/u,
        "",
      )
      .replace(/^[\s.:：—–-]+/u, "")
      .trim();
  return {
    word,
    raw: segment,
    ...(posHint ? { posHint } : {}),
    ...(hint ? { hint } : {}),
  };
}

export function buildWordGenerationSources(
  rawInput: string,
): WordGenerationSource[] {
  return rawInput
    .split(/[\r\n,，;；/／|、]+/u)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((raw, index) => ({
      sourceRef: createSourceRef(index),
      ...extractSource(raw),
    }))
    .filter((source) => Boolean(source.word));
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
  generateExamples: boolean,
  posHint?: string,
): EditorSenseDraft {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`第 ${wordIndex + 1} 筆格式錯誤`);
  const source = value as Record<string, unknown>;
  assertKnownKeys(
    source,
    generateExamples ? ["pos", "meaningZh", "example"] : ["pos", "meaningZh"],
    `items[${wordIndex}]`,
  );
  const pos =
    posHint ??
    normalizePartOfSpeech(requireText(source.pos, `items[${wordIndex}].pos`));
  const meaning = requireText(
    source.meaningZh,
    `items[${wordIndex}].meaningZh`,
  );
  if (!pos) throw new Error(`第 ${wordIndex + 1} 筆詞性不受支援`);
  if (!containsHan(meaning))
    throw new Error(`第 ${wordIndex + 1} 筆 meaningZh 必須包含繁體中文`);
  const examples = generateExamples
    ? [requireText(source.example, `items[${wordIndex}].example`)]
    : [];
  if (examples.some((example) => containsHan(example)))
    throw new Error(`第 ${wordIndex + 1} 筆例句必須使用英文`);
  return {
    id: `sense-draft-${wordIndex + 1}-1`,
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
    if (existing.senses.length > 3)
      throw new Error(`單字「${existing.word}」最多只能保留三個常見字義`);
  }
  return Array.from(grouped.values()).sort((first, second) =>
    normalizeWordKey(first.word).localeCompare(normalizeWordKey(second.word)),
  );
}

export function parseWordGenerationJson(
  text: string,
  sources: WordGenerationSource[],
  generateExamples: boolean,
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
    const expected = sources[wordIndex];
    if (!expected) throw new Error(`第 ${wordIndex + 1} 筆沒有對應來源`);
    const word = expected.word;
    if (containsHan(word))
      throw new Error(`第 ${wordIndex + 1} 個單字必須使用英文`);
    return {
      word,
      senses: [
        normalizeGeneratedSense(
          item,
          wordIndex,
          generateExamples,
          expected.posHint,
        ),
      ],
    };
  });
  return mergeWordDrafts(drafts);
}

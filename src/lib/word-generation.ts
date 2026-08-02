import type { EditorSenseDraft, WordDraft } from '@/types'
import { mergeUniqueStrings, normalizePartOfSpeech, normalizeWordKey } from './library'
import { assertKnownKeys } from './schema'
import { createSourceRef } from './source-ref'
import { containsHan } from './validation'

export interface WordGenerationSource {
  sourceRef: string
  word: string
  raw: string
}

function extractEnglishWord(segment: string): string {
  const match = segment.match(/[A-Za-z][A-Za-z'’-]*(?:\s+[A-Za-z][A-Za-z'’-]*)*/u)
  return match?.[0].trim() ?? ''
}

export function buildWordGenerationSources(rawInput: string): WordGenerationSource[] {
  return rawInput
    .split(/[\r\n,，;；/／|、]+/u)
    .map(segment => segment.trim())
    .filter(Boolean)
    .map((raw, index) => ({ sourceRef: createSourceRef(index), word: extractEnglishWord(raw), raw }))
    .filter(source => Boolean(source.word))
}

function parseJson(text: string): unknown {
  return JSON.parse(text.trim()) as unknown
}

function requireText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new Error(`${field} 不可為空`)
  return value.trim()
}

function normalizeGeneratedSense(value: unknown, wordIndex: number, senseIndex: number, generateExamples: boolean): EditorSenseDraft {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`第 ${wordIndex + 1} 個單字的第 ${senseIndex + 1} 個 sense 格式錯誤`)
  const source = value as Record<string, unknown>
  assertKnownKeys(source, ['pos', 'meaningZh', 'examples'], `words[${wordIndex}].senses[${senseIndex}]`)
  const pos = normalizePartOfSpeech(requireText(source.pos, `words[${wordIndex}].senses[${senseIndex}].pos`))
  const meaning = requireText(source.meaningZh, `words[${wordIndex}].senses[${senseIndex}].meaningZh`)
  if (!pos)
    throw new Error(`第 ${wordIndex + 1} 個單字的第 ${senseIndex + 1} 個 sense 詞性不受支援`)
  if (!containsHan(meaning))
    throw new Error(`第 ${wordIndex + 1} 個單字的第 ${senseIndex + 1} 個 sense meaningZh 必須包含繁體中文`)
  if (!Array.isArray(source.examples) || !source.examples.every(example => typeof example === 'string' && example.trim()))
    throw new Error(`第 ${wordIndex + 1} 個單字的第 ${senseIndex + 1} 個 sense examples 格式錯誤`)
  const examples = source.examples.map(example => (example as string).trim())
  if (generateExamples && examples.length !== 1)
    throw new Error(`第 ${wordIndex + 1} 個單字的第 ${senseIndex + 1} 個 sense 必須提供一個例句`)
  if (!generateExamples && examples.length)
    throw new Error(`第 ${wordIndex + 1} 個單字的第 ${senseIndex + 1} 個 sense 不應包含例句`)
  if (examples.some(example => containsHan(example)))
    throw new Error(`第 ${wordIndex + 1} 個單字的第 ${senseIndex + 1} 個例句必須使用英文`)
  return {
    id: `sense-draft-${wordIndex + 1}-${senseIndex + 1}`,
    pos,
    meaning,
    examples,
  }
}

export function mergeWordDrafts(drafts: WordDraft[]): WordDraft[] {
  const grouped = new Map<string, WordDraft>()
  for (const draft of drafts) {
    const wordKey = normalizeWordKey(draft.word)
    const existing = grouped.get(wordKey)
    if (!existing) {
      grouped.set(wordKey, {
        word: draft.word.trim(),
        senses: draft.senses.map(sense => ({ ...sense, examples: [...sense.examples] })),
      })
      continue
    }
    for (const sense of draft.senses) {
      const senseKey = `${normalizePartOfSpeech(sense.pos)}\u0000${sense.meaning.trim()}`
      const current = existing.senses.find(item => `${normalizePartOfSpeech(item.pos)}\u0000${item.meaning.trim()}` === senseKey)
      if (current) {
        current.examples = mergeUniqueStrings(current.examples, sense.examples)
      }
      else {
        existing.senses.push({ ...sense, examples: [...sense.examples] })
      }
    }
    if (existing.senses.length > 3)
      throw new Error(`單字「${existing.word}」最多只能保留三個常見字義`)
  }
  return Array.from(grouped.values()).sort((first, second) => normalizeWordKey(first.word).localeCompare(normalizeWordKey(second.word)))
}

export function parseWordGenerationJson(text: string, sources: WordGenerationSource[], generateExamples: boolean): WordDraft[] {
  let data: unknown
  try {
    data = parseJson(text)
  }
  catch {
    throw new Error('JSON 格式錯誤')
  }
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new Error('JSON 必須是 object')
  const source = data as Record<string, unknown>
  assertKnownKeys(source, ['kind', 'words'], 'AI 單字資料')
  if (source.kind !== 'words' || !Array.isArray(source.words) || !source.words.length)
    throw new Error('缺少有效的 words 陣列')
  if (source.words.length !== sources.length)
    throw new Error(`AI 回覆必須逐一對應 ${sources.length} 個 sourceRef`)

  const sourcesByRef = new Map(sources.map(item => [item.sourceRef, item]))
  const usedRefs = new Set<string>()
  const drafts = source.words.map((value, wordIndex): WordDraft => {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error(`第 ${wordIndex + 1} 個單字格式錯誤`)
    const item = value as Record<string, unknown>
    assertKnownKeys(item, ['sourceRef', 'word', 'senses'], `words[${wordIndex}]`)
    const sourceRef = requireText(item.sourceRef, `words[${wordIndex}].sourceRef`)
    const expected = sourcesByRef.get(sourceRef)
    if (!expected)
      throw new Error(`第 ${wordIndex + 1} 個單字包含未知 sourceRef`)
    if (usedRefs.has(sourceRef))
      throw new Error(`sourceRef ${sourceRef} 不可重複`)
    usedRefs.add(sourceRef)
    const word = requireText(item.word, `words[${wordIndex}].word`)
    if (containsHan(word))
      throw new Error(`第 ${wordIndex + 1} 個單字必須使用英文`)
    if (normalizeWordKey(word) !== normalizeWordKey(expected.word))
      throw new Error(`第 ${wordIndex + 1} 個單字必須對應 sourceRef ${sourceRef}`)
    if (!Array.isArray(item.senses) || !item.senses.length || item.senses.length > 3)
      throw new Error(`第 ${wordIndex + 1} 個單字必須包含一至三個 senses`)
    return {
      word,
      senses: item.senses.map((sense, senseIndex) => normalizeGeneratedSense(sense, wordIndex, senseIndex, generateExamples)),
    }
  })
  if (usedRefs.size !== sourcesByRef.size)
    throw new Error('AI 回覆遺漏 sourceRef')
  return mergeWordDrafts(drafts)
}

import type { LibraryQuestion, VocabSet, VocabSetMember, WordEntry, WordSense } from '@/types'
import { stableHash } from './hash'

export function normalizeWordKey(word: string): string {
  return word.trim().toLocaleLowerCase().replace(/\s+/g, ' ')
}

export function buildSenseId(wordKey: string, pos: string, meaningZh: string): string {
  return `sense-${stableHash({ wordKey, pos: pos.trim().toLocaleLowerCase(), meaningZh: meaningZh.trim() })}`
}

export function buildQuestionId(question: Omit<LibraryQuestion, 'id' | 'createdAt' | 'updatedAt'>, sourceIndex = 0): string {
  return `question-${stableHash({ question, sourceIndex })}`
}

export function mergeUniqueStrings(first: string[] = [], second: string[] = []): string[] {
  const result: string[] = []
  const seen = new Set<string>()
  for (const value of [...first, ...second]) {
    const normalized = value.trim()
    if (!normalized)
      continue
    const key = normalized.toLocaleLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      result.push(normalized)
    }
  }
  return result
}

export function mergeSense(existing: WordSense | undefined, incoming: WordSense): WordSense {
  if (!existing)
    return incoming
  return {
    ...existing,
    definitionEn: existing.definitionEn || incoming.definitionEn,
    examples: mergeUniqueStrings(existing.examples, incoming.examples),
    source: existing.source === 'user' ? existing.source : incoming.source ?? existing.source,
    updatedAt: new Date().toISOString(),
  }
}

export function mergeWord(existing: WordEntry | undefined, incoming: WordEntry): WordEntry {
  if (!existing)
    return incoming
  const senses = [...existing.senses]
  for (const incomingSense of incoming.senses) {
    const index = senses.findIndex(sense => sense.id === incomingSense.id || (
      sense.pos.trim().toLocaleLowerCase() === incomingSense.pos.trim().toLocaleLowerCase()
      && sense.meaningZh.trim().toLocaleLowerCase() === incomingSense.meaningZh.trim().toLocaleLowerCase()
    ))
    if (index === -1)
      senses.push(incomingSense)
    else
      senses[index] = mergeSense(senses[index], incomingSense)
  }
  return {
    ...existing,
    word: existing.word || incoming.word,
    senses,
    phonetic: existing.phonetic || incoming.phonetic,
    audioUrl: existing.audioUrl || incoming.audioUrl,
    origin: existing.origin || incoming.origin,
    dictionarySource: existing.dictionarySource || incoming.dictionarySource,
    synonyms: mergeUniqueStrings(existing.synonyms, incoming.synonyms),
    antonyms: mergeUniqueStrings(existing.antonyms, incoming.antonyms),
    metadata: { ...existing.metadata, ...incoming.metadata },
    updatedAt: new Date().toISOString(),
  }
}

export function itemToWordEntry(item: VocabSet['items'][number]): WordEntry {
  const wordKey = normalizeWordKey(item.word)
  const pos = item.pos.trim()
  const meaningZh = item.meaning.trim()
  return {
    wordKey,
    word: item.word.trim(),
    senses: [{
      id: buildSenseId(wordKey, pos, meaningZh),
      pos,
      meaningZh,
      definitionEn: item.definition?.trim() || undefined,
      examples: item.example.trim() ? [item.example.trim()] : [],
      source: 'import',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }],
    phonetic: item.phonetic,
    audioUrl: item.audioUrl,
    origin: item.origin,
    dictionarySource: item.dictionarySource,
    synonyms: item.synonyms ?? [],
    antonyms: item.antonyms ?? [],
    updatedAt: new Date().toISOString(),
  }
}

export function itemToMembership(item: VocabSet['items'][number]): VocabSetMember {
  const wordKey = normalizeWordKey(item.word)
  return {
    wordKey,
    senseIds: [buildSenseId(wordKey, item.pos, item.meaning)],
    tags: item.tags ?? [],
    note: item.note,
    favorite: item.favorite,
  }
}

export function questionFromLegacyItem(item: VocabSet['items'][number]): LibraryQuestion | null {
  if (!item.question)
    return null
  const wordKey = normalizeWordKey(item.word)
  const senseId = buildSenseId(wordKey, item.pos, item.meaning)
  const now = new Date().toISOString()
  return {
    id: `legacy-question-${item.id}`,
    kind: 'multipleChoice',
    wordKey,
    senseId,
    prompt: item.question.prompt,
    options: item.question.opts,
    answerIndex: item.question.ans,
    source: 'import',
    sourceType: 'legacy',
    createdAt: now,
    updatedAt: now,
  }
}

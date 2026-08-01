import type { LibraryQuestion, ReadingChildQuestion, ReadingPack, VocabSet, VocabSetMember, WordEntry, WordSense } from '@/types'
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

export function canonicalizeQuestion(question: LibraryQuestion): LibraryQuestion {
  const { id: _id, createdAt: rawCreatedAt, updatedAt: rawUpdatedAt, ...rawContent } = question
  const now = new Date().toISOString()
  const createdAt = rawCreatedAt || now
  const updatedAt = rawUpdatedAt || createdAt

  if (question.kind === 'reading') {
    const questions = question.questions.map((child: ReadingChildQuestion) => {
      const { id: _childId, ...content } = child
      return { ...content, id: `child-${stableHash(content)}` }
    })
    const content = { ...rawContent, questions } as Omit<ReadingPack, 'id' | 'createdAt' | 'updatedAt'>
    return { ...content, id: buildQuestionId(content), createdAt, updatedAt }
  }

  const content = rawContent as Omit<LibraryQuestion, 'id' | 'createdAt' | 'updatedAt'>
  return { ...content, id: buildQuestionId(content), createdAt, updatedAt } as LibraryQuestion
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
  const nextDefinition = existing.definitionEn || incoming.definitionEn
  const nextExamples = mergeUniqueStrings(existing.examples, incoming.examples)
  const nextSource = existing.source === 'user' ? existing.source : incoming.source ?? existing.source
  const changed = nextDefinition !== existing.definitionEn
    || nextSource !== existing.source
    || stableHash(nextExamples) !== stableHash(existing.examples)
  if (!changed)
    return existing
  return {
    ...existing,
    definitionEn: nextDefinition,
    examples: nextExamples,
    source: nextSource,
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
  const next: WordEntry = {
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
  const comparableNext = { ...next, updatedAt: existing.updatedAt }
  if (stableHash(comparableNext) === stableHash(existing))
    return existing
  return next
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

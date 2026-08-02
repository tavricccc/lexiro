import type { EditorItem, LibraryQuestion, MultipleChoiceQuestion, ReadingPack, SetMembership, StudyWord, WordEntry, WordSense } from '@/types'
import { stableHash } from './hash'

const PART_OF_SPEECH_ALIASES: Record<string, string> = {
  'n': 'n.',
  'n.': 'n.',
  'noun': 'n.',
  'v': 'v.',
  'v.': 'v.',
  'verb': 'v.',
  'adj': 'adj.',
  'adj.': 'adj.',
  'adjective': 'adj.',
  'adv': 'adv.',
  'adv.': 'adv.',
  'adverb': 'adv.',
  'pron': 'pron.',
  'pron.': 'pron.',
  'pronoun': 'pron.',
  'prep': 'prep.',
  'prep.': 'prep.',
  'preposition': 'prep.',
  'conj': 'conj.',
  'conj.': 'conj.',
  'conjunction': 'conj.',
  'interj': 'interj.',
  'interj.': 'interj.',
  'interjection': 'interj.',
  'det': 'det.',
  'det.': 'det.',
  'determiner': 'det.',
  'aux': 'aux.',
  'aux.': 'aux.',
  'auxiliary': 'aux.',
  'modal v': 'modal v.',
  'modal v.': 'modal v.',
  'modal verb': 'modal v.',
  'phr v': 'phr. v.',
  'phr. v.': 'phr. v.',
  'phrasal verb': 'phr. v.',
  'phr': 'phr.',
  'phr.': 'phr.',
  'phrase': 'phr.',
}

export function normalizeWordKey(word: string): string {
  return word.trim().toLocaleLowerCase().replace(/\s+/g, ' ')
}

export function normalizePartOfSpeech(pos: string): string {
  const normalized = pos.trim().toLocaleLowerCase().replace(/\s+/g, ' ')
  return PART_OF_SPEECH_ALIASES[normalized] ?? ''
}

export function buildSenseId(wordKey: string, pos: string, meaningZh: string): string {
  return `sense-${stableHash({ wordKey: normalizeWordKey(wordKey), pos: normalizePartOfSpeech(pos) || pos.trim().toLocaleLowerCase(), meaningZh: meaningZh.trim() })}`
}

type QuestionContent = Omit<MultipleChoiceQuestion, 'id' | 'fingerprint' | 'createdAt' | 'updatedAt'> | Omit<ReadingPack, 'id' | 'fingerprint' | 'createdAt' | 'updatedAt'>

export function buildQuestionFingerprint(question: QuestionContent): string {
  const content = question.kind === 'reading'
    ? { ...question, questions: question.questions.map(({ id: _id, ...child }) => child) }
    : question
  return `fingerprint-${stableHash(content)}`
}

export function buildQuestionId(sourceId?: string): string {
  const normalized = sourceId?.trim()
  if (normalized)
    return normalized
  return `question-${crypto.randomUUID()}`
}

export function canonicalizeQuestion(question: LibraryQuestion): LibraryQuestion {
  const { id: rawId, fingerprint: _rawFingerprint, createdAt: rawCreatedAt, updatedAt: rawUpdatedAt, ...rawContent } = question
  const now = new Date().toISOString()
  const createdAt = rawCreatedAt || now
  const updatedAt = rawUpdatedAt || createdAt
  const content = rawContent as QuestionContent
  return {
    ...content,
    id: buildQuestionId(rawId),
    fingerprint: buildQuestionFingerprint(content),
    createdAt,
    updatedAt,
  } as LibraryQuestion
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
  const nextExamples = mergeUniqueStrings(existing.examples, incoming.examples)
  const changed = stableHash(nextExamples) !== stableHash(existing.examples)
  if (!changed)
    return existing
  return {
    ...existing,
    examples: nextExamples,
  }
}

export function mergeWord(existing: WordEntry | undefined, incoming: WordEntry): WordEntry {
  if (!existing)
    return incoming
  const senses = [...existing.senses]
  for (const incomingSense of incoming.senses) {
    const index = senses.findIndex(sense => sense.id === incomingSense.id || (
      normalizePartOfSpeech(sense.pos) === normalizePartOfSpeech(incomingSense.pos)
      && sense.meaningZh.trim() === incomingSense.meaningZh.trim()
    ))
    if (index === -1)
      senses.push(incomingSense)
    else
      senses[index] = mergeSense(senses[index], incomingSense)
  }
  const next: WordEntry = {
    ...existing,
    word: existing.word,
    senses,
    updatedAt: new Date().toISOString(),
  }
  const comparableNext = { ...next, updatedAt: existing.updatedAt }
  if (stableHash(comparableNext) === stableHash(existing))
    return existing
  return next
}

export function itemToWordEntry(item: Pick<EditorItem, 'word' | 'senses'>): WordEntry {
  const wordKey = normalizeWordKey(item.word)
  const senses = item.senses
    .map((sense) => {
      const pos = normalizePartOfSpeech(sense.pos)
      const meaningZh = sense.meaning.trim()
      if (!pos || !meaningZh)
        return null
      return {
        id: buildSenseId(wordKey, pos, meaningZh),
        pos,
        meaningZh,
        examples: mergeUniqueStrings(sense.examples),
      }
    })
    .filter((sense): sense is WordSense => Boolean(sense))
  if (!wordKey || !senses.length)
    throw new Error('每個單字至少需要一個有效詞義；詞性請使用標準縮寫或英文全名')
  return {
    wordKey,
    word: item.word.trim(),
    senses,
    updatedAt: new Date().toISOString(),
  }
}

export function itemToMembership(item: Pick<EditorItem, 'word' | 'senses'>): SetMembership {
  const wordKey = normalizeWordKey(item.word)
  return {
    wordKey,
    senseIds: item.senses
      .map(sense => normalizePartOfSpeech(sense.pos) && sense.meaning.trim() ? buildSenseId(wordKey, sense.pos, sense.meaning) : '')
      .filter(Boolean),
  }
}

export function senseToStudyWord(word: WordEntry, sense: WordSense): StudyWord {
  return {
    id: sense.id,
    wordKey: word.wordKey,
    word: word.word,
    pos: sense.pos,
    meaning: sense.meaningZh,
    examples: [...sense.examples],
    example: sense.examples[0] ?? '',
  }
}

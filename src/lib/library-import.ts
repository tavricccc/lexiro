import type { ClozeQuestion, LibraryDataSource, LibraryQuestion, MultipleChoiceQuestion, ReadingChildQuestion, ReadingPack, WordEntry, WordSense } from '@/types'
import { stableHash } from './hash'
import { buildQuestionId, buildSenseId, normalizeWordKey } from './library'

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function childQuestionId(question: Omit<ReadingChildQuestion, 'id'>): string {
  return `child-${stableHash(question)}`
}

function questionId(question: Omit<LibraryQuestion, 'id' | 'createdAt' | 'updatedAt'>): string {
  return buildQuestionId(question)
}

function normalizeSense(value: unknown, wordKey: string, index: number): WordSense {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const pos = text(source.pos)
  const meaningZh = text(source.meaningZh ?? source.zh ?? source.meaning)
  if (!pos || !meaningZh)
    throw new Error(`第 ${index + 1} 個詞義缺少詞性或中文義`)
  const examples = Array.isArray(source.examples)
    ? source.examples.map(text).filter(Boolean)
    : [text(source.example)].filter(Boolean)
  return {
    id: text(source.id) || buildSenseId(wordKey, pos, meaningZh),
    pos,
    meaningZh,
    definitionEn: text(source.definitionEn ?? source.definition) || undefined,
    examples,
    source: source.source === 'user' || source.source === 'dictionary' || source.source === 'ai' || source.source === 'import' ? source.source : 'import',
    createdAt: text(source.createdAt) || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function normalizeWord(value: unknown, index: number): WordEntry {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`第 ${index + 1} 個單字格式錯誤`)
  const source = value as Record<string, unknown>
  const word = text(source.word)
  const wordKey = normalizeWordKey(text(source.wordKey) || word)
  if (!wordKey)
    throw new Error(`第 ${index + 1} 個單字缺少 word`)
  const rawSenses = Array.isArray(source.senses) ? source.senses : [{ pos: source.pos, meaningZh: source.meaningZh ?? source.zh ?? source.meaning, examples: source.examples ?? [source.example], definitionEn: source.definitionEn ?? source.definition }]
  const senses = rawSenses.map((sense, senseIndex) => normalizeSense(sense, wordKey, senseIndex))
  return {
    wordKey,
    word: word || wordKey,
    senses,
    phonetic: text(source.phonetic) || undefined,
    audioUrl: text(source.audioUrl) || undefined,
    origin: text(source.origin) || undefined,
    dictionarySource: text(source.dictionarySource) || undefined,
    synonyms: Array.isArray(source.synonyms) ? source.synonyms.map(text).filter(Boolean) : [],
    antonyms: Array.isArray(source.antonyms) ? source.antonyms.map(text).filter(Boolean) : [],
    metadata: source.metadata && typeof source.metadata === 'object' ? source.metadata as Record<string, unknown> : undefined,
    updatedAt: new Date().toISOString(),
  }
}

function normalizeQuestion(value: unknown, index: number): LibraryQuestion {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`第 ${index + 1} 題格式錯誤`)
  const source = value as Record<string, unknown>
  const now = new Date().toISOString()
  const createdAt = text(source.createdAt) || now
  const base = {
    wordKey: text(source.wordKey) ? normalizeWordKey(text(source.wordKey)) : undefined,
    senseId: text(source.senseId) || undefined,
    source: (source.source === 'ai' || source.source === 'user' || source.source === 'dictionary' || source.source === 'import' ? source.source : 'import') as LibraryDataSource,
    sourceType: text(source.sourceType) || undefined,
  }
  if (source.kind === 'reading') {
    const rawQuestions = Array.isArray(source.questions)
      ? source.questions.map((item) => {
          const child = item as Record<string, unknown>
          const normalized: Omit<ReadingChildQuestion, 'id'> = {
            kind: child.kind === 'cloze' ? 'cloze' : 'multipleChoice',
            prompt: text(child.prompt),
            options: Array.isArray(child.options) ? child.options.map(text).filter(Boolean) : undefined,
            answerIndex: Number.isInteger(child.answerIndex) ? child.answerIndex as number : undefined,
            answers: Array.isArray(child.answers) ? child.answers.map(text).filter(Boolean) : undefined,
            wordKey: text(child.wordKey) ? normalizeWordKey(text(child.wordKey)) : undefined,
            senseId: text(child.senseId) || undefined,
          }
          return { ...normalized, id: childQuestionId(normalized) }
        })
      : []
    if (!text(source.title) || !text(source.passage) || !rawQuestions.length)
      throw new Error(`第 ${index + 1} 題閱讀資料不完整`)
    const wordKeys = Array.isArray(source.wordKeys) ? source.wordKeys.map(value => normalizeWordKey(text(value))).filter(Boolean) : []
    const content: Omit<ReadingPack, 'id' | 'createdAt' | 'updatedAt'> = {
      ...base,
      kind: 'reading',
      title: text(source.title),
      passage: text(source.passage),
      wordKeys,
      questions: rawQuestions,
    }
    return { ...content, id: questionId(content), createdAt, updatedAt: now }
  }
  if (source.kind === 'cloze') {
    const answers = Array.isArray(source.answers) ? source.answers.map(text).filter(Boolean) : []
    if (!text(source.prompt) || !answers.length)
      throw new Error(`第 ${index + 1} 題填空資料不完整`)
    const content: Omit<ClozeQuestion, 'id' | 'createdAt' | 'updatedAt'> = {
      ...base,
      kind: 'cloze',
      prompt: text(source.prompt),
      answers,
      options: Array.isArray(source.options) ? source.options.map(text).filter(Boolean) : undefined,
    }
    return { ...content, id: questionId(content), createdAt, updatedAt: now }
  }
  const options = Array.isArray(source.options) ? source.options.map(text).filter(Boolean) : []
  const answerIndex = Number(source.answerIndex)
  if (!text(source.prompt) || options.length !== 4 || !Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= options.length)
    throw new Error(`第 ${index + 1} 題選擇題資料不完整`)
  const content: Omit<MultipleChoiceQuestion, 'id' | 'createdAt' | 'updatedAt'> = {
    ...base,
    kind: 'multipleChoice',
    questionStyle: source.questionStyle === 'fillBlank' || text(source.prompt).includes('_____') ? 'fillBlank' : 'standard',
    prompt: text(source.prompt),
    options,
    answerIndex,
    trap: text(source.trap) || undefined,
    whyWrong: source.whyWrong && typeof source.whyWrong === 'object' ? source.whyWrong as Record<string, string> : undefined,
  }
  return { ...content, id: questionId(content), createdAt, updatedAt: now }
}

export type LibraryImportPayload = { kind: 'vocab', words: WordEntry[] } | { kind: 'questions', questions: LibraryQuestion[] }

export function parseLibraryImport(textValue: string): { valid: true, data: LibraryImportPayload } | { valid: false, error: string } {
  try {
    const parsed = JSON.parse(textValue.replace(/^```(?:json)?\s*/i, '').replace(/\n?```\s*$/, '').trim()) as Record<string, unknown>
    if (parsed.kind === 'vocab' || Array.isArray(parsed.words)) {
      const rawWords = Array.isArray(parsed.words) ? parsed.words : []
      return { valid: true, data: { kind: 'vocab', words: rawWords.map(normalizeWord) } }
    }
    if (parsed.kind === 'questions' || Array.isArray(parsed.questions)) {
      const rawQuestions = Array.isArray(parsed.questions) ? parsed.questions : []
      return { valid: true, data: { kind: 'questions', questions: rawQuestions.map(normalizeQuestion) } }
    }
    return { valid: false, error: '找不到 vocab words 或 questions' }
  }
  catch (error) {
    return { valid: false, error: (error as Error).message || 'JSON 格式錯誤' }
  }
}

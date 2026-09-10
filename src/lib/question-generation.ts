import type { QuestionSourceRefs } from './library-import'
import type { GeneratedQuestionKind, LibraryQuestion, QuestionDifficulty, WordEntry } from '@/types'
import { normalizeWordKey } from './library'
import { questionUsesWords } from './question-ownership'
import { createSourceRef } from './source-ref'
import { extractJsonText } from './ai-provider'
import { assembleGeneratedQuestions } from './question-assembly'
import { buildQuestionPrompt } from './question-prompts'
import { isPassageKind, READING_MIN_QUESTIONS, sensesPerRequest } from './question-formats'

export type { GeneratedQuestionKind }
export type GeneratedQuestionDifficulty = QuestionDifficulty

export function generationSenseKey(wordKey: string, senseId: string): string {
  return `${normalizeWordKey(wordKey)}::${senseId}`
}

export function getSelectedGenerationWords(words: WordEntry[], selectedSenseKeys: string[]): WordEntry[] {
  const selected = new Set(selectedSenseKeys)
  return words
    .map(word => ({
      ...word,
      senses: word.senses.filter(sense => selected.has(generationSenseKey(word.wordKey, sense.id))),
    }))
    .filter(word => word.senses.length > 0)
}

export function getQuestionSourceRefs(words: WordEntry[]): QuestionSourceRefs {
  return Object.fromEntries(words.flatMap((word, wordIndex) => [
    [createSourceRef(wordIndex), { wordKey: word.wordKey, senseId: word.senses[0].id }],
    ...word.senses.map((sense, senseIndex) => [
      createSourceRef(wordIndex, senseIndex),
      { wordKey: word.wordKey, senseId: sense.id },
    ]),
  ]))
}

/**
 * Senses per AI request. This is the size of one batch, not a limit on what the
 * user may select: anything larger is split across several requests. Each
 * format absorbs a different amount — a 文意選填 passage wants eight words, a
 * 篇章結構 passage only needs four — so the size comes from the format table.
 */
export function questionBatchSize(kind: GeneratedQuestionKind): number {
  return sensesPerRequest(kind)
}

export function splitGenerationBatches(words: WordEntry[], kind: GeneratedQuestionKind): WordEntry[][] {
  const size = questionBatchSize(kind)

  if (isPassageKind(kind)) {
    // One passage per batch: a passage cannot be split across requests.
    const packs: WordEntry[][] = []
    for (let index = 0; index < words.length; index += size)
      packs.push(words.slice(index, index + size))
    return packs
  }

  const batches: WordEntry[][] = []
  let batch: WordEntry[] = []
  let senseCount = 0
  for (const word of words) {
    const wordSenseCount = word.senses.length
    if (batch.length && senseCount + wordSenseCount > size) {
      batches.push(batch)
      batch = []
      senseCount = 0
    }
    if (wordSenseCount > size) {
      for (let index = 0; index < word.senses.length; index += size) {
        const senses = word.senses.slice(index, index + size)
        if (batch.length) {
          batches.push(batch)
          batch = []
          senseCount = 0
        }
        batches.push([{ ...word, senses }])
      }
      continue
    }
    batch.push(word)
    senseCount += wordSenseCount
  }
  if (batch.length)
    batches.push(batch)
  return batches
}

export function filterQuestionsForWords(questions: LibraryQuestion[], words: WordEntry[]): LibraryQuestion[] {
  const allowedWords: Record<string, WordEntry> = Object.fromEntries(words.map(word => [normalizeWordKey(word.wordKey), word]))
  return questions.filter(question => questionUsesWords(question, allowedWords))
}

export function buildQuestionGenerationPrompt(
  words: WordEntry[],
  kind: GeneratedQuestionKind,
  difficulty: GeneratedQuestionDifficulty = 2,
  options: { needDistractors?: boolean } = {},
): string {
  return buildQuestionPrompt(kind, words, difficulty, options).text
}

/**
 * Parses the model's reply and assembles finished questions from it.
 *
 * `pool` is the learner's whole library: when the answer is a plain base form,
 * the distractors are taken from their own words of the same part of speech
 * rather than from the model, which is both how a 段考 paper is written and one
 * fewer thing for the model to get wrong.
 */
export function normalizeQuestionGenerationJson(
  responseText: string,
  kind: GeneratedQuestionKind,
  difficulty: GeneratedQuestionDifficulty,
  words: WordEntry[],
  pool: WordEntry[] = words,
): string {
  let value: unknown
  try {
    value = JSON.parse(extractJsonText(responseText)) as unknown
  }
  catch {
    throw new Error('AI 題目回覆不是有效 JSON')
  }
  return JSON.stringify(assembleGeneratedQuestions(value, kind, difficulty, words, pool).payload)
}

export function generatedQuestionCoverageIssue(questions: LibraryQuestion[], words: WordEntry[], kind: GeneratedQuestionKind): string | null {
  if (isPassageKind(kind)) {
    if (questions.length !== 1 || questions[0]?.kind !== 'reading')
      return '這個題型每批只能產生一個題組'
    const pack = questions[0]
    if (pack.format !== kind)
      return '題組的格式與所選題型不符'
    if (kind === 'reading' && pack.questions.length < READING_MIN_QUESTIONS)
      return `閱讀測驗至少要有 ${READING_MIN_QUESTIONS} 個子題`
    const expectedSenseKeys = new Set(words.flatMap(word => word.senses.map(sense => generationSenseKey(word.wordKey, sense.id))))
    const actualSenseKeys = pack.questions.map(question => generationSenseKey(question.wordKey, question.senseId))
    if (actualSenseKeys.some(key => !expectedSenseKeys.has(key)))
      return '子題必須對應本批輸入的詞義'
    return null
  }

  const expectedSenseKeys = new Set(words.flatMap(word => word.senses.map(sense => generationSenseKey(word.wordKey, sense.id))))
  const actualSenseKeys = questions.flatMap(question => question.kind === 'reading' ? [] : [generationSenseKey(question.wordKey, question.senseId)])
  if (new Set(actualSenseKeys).size !== actualSenseKeys.length || actualSenseKeys.some(key => !expectedSenseKeys.has(key)))
    return '每個詞義最多只能生成一題'
  return null
}

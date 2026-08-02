import type { QuestionSourceRefs } from './library-import'
import type { LibraryQuestion, QuestionDifficulty, WordEntry } from '@/types'
import { normalizeWordKey } from './library'
import { questionUsesWords } from './question-ownership'
import { createSourceRef } from './source-ref'

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

export type GeneratedQuestionKind = 'multipleChoice' | 'fillBlank' | 'reading'
export type GeneratedQuestionDifficulty = QuestionDifficulty
export const QUESTION_BATCH_SIZE = 15

export function getGenerationWords(words: WordEntry[], kind: GeneratedQuestionKind): WordEntry[] {
  return kind === 'reading' ? words.slice(0, QUESTION_BATCH_SIZE) : words
}

export function splitGenerationBatches(words: WordEntry[], kind: GeneratedQuestionKind): WordEntry[][] {
  const promptWords = getGenerationWords(words, kind)
  if (kind === 'reading')
    return promptWords.length ? [promptWords] : []

  const batches: WordEntry[][] = []
  let batch: WordEntry[] = []
  let senseCount = 0
  for (const word of promptWords) {
    const wordSenseCount = word.senses.length
    if (batch.length && senseCount + wordSenseCount > QUESTION_BATCH_SIZE) {
      batches.push(batch)
      batch = []
      senseCount = 0
    }
    if (wordSenseCount > QUESTION_BATCH_SIZE) {
      for (let index = 0; index < word.senses.length; index += QUESTION_BATCH_SIZE) {
        const senses = word.senses.slice(index, index + QUESTION_BATCH_SIZE)
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

export function buildQuestionGenerationPrompt(words: WordEntry[], kind: GeneratedQuestionKind, difficulty: GeneratedQuestionDifficulty = 2): string {
  const wordList = words.map((word, wordIndex) => ({
    sourceRef: createSourceRef(wordIndex),
    word: word.word,
    senses: word.senses.map((sense, senseIndex) => ({ sourceRef: createSourceRef(wordIndex, senseIndex), pos: sense.pos, meaningZh: sense.meaningZh, examples: sense.examples })),
  }))
  const difficultyInstruction = `每一題的 difficulty 必須是 ${difficulty}，不可使用其他難度。`
  const difficultyExample = difficulty
  const common = `你是英文教材編輯。只使用以下單字與詞義，不要自行新增單字。題幹、文章、標題與所有選項都必須是自然英文，不得包含中文。輸出只能是 JSON object，不要 Markdown。題型為 ${kind}。${difficultyInstruction}\n\n單字資料：\n${JSON.stringify(wordList, null, 2)}`
  if (kind === 'reading') {
    return `${common}\n\n請產生一篇自然、適合學習的短文與 3 到 5 個閱讀問題。格式：{"kind":"questions","questions":[{"kind":"reading","difficulty":${difficultyExample},"title":"標題","passage":"文章","wordKeys":["source-1"],"questions":[{"kind":"multipleChoice","sourceRef":"source-1-1","prompt":"問題","options":["","","",""],"answerIndex":0}]}]}。每個 wordKeys 和子題都必須原樣帶回輸入的 sourceRef；不要輸出正式 id。每批只產生一個 reading pack，問題必須能由文章判斷。`
  }
  if (kind === 'fillBlank') {
    return `${common}\n\n每個 sense 產生一題「四選一填空」，共 ${words.reduce((count, word) => count + word.senses.length, 0)} 個 sense 的題目。格式：{"kind":"questions","questions":[{"kind":"multipleChoice","sourceRef":"source-1-1","questionStyle":"fillBlank","difficulty":${difficultyExample},"prompt":"包含 _____ 的自然英文句子","options":["正確單字","錯誤選項1","錯誤選項2","錯誤選項3"],"answerIndex":0}]}。sourceRef 必須原樣帶回輸入資料；不要輸出正式 id。options 必須剛好 4 個，prompt 必須包含 _____，answerIndex 必須指向唯一正確答案。`
  }
  return `${common}\n\n每個 sense 產生一題四選一，共 ${words.reduce((count, word) => count + word.senses.length, 0)} 個 sense 的題目。格式：{"kind":"questions","questions":[{"kind":"multipleChoice","sourceRef":"source-1-1","questionStyle":"standard","difficulty":${difficultyExample},"prompt":"英文問題或句子","options":["選項1","選項2","選項3","選項4"],"answerIndex":0}]}。sourceRef 必須原樣帶回輸入資料；不要輸出正式 id。options 必須剛好 4 個，answerIndex 必須指向唯一正確答案。`
}

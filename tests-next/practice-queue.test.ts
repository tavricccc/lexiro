import type { CardProgress, LibraryQuestion, SenseId, StudyWord, WordKey } from '@/types'
import { describe, expect, it } from 'vitest'

import { buildQuestionGroups } from '@/components/practice/practice-content'
import { buildPracticeQueue, countTaskAvailability } from '@/components/practice/practice-queue'

function word(index: number): StudyWord {
  const id = `sense-${index}` as SenseId
  return {
    id,
    wordKey: `word-${index}` as WordKey,
    word: `word${index}`,
    pos: 'n.',
    meaning: `意思 ${index}`,
    examples: [],
    example: '',
  }
}

/** Scheduled long ago, so `isDue` is true whenever the test runs. */
function dueCard(): CardProgress {
  return {
    due: '2020-01-01T00:00:00.000Z',
    stability: 1,
    difficulty: 5,
    elapsedDays: 1,
    scheduledDays: 1,
    learningSteps: 0,
    reps: 1,
    lapses: 0,
    state: 2,
    lastReview: '2020-01-01T00:00:00.000Z',
    reviewCount: 1,
    correctCount: 1,
  }
}

function vocabularyQuestion(index: number): LibraryQuestion {
  return {
    kind: 'multipleChoice',
    id: `q-${index}`,
    fingerprint: `fp-${index}`,
    wordKey: `word-${index}` as WordKey,
    senseId: `sense-${index}` as SenseId,
    questionStyle: 'vocabulary',
    difficulty: 2,
    prompt: `prompt ${index}`,
    options: ['a', 'b', 'c', 'd'],
    answerIndex: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function readingQuestion(senseIndexes: number[]): LibraryQuestion {
  return {
    kind: 'reading',
    id: 'r-1',
    fingerprint: 'fp-r-1',
    wordKeys: senseIndexes.map((index) => `word-${index}` as WordKey),
    title: '一篇文章',
    format: 'reading',
    difficulty: 2,
    passage: 'passage',
    questions: senseIndexes.map((index) => ({
      id: `c-${index}`,
      kind: 'multipleChoice' as const,
      wordKey: `word-${index}` as WordKey,
      senseId: `sense-${index}` as SenseId,
      prompt: `child ${index}`,
      options: ['a', 'b', 'c', 'd'],
      answerIndex: 1,
    })),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

const studyItems = [1, 2, 3, 4].map(word)
const cards = Object.fromEntries(
  studyItems.map((item) => [item.id, dueCard()]),
) as Record<SenseId, CardProgress>
const allowedSenseIds = new Set(studyItems.map((item) => item.id))

const base = {
  allowedSenseIds,
  cards,
  difficulty: 'all' as const,
  leechOnly: false,
  questionGroups: [],
  studyItems,
}

describe('practice queue', () => {
  it('asks each scheduled word once when both card styles are mixed', () => {
    const queue = buildPracticeQueue({ ...base, amount: 4, tasks: ['flashcard', 'spelling'] })
    expect(queue).toHaveLength(4)
    const senses = queue.map((entry) => (entry.kind === 'card' ? entry.word.id : ''))
    expect(new Set(senses).size).toBe(4)
    expect(new Set(queue.map((entry) => entry.task))).toEqual(
      new Set(['flashcard', 'spelling']),
    )
  })

  it('stops at the requested length', () => {
    const queue = buildPracticeQueue({ ...base, amount: 2, tasks: ['flashcard'] })
    expect(queue).toHaveLength(2)
  })

  it('keeps the items of one passage together', () => {
    const questionGroups = buildQuestionGroups(
      [readingQuestion([1, 2, 3]), vocabularyQuestion(4)],
      {},
    )
    const queue = buildPracticeQueue({
      ...base,
      amount: 10,
      questionGroups,
      tasks: ['vocabulary', 'reading'],
    })
    const positions = queue.flatMap((entry, index) =>
      entry.kind === 'question' && entry.task === 'reading' ? [index] : [],
    )
    expect(positions).toHaveLength(3)
    expect(positions[2] - positions[0]).toBe(2)
  })

  it('counts what each task could contribute on its own', () => {
    const counts = countTaskAvailability({
      ...base,
      questionGroups: buildQuestionGroups([vocabularyQuestion(1)], {}),
    })
    expect(counts.flashcard).toBe(4)
    expect(counts.spelling).toBe(4)
    expect(counts.vocabulary).toBe(1)
    expect(counts.reading).toBe(0)
  })

  it('does not ask the same sense as a card and again as a question', () => {
    const queue = buildPracticeQueue({
      ...base,
      amount: 8,
      questionGroups: buildQuestionGroups([1, 2].map(vocabularyQuestion), {}),
      tasks: ['flashcard', 'vocabulary'],
    })
    const senses = queue.map((entry) =>
      entry.kind === 'card' ? entry.word.id : entry.item.senseId,
    )
    expect(new Set(senses).size).toBe(senses.length)
    expect(senses).toHaveLength(4)
  })
})

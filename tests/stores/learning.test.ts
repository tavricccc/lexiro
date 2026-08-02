import type { LibrarySet, WordEntry } from '@/types'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { LEARNING_STORAGE_KEY } from '@/constants'
import { reviewCard } from '@/lib/fsrs'
import { buildSenseId } from '@/lib/library'
import { loadFromStorage } from '@/lib/persist'
import { useLearningStore } from '@/stores/learning'
import { useLibraryStore } from '@/stores/library'
import { seedSet } from '../helpers/library'

function makeWord(id: string): WordEntry {
  const meaningZh = `${id} meaning`
  const senseId = buildSenseId(id, 'n.', meaningZh)
  return {
    wordKey: id,
    word: id,
    senses: [{ id: senseId, pos: 'n.', meaningZh, examples: [`${id} example`] }],
    updatedAt: '',
  }
}

const set: LibrarySet = {
  id: 'daily-set',
  setName: 'Daily',
  folderId: '__uncategorized__',
  createdAt: '',
  updatedAt: '',
}
const words = Array.from({ length: 6 }, (_, index) => makeWord(`word-${index + 1}`))

function seedLibrarySets(entries: Array<{ set: LibrarySet, words: WordEntry[] }>) {
  const libraryStore = useLibraryStore()
  for (const entry of entries) {
    seedSet(libraryStore, entry.set)
    libraryStore.importWords(entry.words)
    libraryStore.replaceSetMemberships(entry.set.id, entry.words.map(word => ({
      wordKey: word.wordKey,
      senseIds: word.senses.map(sense => sense.id),
    })))
  }
}

describe('global sense learning', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('keeps new cards out of the due count but includes them in the daily queue', () => {
    const learningStore = useLearningStore()
    seedLibrarySets([{ set, words }])
    learningStore.progress.cards[words[0].senses[0].id] = reviewCard(null, 'good', new Date(Date.now() - 86400000))

    expect(learningStore.getDueCount(set.id)).toBe(1)
    expect(learningStore.getAvailableReviewCount(set.id)).toBe(6)

    const queue = learningStore.getDailyReviewEntries(3)
    expect(queue).toHaveLength(2)
    expect(queue[0].progress).not.toBeNull()
    expect(queue[1].progress).toBeNull()
  })

  it('fills the daily queue with new senses when no due sense exists', () => {
    const learningStore = useLearningStore()
    seedLibrarySets([{ set, words }])

    const queue = learningStore.getDailyReviewEntries(3)

    expect(queue).toHaveLength(3)
    expect(queue.every(entry => entry.progress === null)).toBe(true)
  })

  it('limits new senses to one third when due senses exist', () => {
    const learningStore = useLearningStore()
    seedLibrarySets([{ set, words }])
    learningStore.progress.cards[words[0].senses[0].id] = reviewCard(null, 'good', new Date(Date.now() - 86400000))

    const queue = learningStore.getDailyReviewEntries(5)

    expect(queue).toHaveLength(2)
    expect(queue.filter(entry => entry.progress === null)).toHaveLength(1)
  })

  it('supports only the configured daily word goal options and saves the change', async () => {
    const learningStore = useLearningStore()

    expect(learningStore.stats.dailyWordGoal).toBe(15)
    learningStore.setDailyWordGoal(25)
    expect(learningStore.stats.dailyWordGoal).toBe(25)
    const saved = await loadFromStorage(LEARNING_STORAGE_KEY)
    expect(saved.value).toContain('"dailyWordGoal":25')

    learningStore.setDailyWordGoal(10)
    expect(learningStore.stats.dailyWordGoal).toBe(15)
  })

  it('stores one card per sense even when daily review spans multiple sets', async () => {
    const firstSet = { ...set, id: 'first-set', setName: 'Daily first' }
    const secondSet = { ...set, id: 'second-set', setName: 'Daily second' }
    seedLibrarySets([
      { set: firstSet, words: [words[0]] },
      { set: secondSet, words: [words[1]] },
    ])
    const learningStore = useLearningStore()

    expect(learningStore.startDailyReview()).toBe(true)
    const firstEntry = learningStore.currentReviewEntry
    expect(firstEntry?.setId).toBe('first-set')
    learningStore.answerCurrent('good')
    expect(learningStore.stats.todayMemoryReviews).toBe(1)
    expect(learningStore.nextReview()).toBe(true)

    const secondEntry = learningStore.currentReviewEntry
    expect(secondEntry?.setId).toBe('second-set')
    learningStore.answerCurrent('again')
    expect(learningStore.stats.todayMemoryReviews).toBe(2)
    expect(learningStore.nextReview()).toBe(false)

    expect(learningStore.getCardProgress(words[0].senses[0].id)).toBeTruthy()
    expect(learningStore.getCardProgress(words[1].senses[0].id)).toBeTruthy()
    const stored = await loadFromStorage(LEARNING_STORAGE_KEY)
    const saved = JSON.parse(stored.value ?? '{}')
    expect(saved.stats.todayMemoryReviews).toBe(2)
    expect(Object.keys(saved.progress.cards)).toHaveLength(2)
  })

  it('updates one FSRS card once for a batch of questions about the same sense', () => {
    const learningStore = useLearningStore()
    const senseId = words[0].senses[0].id

    learningStore.recordQuestionResults([
      { senseId, questionId: 'q-1', questionType: 'standard', difficulty: 1, isCorrect: true, marked: false },
      { senseId, questionId: 'q-2', questionType: 'fillBlank', difficulty: 2, isCorrect: false, marked: false },
    ])

    expect(learningStore.getCardProgress(senseId)?.reviewCount).toBe(1)
    expect(learningStore.getCardProgress(senseId)?.correctCount).toBe(0)
  })

  it('lets a wrong question override the earlier daily FSRS result', () => {
    const firstSet = { ...set, id: 'daily-question-set' }
    seedLibrarySets([{ set: firstSet, words: [words[0]] }])
    const learningStore = useLearningStore()

    expect(learningStore.startDailyReview()).toBe(true)
    learningStore.answerCurrent('good')
    const afterMemory = learningStore.getCardProgress(words[0].senses[0].id)
    expect(afterMemory?.reviewCount).toBe(1)
    expect(afterMemory?.correctCount).toBe(1)

    learningStore.recordQuestionResults([
      { senseId: words[0].senses[0].id, questionId: 'q-1', questionType: 'standard', difficulty: 1, isCorrect: false, marked: false, daily: true },
    ])
    const afterQuestion = learningStore.getCardProgress(words[0].senses[0].id)
    expect(afterQuestion?.reviewCount).toBe(1)
    expect(afterQuestion?.correctCount).toBe(0)
  })

  it('does not reschedule a question sense twice on the same day', () => {
    const learningStore = useLearningStore()
    const senseId = words[0].senses[0].id
    const result = { senseId, questionId: 'q-1', questionType: 'reading' as const, difficulty: 3 as const, isCorrect: true, marked: false, daily: true }

    learningStore.recordQuestionResults([result])
    learningStore.recordQuestionResults([{ ...result, questionId: 'q-2', isCorrect: false }])

    expect(learningStore.getCardProgress(senseId)?.reviewCount).toBe(1)
    expect(learningStore.getCardProgress(senseId)?.correctCount).toBe(1)
  })

  it('marks later same-day question attempts as retry without rescheduling FSRS', () => {
    const learningStore = useLearningStore()
    const senseId = words[0].senses[0].id
    const result = { senseId, questionId: 'q-1', questionType: 'standard' as const, difficulty: 1 as const, isCorrect: true, marked: false }

    learningStore.recordQuestionResults([result])
    const firstCard = learningStore.getCardProgress(senseId)
    learningStore.recordQuestionResults([{ ...result, questionId: 'q-2', isCorrect: false }])

    expect(learningStore.getCardProgress(senseId)).toEqual(firstCard)
    expect(learningStore.stats.questionStats['standard:1'].retry).toBe(1)
    expect(learningStore.stats.questionStatsBySense[senseId]['standard:1'].retry).toBe(1)
  })

  it('adds the session completion bonus separately from question XP', () => {
    const learningStore = useLearningStore()
    const senseId = words[0].senses[0].id
    learningStore.recordQuestionResults([{ senseId, questionId: 'q-1', questionType: 'standard', difficulty: 1, isCorrect: true, marked: false }])
    const beforeCompletion = learningStore.stats.xp

    learningStore.completePracticeSession()

    expect(learningStore.stats.xp).toBe(beforeCompletion + 10)
    expect(learningStore.stats.dailyHistory[learningStore.stats.lastStudyDate]?.completed).toBe(true)
  })

  it('removes orphan cards and per-sense question stats after the last membership is removed', async () => {
    const libraryStore = useLibraryStore()
    const learningStore = useLearningStore()
    await learningStore.loadState()
    seedLibrarySets([{ set, words: [words[0]] }])
    const senseId = words[0].senses[0].id

    learningStore.recordQuestionResults([{ senseId, questionId: 'q-orphan', questionType: 'standard', difficulty: 1, isCorrect: true, marked: false }])
    expect(learningStore.getCardProgress(senseId)).not.toBeNull()
    expect(learningStore.stats.questionStatsBySense[senseId]).toBeDefined()

    expect(libraryStore.removeSenseFromSet(set.id, words[0].wordKey, senseId)).toBe(true)
    expect(libraryStore.getWord(words[0].wordKey)).toBeNull()
    expect(learningStore.getCardProgress(senseId)).toBeNull()
    expect(learningStore.stats.questionStatsBySense[senseId]).toBeUndefined()
  })

  it('moves per-sense learning records when a sense identity changes', async () => {
    const libraryStore = useLibraryStore()
    const learningStore = useLearningStore()
    await learningStore.loadState()
    seedLibrarySets([{ set, words: [words[0]] }])
    const oldSenseId = words[0].senses[0].id
    learningStore.recordQuestionResults([{ senseId: oldSenseId, questionId: 'q-rename', questionType: 'standard', difficulty: 1, isCorrect: true, marked: false }])

    const nextSense = libraryStore.updateSense(words[0].wordKey, oldSenseId, { meaningZh: 'renamed meaning' })
    expect(nextSense).not.toBeNull()
    expect(nextSense?.id).not.toBe(oldSenseId)
    expect(learningStore.getCardProgress(oldSenseId)).toBeNull()
    expect(learningStore.getCardProgress(nextSense!.id)).not.toBeNull()
    expect(learningStore.stats.questionStatsBySense[oldSenseId]).toBeUndefined()
    expect(learningStore.stats.questionStatsBySense[nextSense!.id]).toBeDefined()
  })
})

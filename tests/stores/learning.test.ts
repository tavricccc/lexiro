import type { VocabItem, VocabSet } from '@/types'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LEARNING_STORAGE_KEY } from '@/constants'
import { reviewCard } from '@/lib/fsrs'
import { useLearningStore } from '@/stores/learning'
import { useSetsStore } from '@/stores/sets'

const storage = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
}

function makeItem(id: string): VocabItem {
  return {
    id,
    word: id,
    pos: 'n.',
    meaning: `${id} meaning`,
    example: `${id} example`,
  }
}

const set: VocabSet = {
  id: 'daily-set',
  setName: 'Daily',
  difficulty: 2,
  items: Array.from({ length: 6 }, (_, index) => makeItem(`word-${index + 1}`)),
}

describe('learning daily queue', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', storage)
    storage.getItem.mockClear()
    storage.setItem.mockClear()
    setActivePinia(createPinia())
    useSetsStore().sets = [set]
  })

  it('keeps new cards out of the due count but includes them in the daily queue', () => {
    const learningStore = useLearningStore()
    const progress = learningStore.getSetProgress(set.id)
    progress.cards['word-1'] = reviewCard(null, 'good', new Date(Date.now() - 86400000))

    expect(learningStore.getDueCount(set)).toBe(1)
    expect(learningStore.getAvailableReviewCount(set)).toBe(6)

    const queue = learningStore.getDailyReviewEntries(3)
    expect(queue).toHaveLength(3)
    expect(queue[0].progress).not.toBeNull()
    expect(queue[1].progress).toBeNull()
  })

  it('supports only the configured daily goal options and saves the change locally', () => {
    const learningStore = useLearningStore()

    expect(learningStore.stats.dailyGoal).toBe(15)
    learningStore.setDailyGoal(25)
    expect(learningStore.stats.dailyGoal).toBe(25)
    expect(storage.setItem).toHaveBeenCalled()

    learningStore.setDailyGoal(10)
    expect(learningStore.stats.dailyGoal).toBe(15)
  })

  it('persists daily progress for every queued card and keeps cards in their own set', () => {
    const firstSet = { ...set, id: 'first-set', items: [set.items[0]] }
    const secondSet = { ...set, id: 'second-set', items: [set.items[1]] }
    useSetsStore().sets = [firstSet, secondSet]
    const learningStore = useLearningStore()

    expect(learningStore.startDailyReview()).toBe(true)
    const firstEntry = learningStore.currentReviewEntry
    expect(firstEntry?.setId).toBe('first-set')
    learningStore.answerCurrent('good')
    expect(learningStore.stats.todayLearningReviews).toBe(1)
    expect(learningStore.nextReview()).toBe(true)

    const secondEntry = learningStore.currentReviewEntry
    expect(secondEntry?.setId).toBe('second-set')
    learningStore.answerCurrent('hard')
    expect(learningStore.stats.todayLearningReviews).toBe(2)
    expect(learningStore.nextReview()).toBe(false)

    expect(learningStore.peekSetProgress('first-set')?.cards[firstSet.items[0].id]).toBeTruthy()
    expect(learningStore.peekSetProgress('second-set')?.cards[secondSet.items[0].id]).toBeTruthy()
    const saved = JSON.parse(storage.setItem.mock.calls.at(-1)?.[1] ?? '{}')
    expect(saved.stats.todayLearningReviews).toBe(2)
    expect(storage.setItem.mock.calls.at(-1)?.[0]).toBe(LEARNING_STORAGE_KEY)
  })
})

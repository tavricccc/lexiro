import type { VocabItem, VocabSet } from '@/types'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
    question: {
      prompt: `What is ${id}?`,
      opts: [id, 'other-a', 'other-b', 'other-c'],
      ans: 0,
    },
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
})

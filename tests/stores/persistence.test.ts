import type { PracticeSession, VocabSet } from '@/types'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SESSION_STORAGE_KEY, SETS_STORAGE_KEY } from '@/constants'
import { useLibraryStore } from '@/stores/library'
import { makeSessionKey, useSessionStore } from '@/stores/session'
import { useSetsStore } from '@/stores/sets'

const routerPush = vi.hoisted(() => vi.fn())

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: routerPush,
    currentRoute: { value: { name: 'home', params: {} } },
  }),
}))

class MemoryStorage implements Storage {
  private store = new Map<string, string>()

  get length(): number {
    return this.store.size
  }

  clear(): void {
    this.store.clear()
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
}

const validSet: VocabSet = {
  id: 'set-1',
  setName: 'Fruits',
  difficulty: 2,
  items: [
    {
      id: 'item-1',
      word: 'apple',
      pos: 'n.',
      meaning: '蘋果',
      example: 'I eat an apple.',
    },
  ],
}

const validSession: PracticeSession = {
  sourceSetId: 'set-1',
  mode: 'quiz',
  entries: [{
    item: validSet.items[0],
    question: { prompt: '蘋果的英文是？', opts: ['apple', 'banana', 'cherry', 'date'], ans: 0 },
    originalIndex: 0,
  }],
  index: 0,
  correctCount: 0,
  wrongEntries: [],
  answers: [],
  drafts: [],
  markedForReview: [false],
  review: false,
  status: 'in-progress',
}

describe('store persistence', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: new MemoryStorage(),
      configurable: true,
    })
    Object.defineProperty(globalThis, 'window', {
      value: {
        clearTimeout,
        setTimeout,
        scrollTo: vi.fn(),
      },
      configurable: true,
    })
    routerPush.mockClear()
    setActivePinia(createPinia())
  })

  it('keeps sets and session saves in separate localStorage keys', () => {
    const setsStore = useSetsStore()
    const sessionStore = useSessionStore()

    setsStore.sets = [validSet]
    setsStore.activeSetId = validSet.id
    setsStore.saveState()

    const key = makeSessionKey(validSet.id, 'quiz')
    sessionStore.sessionsByKey = { [key]: validSession }
    sessionStore.activeKey = key
    sessionStore.currentView = 'quiz'
    sessionStore.practiceCounts = { [validSet.id]: 1 }
    sessionStore.saveState(true)

    const saved = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) ?? '{}')
    expect(JSON.parse(localStorage.getItem(SETS_STORAGE_KEY) ?? '{}').sets).toHaveLength(1)
    expect(saved.currentView).toBe('quiz')
    expect(saved.sessionsByKey[key].mode).toBe('quiz')
  })

  it('stores quiz progress in the session map', () => {
    const sessionStore = useSessionStore()
    const quizKey = makeSessionKey('set-1', 'quiz')

    sessionStore.sessionsByKey = {
      [quizKey]: { ...validSession, mode: 'quiz', index: 2 },
    }
    sessionStore.saveState(true)

    const saved = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) ?? '{}')
    expect(saved.sessionsByKey[quizKey].index).toBe(2)
    expect(saved.sessionsByKey[quizKey].mode).toBe('quiz')
  })

  it('marks quiz questions for review after the round', async () => {
    const setsStore = useSetsStore()
    setsStore.sets = [validSet]
    useLibraryStore().importQuestions([{
      id: 'question-apple',
      kind: 'multipleChoice',
      wordKey: 'apple',
      prompt: '蘋果的英文是？',
      options: ['apple', 'banana', 'cherry', 'date'],
      answerIndex: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }])
    const sessionStore = useSessionStore()

    await sessionStore.startRound('quiz', validSet.id)
    sessionStore.toggleReviewMark(0)
    sessionStore.handleQuizDraftChange(0, { selectedIndex: 0 })
    sessionStore.submitCurrentRound()

    expect(sessionStore.resultSummary?.markedCount).toBe(1)
    expect(sessionStore.currentSession?.markedForReview).toEqual([true])

    sessionStore.reviewMarkedQuestions()
    expect(sessionStore.currentSession?.review).toBe(true)
    expect(sessionStore.currentSession?.entries).toHaveLength(1)
    expect(sessionStore.currentSession?.entries[0].item.id).toBe(validSet.items[0].id)
  })

  it('persists imported sets through the shared ZIP import path', () => {
    const setsStore = useSetsStore()

    const result = setsStore.applyImported([validSet], 'overwrite')

    expect(result?.imported).toHaveLength(1)
    expect(JSON.parse(localStorage.getItem(SETS_STORAGE_KEY) ?? '{}').sets).toHaveLength(1)
  })
})

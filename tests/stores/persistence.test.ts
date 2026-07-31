import type { PracticeSession, VocabSet } from '@/types'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LEGACY_STORAGE_KEY, SESSION_STORAGE_KEY, SETS_STORAGE_KEY } from '@/constants'
import { makeSessionKey, useSessionStore } from '@/stores/session'
import { useSetsStore } from '@/stores/sets'

const idbMock = vi.hoisted(() => {
  const store = new Map<string, string>()
  return {
    store,
    get: vi.fn((key: string) => Promise.resolve(store.get(key))),
  }
})

const routerPush = vi.hoisted(() => vi.fn())

vi.mock('idb-keyval', () => ({
  get: idbMock.get,
}))

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
      question: {
        prompt: '蘋果的英文是？',
        opts: ['apple', 'banana', 'cherry', 'date'],
        ans: 0,
      },
    },
  ],
}

const validSession: PracticeSession = {
  sourceSetId: 'set-1',
  mode: 'quiz',
  entries: [{ item: validSet.items[0], originalIndex: 0 }],
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
    idbMock.store.clear()
    idbMock.get.mockClear()
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

  it('stores quiz and flashcard progress independently', () => {
    const sessionStore = useSessionStore()
    const quizKey = makeSessionKey('set-1', 'quiz')
    const cardKey = makeSessionKey('set-1', 'flashcard')

    sessionStore.sessionsByKey = {
      [quizKey]: { ...validSession, mode: 'quiz', index: 2 },
      [cardKey]: { ...validSession, mode: 'flashcard', index: 5 },
    }
    sessionStore.saveState(true)

    const saved = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) ?? '{}')
    expect(saved.sessionsByKey[quizKey].index).toBe(2)
    expect(saved.sessionsByKey[cardKey].index).toBe(5)
    expect(saved.sessionsByKey[quizKey].mode).toBe('quiz')
    expect(saved.sessionsByKey[cardKey].mode).toBe('flashcard')
  })

  it('marks quiz questions for review after the round', async () => {
    const setsStore = useSetsStore()
    setsStore.sets = [validSet]
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

  it('migrates legacy sets payload to the new sets key', async () => {
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify({
      sets: [validSet],
      activeSetId: validSet.id,
    }))

    const setsStore = useSetsStore()
    await setsStore.loadState()

    expect(setsStore.sets).toHaveLength(1)
    expect(setsStore.activeSetId).toBe(validSet.id)
    expect(JSON.parse(localStorage.getItem(SETS_STORAGE_KEY) ?? '{}').sets).toHaveLength(1)
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
  })

  it('migrates legacy session payload to the multi-session map', async () => {
    const setsStore = useSetsStore()
    setsStore.sets = [validSet]
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify({
      currentView: 'quiz',
      currentSession: validSession,
      flashcardIndex: 0,
      practiceCounts: { [validSet.id]: 1 },
    }))

    const sessionStore = useSessionStore()
    await sessionStore.loadState()

    const key = makeSessionKey(validSet.id, 'quiz')
    expect(sessionStore.currentView).toBe('quiz')
    expect(sessionStore.sessionsByKey[key]?.sourceSetId).toBe(validSet.id)
    expect(sessionStore.currentSession?.sourceSetId).toBe(validSet.id)
    expect(JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) ?? '{}').sessionsByKey[key]).toBeTruthy()
    expect(localStorage.getItem(SETS_STORAGE_KEY)).toBeNull()
  })

  it('does not create session data from a legacy sets-only payload', async () => {
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify({
      sets: [validSet],
      activeSetId: validSet.id,
    }))

    const sessionStore = useSessionStore()
    await sessionStore.loadState()

    expect(sessionStore.currentSession).toBeNull()
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
  })

  it('restores legacy IndexedDB sets payload into the new sets key', async () => {
    idbMock.store.set(LEGACY_STORAGE_KEY, JSON.stringify({
      sets: [validSet],
      activeSetId: validSet.id,
    }))

    const setsStore = useSetsStore()
    await setsStore.loadState()

    expect(setsStore.sets).toHaveLength(1)
    expect(JSON.parse(localStorage.getItem(SETS_STORAGE_KEY) ?? '{}').activeSetId).toBe(validSet.id)
  })

  it('persists imported sets through the shared ZIP import path', () => {
    const setsStore = useSetsStore()

    const result = setsStore.applyImported([validSet], 'overwrite')

    expect(result?.imported).toHaveLength(1)
    expect(JSON.parse(localStorage.getItem(SETS_STORAGE_KEY) ?? '{}').sets).toHaveLength(1)
  })
})

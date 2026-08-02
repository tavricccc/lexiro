import type { LibrarySet, PracticeSession, WordEntry } from '@/types'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LIBRARY_STORAGE_KEY, SESSION_STORAGE_KEY } from '@/constants'
import { buildSenseId } from '@/lib/library'
import { loadFromStorage } from '@/lib/persist'
import { useLibraryStore } from '@/stores/library'
import { makeSessionKey, useSessionStore } from '@/stores/session'
import { useSetsStore } from '@/stores/sets'
import { seedSet } from '../helpers/library'

const routerPush = vi.hoisted(() => vi.fn())

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: routerPush,
    currentRoute: { value: { name: 'home', params: {} } },
  }),
}))

const validSet: LibrarySet = {
  id: 'set-1',
  setName: 'Fruits',
  folderId: '__uncategorized__',
  createdAt: '',
  updatedAt: '',
}

const validWord: WordEntry = {
  wordKey: 'apple',
  word: 'apple',
  senses: [{
    id: buildSenseId('apple', 'n.', '蘋果'),
    pos: 'n.',
    meaningZh: '蘋果',
    examples: ['I eat an apple.'],
  }],
  updatedAt: '',
}

const validSession: PracticeSession = {
  sourceSetId: 'set-1',
  mode: 'quiz',
  entries: [{
    item: {
      id: 'sense-apple',
      wordKey: 'apple',
      word: 'apple',
      pos: 'n.',
      meaning: '蘋果',
      examples: ['I eat an apple.'],
      example: 'I eat an apple.',
    },
    question: { questionId: 'question-apple', questionType: 'standard', difficulty: 1, prompt: '蘋果的英文是？', options: ['apple', 'banana', 'cherry', 'date'], answerIndex: 0 },
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

  it('keeps sets and session saves in separate repository keys', async () => {
    const setsStore = useSetsStore()
    const sessionStore = useSessionStore()
    const libraryStore = useLibraryStore()

    seedSet(libraryStore, validSet)
    libraryStore.importWords([validWord])
    libraryStore.replaceSetMemberships(validSet.id, [{ wordKey: validWord.wordKey, senseIds: validWord.senses.map(sense => sense.id) }])
    setsStore.activeSetId = validSet.id

    const key = makeSessionKey(validSet.id, 'quiz')
    sessionStore.sessionsByKey = { [key]: validSession }
    sessionStore.activeKey = key
    sessionStore.currentView = 'quiz'
    sessionStore.saveState(true)

    const saved = JSON.parse((await loadFromStorage(SESSION_STORAGE_KEY)).value ?? '{}')
    expect(JSON.parse((await loadFromStorage(LIBRARY_STORAGE_KEY)).value ?? '{}').sets).toHaveLength(1)
    expect(saved.currentView).toBe('quiz')
    expect(saved.sessionsByKey[key].mode).toBe('quiz')
  })

  it('stores quiz progress in the session map', async () => {
    const sessionStore = useSessionStore()
    const quizKey = makeSessionKey('set-1', 'quiz')

    sessionStore.sessionsByKey = {
      [quizKey]: { ...validSession, mode: 'quiz', index: 2 },
    }
    sessionStore.saveState(true)

    const saved = JSON.parse((await loadFromStorage(SESSION_STORAGE_KEY)).value ?? '{}')
    expect(saved.sessionsByKey[quizKey].index).toBe(2)
    expect(saved.sessionsByKey[quizKey].mode).toBe('quiz')
  })

  it('marks quiz questions for review after the round', async () => {
    const libraryStore = useLibraryStore()
    seedSet(libraryStore, validSet)
    libraryStore.importWords([validWord])
    libraryStore.replaceSetMemberships(validSet.id, [{ wordKey: validWord.wordKey, senseIds: validWord.senses.map(sense => sense.id) }])
    libraryStore.importQuestions([{
      id: 'question-apple',
      fingerprint: 'fp-question-apple',
      kind: 'multipleChoice',
      questionStyle: 'standard',
      wordKey: 'apple',
      senseId: validWord.senses[0].id,
      difficulty: 1,
      prompt: 'Which fruit is apple?',
      options: ['apple', 'banana', 'cherry', 'date'],
      answerIndex: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }])
    const sessionStore = useSessionStore()

    await sessionStore.startRound('quiz', validSet.id)
    sessionStore.toggleReviewMark(0)
    sessionStore.handleQuizDraftChange(0, { selectedIndex: 0 })
    await sessionStore.submitCurrentRound()

    expect(sessionStore.resultSummary?.markedCount).toBe(1)
    expect(sessionStore.currentSession?.markedForReview).toEqual([true])

    sessionStore.reviewMarkedQuestions()
    expect(sessionStore.currentSession?.review).toBe(true)
    expect(sessionStore.currentSession?.entries).toHaveLength(1)
    expect(sessionStore.currentSession?.entries[0].item.id).toBe(validWord.senses[0].id)
  })

  it('persists imported library words through the canonical import path', async () => {
    const setsStore = useSetsStore()

    const result = setsStore.importLibraryWords([validWord], validSet.setName)

    expect(result?.setName).toBe(validSet.setName)
    expect(JSON.parse((await loadFromStorage(LIBRARY_STORAGE_KEY)).value ?? '{}').sets).toHaveLength(1)
  })
})

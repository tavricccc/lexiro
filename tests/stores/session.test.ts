import type { LibraryQuestion, LibrarySet, PracticeSession, StudyWord, WordEntry } from '@/types'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildSenseId } from '@/lib/library'
import { normalizeSession, toSessionEntries } from '@/lib/validation'
import { useLearningStore } from '@/stores/learning'
import { useLibraryStore } from '@/stores/library'
import { useSessionStore } from '@/stores/session'
import { useUIStore } from '@/stores/ui'
import { seedSet } from '../helpers/library'

const routerPush = vi.hoisted(() => vi.fn())

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: routerPush,
    currentRoute: { value: { name: 'home', params: {} } },
  }),
}))

const item: StudyWord = {
  id: 'sense-apple',
  wordKey: 'apple',
  word: 'apple',
  pos: 'n.',
  meaning: '蘋果',
  examples: ['I eat an apple.'],
  example: 'I eat an apple.',
}

const baseSession: PracticeSession = {
  sourceSetId: 'set-1',
  mode: 'quiz',
  entries: [{ item, originalIndex: 0 }],
  index: 0,
  correctCount: 0,
  wrongEntries: [],
  answers: [],
  drafts: [],
  markedForReview: [false],
  review: false,
  status: 'in-progress',
}

describe('session validation', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.defineProperty(globalThis, 'window', {
      value: { scrollTo: vi.fn() },
      configurable: true,
    })
  })

  it('converts canonical study words to session entries', () => {
    expect(toSessionEntries([item])).toEqual([{ item, originalIndex: 0 }])
    expect(toSessionEntries([])).toEqual([])
  })

  it('accepts only an active set and formal practice mode', () => {
    const validSetIds = new Set(['set-1'])
    expect(normalizeSession(baseSession, validSetIds)).not.toBeNull()
    expect(normalizeSession({ ...baseSession, sourceSetId: 'missing' }, validSetIds)).toBeNull()
    expect(normalizeSession({ ...baseSession, mode: 'invalid' }, validSetIds)).toBeNull()
  })

  it('keeps reading packs intact and resolves each child to its exact sense', async () => {
    const libraryStore = useLibraryStore()
    const sessionStore = useSessionStore()
    const uiStore = useUIStore()
    const set: LibrarySet = { id: 'reading-set', setName: 'Reading', folderId: '__uncategorized__', createdAt: '', updatedAt: '' }
    const nounId = buildSenseId('run', 'n.', '一連活動')
    const verbId = buildSenseId('run', 'v.', '經營')
    const jumpId = buildSenseId('jump', 'v.', '跳躍')
    const words: WordEntry[] = [
      { wordKey: 'run', word: 'run', senses: [{ id: nounId, pos: 'n.', meaningZh: '一連活動', examples: [] }, { id: verbId, pos: 'v.', meaningZh: '經營', examples: [] }], updatedAt: '' },
      { wordKey: 'jump', word: 'jump', senses: [{ id: jumpId, pos: 'v.', meaningZh: '跳躍', examples: [] }], updatedAt: '' },
    ]
    seedSet(libraryStore, set)
    libraryStore.importWords(words)
    libraryStore.replaceSetMemberships(set.id, words.map(word => ({ wordKey: word.wordKey, senseIds: word.senses.map(sense => sense.id) })))
    libraryStore.importQuestions([{
      id: 'reading-pack',
      fingerprint: 'reading-pack-fp',
      kind: 'reading',
      title: 'A day',
      passage: 'A short English passage.',
      wordKeys: ['run', 'jump'],
      difficulty: 2,
      createdAt: '',
      updatedAt: '',
      questions: [
        { id: 'child-noun', kind: 'multipleChoice', prompt: 'Which noun?', options: ['run', 'jump', 'walk', 'sit'], answerIndex: 0, wordKey: 'run', senseId: nounId },
        { id: 'child-verb', kind: 'multipleChoice', prompt: 'Which verb?', options: ['run', 'jump', 'walk', 'sit'], answerIndex: 0, wordKey: 'run', senseId: verbId },
        { id: 'child-jump', kind: 'multipleChoice', prompt: 'Which action?', options: ['run', 'jump', 'walk', 'sit'], answerIndex: 1, wordKey: 'jump', senseId: jumpId },
      ],
    }])
    uiStore.setQuestionCountPreference(1)

    await sessionStore.startRound('reading', set.id)

    expect(sessionStore.currentSession?.entries).toHaveLength(3)
    expect(sessionStore.currentSession?.entries.map(entry => entry.item.id)).toEqual([nounId, verbId, jumpId])
    expect(new Set(sessionStore.currentSession?.entries.map(entry => entry.readingPackId))).toEqual(new Set(['reading-pack']))
  })

  it('builds the automatic daily round with 40/40/20 quotas and atomic reading packs', async () => {
    const libraryStore = useLibraryStore()
    const learningStore = useLearningStore()
    const sessionStore = useSessionStore()
    const set: LibrarySet = { id: 'daily-set', setName: 'Daily', folderId: '__uncategorized__', createdAt: '', updatedAt: '' }
    const words: WordEntry[] = Array.from({ length: 10 }, (_, index) => {
      const wordKey = `daily-${index + 1}`
      const senseId = buildSenseId(wordKey, 'n.', `意思${index + 1}`)
      return { wordKey, word: wordKey, senses: [{ id: senseId, pos: 'n.', meaningZh: `意思${index + 1}`, examples: [] }], updatedAt: '' }
    })
    const standardQuestions: LibraryQuestion[] = words.slice(0, 4).map((word, index) => ({
      id: `daily-standard-${index + 1}`,
      fingerprint: `daily-standard-fp-${index + 1}`,
      kind: 'multipleChoice',
      questionStyle: 'standard',
      wordKey: word.wordKey,
      senseId: word.senses[0].id,
      difficulty: (index % 3 + 1) as 1 | 2 | 3,
      prompt: `Choose ${word.wordKey}.`,
      options: [word.wordKey, 'other-a', 'other-b', 'other-c'],
      answerIndex: 0,
      createdAt: '',
      updatedAt: '',
    }))
    const fillBlankQuestions: LibraryQuestion[] = words.slice(4, 8).map((word, index) => ({
      id: `daily-fill-${index + 1}`,
      fingerprint: `daily-fill-fp-${index + 1}`,
      kind: 'multipleChoice',
      questionStyle: 'fillBlank',
      wordKey: word.wordKey,
      senseId: word.senses[0].id,
      difficulty: (index % 3 + 1) as 1 | 2 | 3,
      prompt: `I _____ ${word.wordKey}.`,
      options: [word.wordKey, 'other-a', 'other-b', 'other-c'],
      answerIndex: 0,
      createdAt: '',
      updatedAt: '',
    }))
    const readingPack: LibraryQuestion = {
      id: 'daily-reading-pack',
      fingerprint: 'daily-reading-fp',
      kind: 'reading',
      title: 'A daily passage',
      passage: 'A short English passage for today.',
      wordKeys: words.slice(8).map(word => word.wordKey),
      difficulty: 2,
      createdAt: '',
      updatedAt: '',
      questions: words.slice(8).map((word, index) => ({
        id: `daily-reading-child-${index + 1}`,
        kind: 'multipleChoice',
        prompt: `Which word is ${word.wordKey}?`,
        options: [word.wordKey, 'other-a', 'other-b', 'other-c'],
        answerIndex: 0,
        wordKey: word.wordKey,
        senseId: word.senses[0].id,
      })),
    }

    seedSet(libraryStore, set)
    libraryStore.importWords(words)
    libraryStore.replaceSetMemberships(set.id, words.map(word => ({ wordKey: word.wordKey, senseIds: word.senses.map(sense => sense.id) })))
    libraryStore.importQuestions([...standardQuestions, ...fillBlankQuestions, readingPack])
    learningStore.setDailyQuestionGoal(10)

    await expect(sessionStore.startDailyQuestionRound()).resolves.toBe(true)

    const entries = sessionStore.currentSession?.entries ?? []
    expect(entries).toHaveLength(10)
    expect(entries.filter(entry => entry.question?.questionType === 'standard')).toHaveLength(4)
    expect(entries.filter(entry => entry.question?.questionType === 'fillBlank')).toHaveLength(4)
    const readingEntries = entries.filter(entry => entry.question?.questionType === 'reading')
    expect(readingEntries).toHaveLength(2)
    expect(new Set(readingEntries.map(entry => entry.readingPackId))).toEqual(new Set(['daily-reading-pack']))
    const readingIndexes = readingEntries.map(entry => entries.indexOf(entry)).sort((a, b) => a - b)
    expect(readingIndexes.at(-1)! - readingIndexes[0]).toBe(1)
  })

  it('keeps standard practice available counts and random difficulty balanced', async () => {
    const libraryStore = useLibraryStore()
    const sessionStore = useSessionStore()
    const uiStore = useUIStore()
    const set: LibrarySet = { id: 'quiz-set', setName: 'Quiz', folderId: '__uncategorized__', createdAt: '', updatedAt: '' }
    const words: WordEntry[] = Array.from({ length: 6 }, (_, index) => {
      const wordKey = `word-${index + 1}`
      const senseId = buildSenseId(wordKey, 'n.', `意思${index + 1}`)
      return { wordKey, word: wordKey, senses: [{ id: senseId, pos: 'n.', meaningZh: `意思${index + 1}`, examples: [] }], updatedAt: '' }
    })
    const questions: LibraryQuestion[] = words.map((word, index) => ({
      id: `standard-${index + 1}`,
      fingerprint: `standard-fp-${index + 1}`,
      kind: 'multipleChoice',
      questionStyle: 'standard',
      wordKey: word.wordKey,
      senseId: word.senses[0].id,
      difficulty: (index % 3 + 1) as 1 | 2 | 3,
      prompt: `Choose ${word.wordKey}.`,
      options: [word.wordKey, 'other-a', 'other-b', 'other-c'],
      answerIndex: 0,
      createdAt: '',
      updatedAt: '',
    }))
    seedSet(libraryStore, set)
    libraryStore.importWords(words)
    libraryStore.replaceSetMemberships(set.id, words.map(word => ({ wordKey: word.wordKey, senseIds: word.senses.map(sense => sense.id) })))
    libraryStore.importQuestions(questions)
    uiStore.setQuestionCountPreference(6)

    expect(sessionStore.getAvailablePracticeCount(set.id, 'quiz')).toBe(6)
    expect(sessionStore.getAvailablePracticeCount(set.id, 'quiz', 2)).toBe(2)
    await sessionStore.startRound('quiz', set.id)

    const entries = sessionStore.currentSession?.entries ?? []
    expect(entries).toHaveLength(6)
    expect(entries.map(entry => entry.question?.difficulty).sort()).toEqual([1, 1, 2, 2, 3, 3])
    expect(new Set(entries.map(entry => entry.item.id)).size).toBe(6)
    expect(new Set(entries.map(entry => entry.question?.questionId)).size).toBe(6)
  })

  it('uses another question for the same sense only after unique senses run out', async () => {
    const libraryStore = useLibraryStore()
    const sessionStore = useSessionStore()
    const uiStore = useUIStore()
    const set: LibrarySet = { id: 'duplicate-sense-set', setName: 'Duplicate sense', folderId: '__uncategorized__', createdAt: '', updatedAt: '' }
    const words: WordEntry[] = ['alpha', 'beta'].map((wordKey) => {
      const senseId = buildSenseId(wordKey, 'n.', `${wordKey} meaning`)
      return { wordKey, word: wordKey, senses: [{ id: senseId, pos: 'n.', meaningZh: `${wordKey} meaning`, examples: [] }], updatedAt: '' }
    })
    const questions: LibraryQuestion[] = [
      ...['a-1', 'a-2'].map(id => ({ id, fingerprint: `${id}-fp`, kind: 'multipleChoice' as const, questionStyle: 'standard' as const, wordKey: 'alpha', senseId: words[0].senses[0].id, difficulty: 1 as const, prompt: `${id} prompt`, options: ['alpha', 'b', 'c', 'd'], answerIndex: 0, createdAt: '', updatedAt: '' })),
      { id: 'b-1', fingerprint: 'b-1-fp', kind: 'multipleChoice', questionStyle: 'standard', wordKey: 'beta', senseId: words[1].senses[0].id, difficulty: 2, prompt: 'beta prompt', options: ['beta', 'b', 'c', 'd'], answerIndex: 0, createdAt: '', updatedAt: '' },
    ]
    seedSet(libraryStore, set)
    libraryStore.importWords(words)
    libraryStore.replaceSetMemberships(set.id, words.map(word => ({ wordKey: word.wordKey, senseIds: word.senses.map(sense => sense.id) })))
    libraryStore.importQuestions(questions)
    uiStore.setQuestionCountPreference(3)

    await sessionStore.startRound('quiz', set.id)

    const entries = sessionStore.currentSession?.entries ?? []
    expect(entries).toHaveLength(3)
    expect(new Set(entries.map(entry => entry.question?.questionId)).size).toBe(3)
    expect(entries.filter(entry => entry.item.id === words[0].senses[0].id)).toHaveLength(2)
    expect(entries.filter(entry => entry.item.id === words[1].senses[0].id)).toHaveLength(1)
  })
})

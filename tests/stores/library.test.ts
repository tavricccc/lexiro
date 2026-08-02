import type { LibraryQuestion, LibrarySet, WordEntry } from '@/types'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { reviewCard } from '@/lib/fsrs'
import { buildSenseId } from '@/lib/library'
import { getLibraryRepository } from '@/lib/library-repository'
import { setStorageNamespace } from '@/lib/persist'
import { useLearningStore } from '@/stores/learning'
import { useLibraryStore } from '@/stores/library'
import { seedSet } from '../helpers/library'

const baseSet: LibrarySet = {
  id: 'set-1',
  setName: 'Shared words',
  folderId: '__uncategorized__',
  createdAt: '',
  updatedAt: '',
}

describe('library shared word membership', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('replaces stale set membership fields while preserving shared word senses', () => {
    const libraryStore = useLibraryStore()
    const firstSenseId = buildSenseId('abandon', 'v.', '放棄')
    const secondSenseId = buildSenseId('abandon', 'v.', '遺棄')
    seedSet(libraryStore, baseSet)
    libraryStore.importWords([{
      wordKey: 'abandon',
      word: 'abandon',
      senses: [{ id: firstSenseId, pos: 'v.', meaningZh: '放棄', examples: ['They abandoned the plan.'] }],
      updatedAt: '',
    }])
    libraryStore.replaceSetMemberships(baseSet.id, [{ wordKey: 'abandon', senseIds: [firstSenseId] }])
    libraryStore.importWords([{
      wordKey: 'abandon',
      word: 'abandon',
      senses: [{ id: secondSenseId, pos: 'v.', meaningZh: '遺棄', examples: ['They abandoned the building.'] }],
      updatedAt: '',
    }])
    libraryStore.replaceSetMemberships(baseSet.id, [{ wordKey: 'abandon', senseIds: [secondSenseId] }])

    const word = libraryStore.getWord('abandon')
    const membership = libraryStore.getMembership('set-1', 'abandon')
    expect(word?.senses.map(sense => sense.meaningZh)).toEqual(['遺棄'])
    expect(membership?.senseIds).toHaveLength(1)
    expect(membership).toEqual({ wordKey: 'abandon', senseIds: [secondSenseId] })
  })

  it('returns set names for the exact sense membership', () => {
    const libraryStore = useLibraryStore()
    const firstSenseId = buildSenseId('abandon', 'v.', '放棄')
    const secondSenseId = buildSenseId('abandon', 'n.', '遺棄')
    const secondSet: LibrarySet = { ...baseSet, id: 'set-2', setName: 'Nouns' }
    seedSet(libraryStore, baseSet)
    seedSet(libraryStore, secondSet)
    libraryStore.addWordToSets({
      wordKey: 'abandon',
      word: 'abandon',
      senses: [
        { id: firstSenseId, pos: 'v.', meaningZh: '放棄', examples: [] },
        { id: secondSenseId, pos: 'n.', meaningZh: '遺棄', examples: [] },
      ],
      updatedAt: '',
    }, [
      { setId: baseSet.id, membership: { wordKey: 'abandon', senseIds: [firstSenseId] } },
      { setId: secondSet.id, membership: { wordKey: 'abandon', senseIds: [secondSenseId] } },
    ])

    expect(libraryStore.getSenseSetNames('abandon', firstSenseId)).toEqual(['Shared words'])
    expect(libraryStore.getSenseSetNames('abandon', secondSenseId)).toEqual(['Nouns'])
  })

  it('deduplicates questions by content instead of external ids', () => {
    const libraryStore = useLibraryStore()
    const senseId = buildSenseId('abandon', 'v.', '放棄')
    seedSet(libraryStore, baseSet)
    libraryStore.importWords([{ wordKey: 'abandon', word: 'abandon', senses: [{ id: senseId, pos: 'v.', meaningZh: '放棄', examples: [] }], updatedAt: '' }])
    libraryStore.replaceSetMemberships(baseSet.id, [{ wordKey: 'abandon', senseIds: [senseId] }])
    const question = {
      kind: 'multipleChoice' as const,
      questionStyle: 'fillBlank' as const,
      wordKey: 'abandon',
      senseId,
      difficulty: 1 as const,
      prompt: '_____ the plan.',
      options: ['abandon', 'keep', 'start', 'build'],
      answerIndex: 0,
    }
    libraryStore.importQuestions([
      { ...question, id: 'ai-id-one', fingerprint: 'fp-one', createdAt: '', updatedAt: '' },
      { ...question, id: 'ai-id-two', fingerprint: 'fp-two', createdAt: '', updatedAt: '' },
    ])

    expect(libraryStore.questions).toHaveLength(1)
  })

  it('does not persist a question outside the formal English four-choice schema', () => {
    const libraryStore = useLibraryStore()
    const senseId = buildSenseId('abandon', 'v.', '放棄')
    seedSet(libraryStore, baseSet)
    libraryStore.importWords([{ wordKey: 'abandon', word: 'abandon', senses: [{ id: senseId, pos: 'v.', meaningZh: '放棄', examples: [] }], updatedAt: '' }])
    libraryStore.replaceSetMemberships(baseSet.id, [{ wordKey: 'abandon', senseIds: [senseId] }])

    const imported = libraryStore.importQuestions([{
      id: 'invalid-question',
      fingerprint: 'invalid-question-fp',
      kind: 'multipleChoice',
      questionStyle: 'standard',
      wordKey: 'abandon',
      senseId,
      difficulty: 1,
      prompt: '這不是英文題目',
      options: ['a', 'b', 'c', 'd'],
      answerIndex: 0,
      createdAt: '',
      updatedAt: '',
    }])

    expect(imported).toBe(0)
    expect(libraryStore.questions).toEqual([])
  })

  it('ignores malformed runtime questions without throwing', () => {
    const libraryStore = useLibraryStore()

    expect(() => libraryStore.importQuestions([{ id: 'malformed-question' } as unknown as LibraryQuestion])).not.toThrow()
    expect(libraryStore.questions).toEqual([])
  })

  it('keeps a question id when editing across formal question types', () => {
    const libraryStore = useLibraryStore()
    const senseId = buildSenseId('abandon', 'v.', '放棄')
    seedSet(libraryStore, baseSet)
    libraryStore.importWords([{ wordKey: 'abandon', word: 'abandon', senses: [{ id: senseId, pos: 'v.', meaningZh: '放棄', examples: [] }], updatedAt: '' }])
    libraryStore.replaceSetMemberships(baseSet.id, [{ wordKey: 'abandon', senseIds: [senseId] }])
    libraryStore.importQuestions([{ id: 'stable-question-id', fingerprint: 'before-edit', kind: 'multipleChoice', questionStyle: 'standard', wordKey: 'abandon', senseId, difficulty: 1, prompt: 'Which word?', options: ['abandon', 'keep', 'start', 'build'], answerIndex: 0, createdAt: '', updatedAt: '' }])

    const changed = libraryStore.updateQuestion({
      id: 'stable-question-id',
      fingerprint: 'ignored-before-canonicalization',
      kind: 'reading',
      title: 'Abandon',
      passage: 'A short passage.',
      wordKeys: ['abandon'],
      questions: [{ id: 'child-id', kind: 'multipleChoice', prompt: 'What happened?', options: ['It stopped.', 'It continued.', 'It began.', 'It waited.'], answerIndex: 0, wordKey: 'abandon', senseId }],
      difficulty: 2,
      createdAt: '',
      updatedAt: '',
    })

    expect(changed).toBe(true)
    expect(libraryStore.questions[0]).toMatchObject({ id: 'stable-question-id', kind: 'reading' })
  })

  it('keeps every imported sense attached to the set membership', () => {
    const libraryStore = useLibraryStore()
    const firstSenseId = buildSenseId('abandon', 'v.', '放棄')
    const secondSenseId = buildSenseId('abandon', 'n.', '遺棄')
    libraryStore.importWords([{
      wordKey: 'abandon',
      word: 'abandon',
      senses: [
        { id: firstSenseId, pos: 'v.', meaningZh: '放棄', examples: [] },
        { id: secondSenseId, pos: 'n.', meaningZh: '遺棄', examples: [] },
      ],
      updatedAt: new Date().toISOString(),
    }])

    seedSet(libraryStore, baseSet)
    libraryStore.importWords([{
      wordKey: 'abandon',
      word: 'abandon',
      senses: [
        { id: firstSenseId, pos: 'v.', meaningZh: '放棄', examples: [] },
        { id: secondSenseId, pos: 'n.', meaningZh: '遺棄', examples: [] },
      ],
      updatedAt: '',
    }])
    libraryStore.replaceSetMemberships(baseSet.id, [{ wordKey: 'abandon', senseIds: [firstSenseId, secondSenseId] }])

    expect(libraryStore.getMembership('set-1', 'abandon')?.senseIds).toEqual([firstSenseId, secondSenseId])
    expect(libraryStore.getWord('abandon')?.senses.map(sense => sense.id)).toEqual([firstSenseId, secondSenseId])
  })

  it('writes one word and all target memberships atomically', () => {
    const libraryStore = useLibraryStore()
    const secondSet: LibrarySet = { ...baseSet, id: 'set-2', setName: 'Shared words two' }
    seedSet(libraryStore, baseSet)
    seedSet(libraryStore, secondSet)
    const senseId = buildSenseId('adapt', 'v.', '適應')
    const word = { wordKey: 'adapt', word: 'adapt', senses: [{ id: senseId, pos: 'v.', meaningZh: '適應', examples: [] }], updatedAt: '' }

    const saved = libraryStore.addWordToSets(word, [
      { setId: baseSet.id, membership: { wordKey: 'adapt', senseIds: [senseId] } },
      { setId: secondSet.id, membership: { wordKey: 'adapt', senseIds: [senseId] } },
    ])

    expect(saved.wordKey).toBe('adapt')
    expect(libraryStore.getMembership(baseSet.id, 'adapt')?.senseIds).toEqual([senseId])
    expect(libraryStore.getMembership(secondSet.id, 'adapt')?.senseIds).toEqual([senseId])
    expect(() => libraryStore.addWordToSets({ ...word, word: 'new-word', wordKey: 'new-word' }, [{ setId: 'missing', membership: { wordKey: 'new-word', senseIds: [senseId] } }])).toThrow()
    expect(libraryStore.getWord('new-word')).toBeNull()
  })

  it('validates set metadata and content before applying an edit', () => {
    const libraryStore = useLibraryStore()
    const senseId = buildSenseId('adapt', 'v.', '適應')
    const originalWord = { wordKey: 'adapt', word: 'adapt', senses: [{ id: senseId, pos: 'v.', meaningZh: '適應', examples: [] }], updatedAt: '' }
    seedSet(libraryStore, baseSet)
    libraryStore.importWords([originalWord])
    libraryStore.replaceSetMemberships(baseSet.id, [{ wordKey: 'adapt', senseIds: [senseId] }])

    expect(() => libraryStore.updateSetWithContent(baseSet.id, { setName: 'Renamed' }, [originalWord], [{ wordKey: 'adapt', senseIds: ['missing-sense'] }])).toThrow()
    expect(libraryStore.getSet(baseSet.id)?.setName).toBe(baseSet.setName)
    expect(libraryStore.getMembership(baseSet.id, 'adapt')?.senseIds).toEqual([senseId])
  })

  it('rejects set content that would leave a word without membership', () => {
    const libraryStore = useLibraryStore()
    const words: WordEntry[] = ['alpha', 'beta'].map((wordKey) => {
      const senseId = buildSenseId(wordKey, 'n.', `${wordKey} meaning`)
      return { wordKey, word: wordKey, senses: [{ id: senseId, pos: 'n.', meaningZh: `${wordKey} meaning`, examples: [] }], updatedAt: '' }
    })

    expect(() => libraryStore.createSetWithContent('Incomplete', undefined, words, [{ wordKey: 'alpha', senseIds: [words[0].senses[0].id] }])).toThrow()
    expect(libraryStore.sets).toEqual([])
    expect(libraryStore.getWord('alpha')).toBeNull()
    expect(libraryStore.getWord('beta')).toBeNull()
  })

  it('creates shared questions with the set in one library write', () => {
    const libraryStore = useLibraryStore()
    const senseId = buildSenseId('adapt', 'v.', '適應')
    const word = { wordKey: 'adapt', word: 'adapt', senses: [{ id: senseId, pos: 'v.', meaningZh: '適應', examples: [] }], updatedAt: '' }
    const question = {
      id: 'shared-question',
      fingerprint: 'stale-fingerprint',
      kind: 'multipleChoice' as const,
      questionStyle: 'standard' as const,
      wordKey: 'adapt',
      senseId,
      difficulty: 1 as const,
      prompt: 'Choose the word.',
      options: ['adapt', 'avoid', 'leave', 'forget'],
      answerIndex: 0,
      createdAt: '',
      updatedAt: '',
    }

    const set = libraryStore.createSetWithContent('Adaptation', undefined, [word], [{ wordKey: 'adapt', senseIds: [senseId] }], [question])

    expect(libraryStore.getSet(set.id)).not.toBeNull()
    expect(libraryStore.questions).toHaveLength(1)
    expect(libraryStore.questions[0]).toMatchObject({ id: 'shared-question', senseId })
  })

  it('removes deleted set senses and linked questions without removing shared words', () => {
    const libraryStore = useLibraryStore()
    const firstSenseId = buildSenseId('abandon', 'v.', '放棄')
    const secondSenseId = buildSenseId('abandon', 'n.', '遺棄')
    const firstSet = { ...baseSet, id: 'set-1' }
    const secondSet: LibrarySet = { ...baseSet, id: 'set-2', setName: 'Shared words two' }
    libraryStore.importWords([{
      wordKey: 'abandon',
      word: 'abandon',
      senses: [
        { id: firstSenseId, pos: 'v.', meaningZh: '放棄', examples: [] },
        { id: secondSenseId, pos: 'n.', meaningZh: '遺棄', examples: [] },
      ],
      updatedAt: '',
    }])
    seedSet(libraryStore, firstSet)
    seedSet(libraryStore, secondSet)
    libraryStore.replaceSetMemberships(firstSet.id, [{ wordKey: 'abandon', senseIds: [firstSenseId, secondSenseId] }])
    libraryStore.replaceSetMemberships(secondSet.id, [{ wordKey: 'abandon', senseIds: [secondSenseId] }])
    libraryStore.importQuestions([
      { id: 'first-id', fingerprint: 'fp-first', kind: 'multipleChoice', questionStyle: 'standard', wordKey: 'abandon', senseId: firstSenseId, difficulty: 1, prompt: 'Q1', options: ['a', 'b', 'c', 'd'], answerIndex: 0, createdAt: '', updatedAt: '' },
      { id: 'second-id', fingerprint: 'fp-second', kind: 'multipleChoice', questionStyle: 'standard', wordKey: 'abandon', senseId: secondSenseId, difficulty: 2, prompt: 'Q2', options: ['a', 'b', 'c', 'd'], answerIndex: 0, createdAt: '', updatedAt: '' },
    ])

    libraryStore.unlinkSet('set-1')
    expect(libraryStore.getWord('abandon')?.senses.map(sense => sense.id)).toEqual([secondSenseId])
    expect(libraryStore.questions.filter(question => question.kind !== 'reading').map(question => question.prompt)).toEqual(['Q2'])

    libraryStore.unlinkSet('set-2')
    expect(libraryStore.getWord('abandon')).toBeNull()
    expect(libraryStore.questions).toHaveLength(0)
  })

  it('enforces folder hierarchy rules and removes a folder subtree atomically', () => {
    const libraryStore = useLibraryStore()
    const parent = libraryStore.addFolder('Animals')
    const child = libraryStore.addFolder('Pets', parent.id)
    const repairedRootFolder = libraryStore.addFolder('Languages', '__uncategorized__')
    expect(repairedRootFolder.parentId).toBeUndefined()
    libraryStore.removeFolder(repairedRootFolder.id)
    expect(() => libraryStore.addFolder(' animals ')).toThrow()
    expect(libraryStore.updateFolder(parent.id, { parentId: child.id })).toBe(false)
    expect(libraryStore.updateFolder(parent.id, { name: 'Living things' })).toBe(true)
    expect(libraryStore.folders.find(folder => folder.id === parent.id)?.name).toBe('Living things')

    const senseId = buildSenseId('cat', 'n.', '貓')
    const sharedWord = {
      wordKey: 'cat',
      word: 'cat',
      senses: [{ id: senseId, pos: 'n.', meaningZh: '貓', examples: [] }],
      updatedAt: '',
    }
    libraryStore.importWords([sharedWord])
    const makeSet = (id: string, setName: string, folderId: string): LibrarySet => ({ id, setName, folderId, createdAt: '', updatedAt: '' })
    const removedSet = makeSet('removed-set', 'Pets set', parent.id)
    const nestedSet = makeSet('nested-set', 'Nested pets set', child.id)
    const keptSet = makeSet('kept-set', 'Kept set', '__uncategorized__')
    for (const set of [removedSet, nestedSet, keptSet]) {
      seedSet(libraryStore, set)
      const setId = set.id
      libraryStore.replaceSetMemberships(setId, [{ wordKey: 'cat', senseIds: [senseId] }])
    }

    const removed = libraryStore.removeFolder(parent.id)
    expect(removed).toEqual(new Set([parent.id, child.id]))
    expect(libraryStore.getSet(removedSet.id)).toBeNull()
    expect(libraryStore.getSet(nestedSet.id)).toBeNull()
    expect(libraryStore.getSet(keptSet.id)).not.toBeNull()
    expect(libraryStore.getWord('cat')).not.toBeNull()
    expect(libraryStore.folders.map(folder => folder.id)).toEqual(['__uncategorized__'])
  })

  it('uses the shared set-name policy when merging imported sets', () => {
    const libraryStore = useLibraryStore()
    const senseId = buildSenseId('adapt', 'v.', '適應')
    const word = { wordKey: 'adapt', word: 'adapt', senses: [{ id: senseId, pos: 'v.', meaningZh: '適應', examples: [] }], updatedAt: '' }
    libraryStore.importWords([word])
    seedSet(libraryStore, { ...baseSet, setName: 'Imported set' })

    libraryStore.mergeImportedState({
      version: 1,
      words: { adapt: word },
      sets: [{ ...baseSet, id: 'incoming-set', setName: 'Imported set' }],
      memberships: { 'incoming-set': [{ wordKey: 'adapt', senseIds: [senseId] }] },
      folders: [{ id: '__uncategorized__', name: '未分類', order: 0, createdAt: '', updatedAt: '' }],
      questions: [],
      updatedAt: '',
    })

    expect(libraryStore.getSet('incoming-set')?.setName).toBe('Imported set (2)')
  })

  it('keeps sense identity, memberships, questions, and cards aligned when editing a sense', () => {
    const libraryStore = useLibraryStore()
    const learningStore = useLearningStore()
    const oldSenseId = buildSenseId('run', 'v.', '跑步')
    const newSenseId = buildSenseId('run', 'v.', '經營')
    libraryStore.importWords([{ wordKey: 'run', word: 'run', senses: [{ id: oldSenseId, pos: 'v.', meaningZh: '跑步', examples: [] }], updatedAt: '' }])
    seedSet(libraryStore, baseSet)
    libraryStore.replaceSetMemberships(baseSet.id, [{ wordKey: 'run', senseIds: [oldSenseId] }])
    libraryStore.importQuestions([{ id: 'run-question', fingerprint: 'run-question-fp', kind: 'multipleChoice', questionStyle: 'standard', wordKey: 'run', senseId: oldSenseId, difficulty: 1, prompt: 'Which word?', options: ['run', 'walk', 'sit', 'stand'], answerIndex: 0, createdAt: '', updatedAt: '' }])
    learningStore.progress.cards[oldSenseId] = reviewCard(null, 'good')

    const updated = libraryStore.updateSense('run', oldSenseId, { meaningZh: '經營' })

    expect(updated?.id).toBe(newSenseId)
    expect(libraryStore.getMembership(baseSet.id, 'run')?.senseIds).toEqual([newSenseId])
    expect(libraryStore.questions[0]).toMatchObject({ senseId: newSenseId })
    expect(learningStore.getCardProgress(oldSenseId)).toBeNull()
    expect(learningStore.getCardProgress(newSenseId)).not.toBeNull()
  })

  it('rejects editing a sense into a duplicate identity', () => {
    const libraryStore = useLibraryStore()
    const firstSenseId = buildSenseId('run', 'v.', '跑步')
    const secondSenseId = buildSenseId('run', 'v.', '經營')
    libraryStore.importWords([{ wordKey: 'run', word: 'run', senses: [
      { id: firstSenseId, pos: 'v.', meaningZh: '跑步', examples: [] },
      { id: secondSenseId, pos: 'v.', meaningZh: '經營', examples: [] },
    ], updatedAt: '' }])

    expect(() => libraryStore.updateSense('run', firstSenseId, { meaningZh: '經營' })).toThrow()
    expect(libraryStore.getWord('run')?.senses.map(sense => sense.id)).toEqual([firstSenseId, secondSenseId])
  })

  it('persists question deletion from a partially hydrated set without restoring it', async () => {
    const namespace = `partial-question-${crypto.randomUUID()}`
    setStorageNamespace(namespace)
    const libraryStore = useLibraryStore()
    const senseId = buildSenseId('delete', 'v.', '刪除')
    const set = libraryStore.createSetWithContent(
      'Question set',
      undefined,
      [{ wordKey: 'delete', word: 'delete', senses: [{ id: senseId, pos: 'v.', meaningZh: '刪除', examples: [] }], updatedAt: '2026-08-02T00:00:00.000Z' }],
      [{ wordKey: 'delete', senseIds: [senseId] }],
    )
    libraryStore.importQuestions([{
      id: 'partial-question',
      fingerprint: 'partial-question-fingerprint',
      kind: 'multipleChoice',
      questionStyle: 'standard',
      wordKey: 'delete',
      senseId,
      difficulty: 1,
      prompt: 'Which word means delete?',
      options: ['delete', 'keep', 'open', 'save'],
      answerIndex: 0,
      createdAt: '2026-08-02T00:00:00.000Z',
      updatedAt: '2026-08-02T00:00:00.000Z',
    }])
    await libraryStore.waitForPersistence()

    libraryStore.resetForNamespace()
    await libraryStore.loadState()
    expect(await libraryStore.hydrateSet(set.id)).toBe(true)
    expect(libraryStore.removeQuestion('partial-question')).toBeTruthy()
    await libraryStore.waitForPersistence()

    expect((await getLibraryRepository(namespace).loadState()).questions).toEqual([])
    setStorageNamespace('guest')
  })
})

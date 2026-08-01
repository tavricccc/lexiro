import type { VocabSet } from '@/types'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildSenseId } from '@/lib/library'
import { useLibraryStore } from '@/stores/library'

const storage = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
}

const baseSet: VocabSet = {
  id: 'set-1',
  setName: 'Shared words',
  difficulty: 2,
  items: [{
    id: 'item-1',
    word: 'abandon',
    pos: 'v.',
    meaning: '放棄',
    example: 'They abandoned the plan.',
    tags: ['work'],
    note: 'first note',
    favorite: true,
  }],
}

describe('library shared word membership', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', storage)
    storage.getItem.mockClear()
    storage.setItem.mockClear()
    setActivePinia(createPinia())
  })

  it('replaces stale set membership fields while preserving shared word senses', () => {
    const libraryStore = useLibraryStore()
    libraryStore.linkSet(baseSet)

    libraryStore.linkSet({
      ...baseSet,
      items: [{
        ...baseSet.items[0],
        meaning: '遺棄',
        example: 'They abandoned the building.',
        tags: [],
        note: undefined,
        favorite: false,
      }],
    })

    const word = libraryStore.getWord('abandon')
    const membership = libraryStore.getMembership('set-1', 'abandon')
    expect(word?.senses.map(sense => sense.meaningZh)).toEqual(['遺棄'])
    expect(membership?.senseIds).toHaveLength(1)
    expect(membership?.tags).toEqual([])
    expect(membership?.note).toBeUndefined()
    expect(membership?.favorite).toBe(false)
  })

  it('deduplicates questions by content instead of external ids', () => {
    const libraryStore = useLibraryStore()
    const question = {
      kind: 'multipleChoice' as const,
      wordKey: 'abandon',
      prompt: '_____ the plan.',
      options: ['abandon', 'keep', 'start', 'build'],
      answerIndex: 0,
    }
    libraryStore.importQuestions([
      { ...question, id: 'ai-id-one', createdAt: '', updatedAt: '' },
      { ...question, id: 'ai-id-two', createdAt: '', updatedAt: '' },
    ])

    expect(libraryStore.questions).toHaveLength(1)
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
      synonyms: [],
      antonyms: [],
      updatedAt: new Date().toISOString(),
    }])

    libraryStore.linkSet(baseSet, {
      additionalSenseIdsByWordKey: { abandon: [firstSenseId, secondSenseId] },
    })

    expect(libraryStore.getMembership('set-1', 'abandon')?.senseIds).toEqual([firstSenseId, secondSenseId])
    expect(libraryStore.getWord('abandon')?.senses.map(sense => sense.id)).toEqual([firstSenseId, secondSenseId])
  })

  it('removes deleted set senses and linked questions without removing shared words', () => {
    const libraryStore = useLibraryStore()
    const firstSenseId = buildSenseId('abandon', 'v.', '放棄')
    const secondSenseId = buildSenseId('abandon', 'n.', '遺棄')
    const firstSet = { ...baseSet, id: 'set-1' }
    const secondSet: VocabSet = {
      ...baseSet,
      id: 'set-2',
      items: [{ ...baseSet.items[0], id: 'item-2', pos: 'n.', meaning: '遺棄', example: 'The place was abandoned.' }],
    }
    libraryStore.linkSet(firstSet)
    libraryStore.linkSet(secondSet)
    libraryStore.importQuestions([
      { id: 'first-id', kind: 'multipleChoice', wordKey: 'abandon', senseId: firstSenseId, prompt: 'Q1', options: ['a', 'b', 'c', 'd'], answerIndex: 0, createdAt: '', updatedAt: '' },
      { id: 'second-id', kind: 'multipleChoice', wordKey: 'abandon', senseId: secondSenseId, prompt: 'Q2', options: ['a', 'b', 'c', 'd'], answerIndex: 0, createdAt: '', updatedAt: '' },
    ])

    libraryStore.unlinkSet('set-1')
    expect(libraryStore.getWord('abandon')?.senses.map(sense => sense.id)).toEqual([secondSenseId])
    expect(libraryStore.questions.filter(question => question.kind !== 'reading').map(question => question.prompt)).toEqual(['Q2'])

    libraryStore.unlinkSet('set-2')
    expect(libraryStore.getWord('abandon')).toBeNull()
    expect(libraryStore.questions).toHaveLength(0)
  })
})

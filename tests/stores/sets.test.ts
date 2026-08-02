import type { SharedSet } from '@/types'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { buildSenseId } from '@/lib/library'
import { useLibraryStore } from '@/stores/library'
import { useSetsStore } from '@/stores/sets'

function makeSharedSet(id: string, setName: string): SharedSet {
  const senseId = buildSenseId('apple', 'n.', '蘋果')
  return {
    id,
    setName,
    folderId: 'folder-1',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    words: [{
      wordKey: 'apple',
      word: 'apple',
      senses: [{ id: senseId, pos: 'n.', meaningZh: '蘋果', examples: ['I eat an apple.'] }],
      updatedAt: '2026-08-01T00:00:00.000Z',
    }],
    memberships: [{ wordKey: 'apple', senseIds: [senseId] }],
    questions: [],
  }
}

function draft(id = 'draft-1') {
  return {
    id,
    word: 'apple',
    senses: [{ id: `${id}-sense`, pos: 'n.', meaning: '蘋果', examples: ['I eat an apple.'] }],
  }
}

function multiSenseDraft() {
  return {
    id: 'multi-sense',
    word: 'apple',
    senses: [
      { id: 'fruit', pos: 'n.', meaning: '水果', examples: ['I eat fruit.'] },
      { id: 'tree', pos: 'n.', meaning: '蘋果樹', examples: ['The tree is tall.'] },
    ],
  }
}

describe('canonical sets facade', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('creates a named set from editor drafts in the shared library', () => {
    const setsStore = useSetsStore()
    const created = setsStore.createSetFromItems([draft()], 'Fruits', '__uncategorized__')

    expect(created?.setName).toBe('Fruits')
    expect(created).not.toHaveProperty('items')
    expect(created).not.toHaveProperty('difficulty')
    expect(useLibraryStore().getSetStudyWords(created!.id)[0]).toMatchObject({ word: 'apple', meaning: '蘋果' })
  })

  it('requires a real set name before creating a set', () => {
    const setsStore = useSetsStore()
    expect(setsStore.createSetFromItems([draft()], '', '__uncategorized__')).toBeNull()
    expect(setsStore.setEditorError).toBe('請輸入單字集名稱')
  })

  it('builds a canonical share payload from selected library records', () => {
    const setsStore = useSetsStore()
    const created = setsStore.createSetFromItems([draft()], 'Fruits', '__uncategorized__')!

    expect(setsStore.exportSelectedSets).toEqual([expect.objectContaining({
      id: created.id,
      words: [expect.objectContaining({ wordKey: 'apple' })],
      memberships: [{ wordKey: 'apple', senseIds: [expect.any(String)] }],
      questions: [],
    })])
  })

  it('imports canonical share records as a new library set', () => {
    const setsStore = useSetsStore()
    const result = setsStore.applyImported([makeSharedSet('shared-1', 'Imported')], '__uncategorized__')

    expect(result?.imported).toHaveLength(1)
    expect(setsStore.sets[0]).toMatchObject({ setName: 'Imported' })
    expect(setsStore.sets[0].id).not.toBe('shared-1')
    expect(useLibraryStore().getSetStudyWords(setsStore.sets[0].id)[0]).toMatchObject({ word: 'apple' })
    expect(setsStore.sets[0]).not.toHaveProperty('items')
  })

  it('renames a shared set instead of overwriting a same-name set', () => {
    const setsStore = useSetsStore()
    setsStore.createSetFromItems([draft()], 'Imported', '__uncategorized__')

    const result = setsStore.applyImported([makeSharedSet('shared-1', 'Imported')], '__uncategorized__')

    expect(result?.renamed).toEqual([{ from: 'Imported', to: 'Imported (2)' }])
    expect(setsStore.sets.map(set => set.setName)).toEqual(['Imported', 'Imported (2)'])
  })

  it('exports only selected senses and questions fully backed by that set', () => {
    const setsStore = useSetsStore()
    const libraryStore = useLibraryStore()
    const first = setsStore.createSetFromItems([multiSenseDraft()], 'Fruit', '__uncategorized__')!
    const second = setsStore.createSetFromItems([multiSenseDraft()], 'Tree', '__uncategorized__')!
    const word = libraryStore.getWord('apple')!
    const [fruitSense, treeSense] = word.senses

    libraryStore.replaceSetMemberships(first.id, [{ wordKey: 'apple', senseIds: [fruitSense.id] }])
    libraryStore.replaceSetMemberships(second.id, [{ wordKey: 'apple', senseIds: [treeSense.id] }])
    libraryStore.importQuestions([{
      id: 'reading-both-senses',
      fingerprint: 'reading-both-senses',
      kind: 'reading',
      title: 'Apple',
      passage: 'A short passage.',
      wordKeys: ['apple'],
      questions: [
        { id: 'fruit-child', kind: 'multipleChoice', prompt: 'Fruit?', options: ['yes', 'no', 'maybe', 'never'], answerIndex: 0, wordKey: 'apple', senseId: fruitSense.id },
        { id: 'tree-child', kind: 'multipleChoice', prompt: 'Tree?', options: ['yes', 'no', 'maybe', 'never'], answerIndex: 0, wordKey: 'apple', senseId: treeSense.id },
      ],
      difficulty: 1,
      createdAt: '',
      updatedAt: '',
    }])

    setsStore.exportSelectedIds = [first.id]

    expect(setsStore.exportSelectedSets[0].words[0].senses).toHaveLength(1)
    expect(setsStore.exportSelectedSets[0].words[0].senses[0].id).toBe(fruitSense.id)
    expect(setsStore.exportSelectedSets[0].questions).toEqual([])
  })
})

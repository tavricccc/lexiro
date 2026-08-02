import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { buildSenseId } from '@/lib/library'
import { useLibraryStore } from '@/stores/library'
import { seedSet } from '../helpers/library'

describe('sense removal undo', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('restores a pruned word and set after immediate removal', () => {
    const libraryStore = useLibraryStore()
    const senseId = buildSenseId('adapt', 'v.', '適應')
    const set = {
      id: 'set-undo',
      setName: 'Undo set',
      folderId: '__uncategorized__',
      createdAt: '',
      updatedAt: '',
    }
    seedSet(libraryStore, set)
    libraryStore.importWords([{ wordKey: 'adapt', word: 'adapt', senses: [{ id: senseId, pos: 'v.', meaningZh: '適應', examples: [] }], updatedAt: '' }])
    libraryStore.replaceSetMemberships(set.id, [{ wordKey: 'adapt', senseIds: [senseId] }])

    const snapshot = libraryStore.removeSenseFromSetWithUndo(set.id, 'adapt', senseId)

    expect(snapshot).not.toBeNull()
    expect(libraryStore.getSet(set.id)).toBeNull()
    expect(libraryStore.getWord('adapt')).toBeNull()
    expect(libraryStore.restoreSenseRemoval(snapshot!)).toBe(true)
    expect(libraryStore.getSet(set.id)?.setName).toBe('Undo set')
    expect(libraryStore.getMembership(set.id, 'adapt')?.senseIds).toEqual([senseId])
    expect(libraryStore.getWord('adapt')?.senses[0]?.meaningZh).toBe('適應')
  })
})

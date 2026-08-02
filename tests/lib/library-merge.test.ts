import type { LibraryState } from '@/types'
import { describe, expect, it } from 'vitest'
import { createUncategorizedFolder } from '@/lib/folders'
import { buildSenseId } from '@/lib/library'
import { mergeLibraryStates } from '@/lib/library-merge'

function makeLibrary(setId: string, wordKey: string, setName: string): LibraryState {
  const timestamp = '2026-08-02T00:00:00.000Z'
  const senseId = buildSenseId(wordKey, 'n.', `${wordKey} 意思`)
  return {
    version: 1,
    words: {
      [wordKey]: { wordKey, word: wordKey, senses: [{ id: senseId, pos: 'n.', meaningZh: `${wordKey} 意思`, examples: [] }], updatedAt: timestamp },
    },
    sets: [{ id: setId, setName, folderId: '__uncategorized__', createdAt: timestamp, updatedAt: timestamp }],
    memberships: { [setId]: [{ wordKey, senseIds: [senseId] }] },
    folders: [createUncategorizedFolder()],
    questions: [],
    updatedAt: timestamp,
  }
}

describe('repository library merge', () => {
  it('keeps local records and adds remote records without requiring reactive hydration', () => {
    const result = mergeLibraryStates(makeLibrary('local-set', 'local', 'Local'), makeLibrary('remote-set', 'remote', 'Remote'))

    expect(result.result.addedSets).toBe(1)
    expect(result.state.sets.map(set => set.id)).toEqual(['local-set', 'remote-set'])
    expect(Object.keys(result.state.words)).toEqual(['local', 'remote'])
    expect(result.state.memberships['remote-set']).toEqual([{ wordKey: 'remote', senseIds: [buildSenseId('remote', 'n.', 'remote 意思')] }])
  })

  it('keeps the local set when an incoming backup has the same set id', () => {
    const local = makeLibrary('same-set', 'local', 'Local name')
    const incoming = makeLibrary('same-set', 'incoming', 'Incoming name')
    const result = mergeLibraryStates(local, incoming)

    expect(result.result.addedSets).toBe(0)
    expect(result.state.sets).toHaveLength(1)
    expect(result.state.sets[0].setName).toBe('Local name')
    expect(result.state.words).toHaveProperty('local')
    expect(result.state.words).not.toHaveProperty('incoming')
  })
})

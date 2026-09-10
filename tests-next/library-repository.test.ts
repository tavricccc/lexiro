import type { LibraryState } from '@/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/** In-memory stand-in for IndexedDB: jsdom has no indexedDB implementation. */
const store = new Map<string, unknown>()

vi.mock('idb-keyval', () => ({
  get: async (key: string) => store.get(key),
  set: async (key: string, value: unknown) => void store.set(key, value),
  setMany: async (entries: [string, unknown][]) => {
    for (const [key, value] of entries)
      store.set(key, value)
  },
  del: async (key: string) => void store.delete(key),
  delMany: async (keys: string[]) => {
    for (const key of keys)
      store.delete(key)
  },
  keys: async () => Array.from(store.keys()),
}))

const { LibraryRepository } = await import('@/src/lib/library-repository')
const { createUncategorizedFolder } = await import('@/src/lib/folders')
const { buildSenseId } = await import('@/src/lib/library')
const { canonicalHash } = await import('@/src/lib/hash')

const TIMESTAMP = '2026-09-01T00:00:00.000Z'

function libraryWith(wordKeys: string[], setName = '常用單字'): LibraryState {
  const words = Object.fromEntries(wordKeys.map(wordKey => [wordKey, {
    wordKey,
    word: wordKey,
    senses: [{ id: buildSenseId(wordKey, 'n.', `${wordKey} 意思`), pos: 'n.', meaningZh: `${wordKey} 意思`, examples: [] }],
    updatedAt: TIMESTAMP,
  }]))
  return {
    version: 1,
    words,
    sets: [{ id: 'set-1', setName, folderId: '__uncategorized__', createdAt: TIMESTAMP, updatedAt: TIMESTAMP }],
    memberships: { 'set-1': wordKeys.map(wordKey => ({ wordKey, senseIds: [words[wordKey]!.senses[0]!.id] })) },
    folders: [createUncategorizedFolder()],
    questions: [],
    updatedAt: TIMESTAMP,
  }
}

function blobKeys(): string[] {
  return Array.from(store.keys()).filter(key => key.includes(':blob:'))
}

describe('LibraryRepository', () => {
  beforeEach(() => {
    store.clear()
  })

  it('round-trips a library', async () => {
    const repository = new LibraryRepository('tester')
    await repository.commit(libraryWith(['alpha', 'beta']))
    const loaded = await new LibraryRepository('tester').loadState()
    expect(Object.keys(loaded.words).toSorted()).toEqual(['alpha', 'beta'])
    expect(loaded.sets).toHaveLength(1)
    expect(loaded.memberships['set-1']).toHaveLength(2)
  })

  it('writes only the records that changed', async () => {
    const repository = new LibraryRepository('tester')
    const first = await repository.commit(libraryWith(['alpha', 'beta']))
    expect(first.writtenBlobs).toBe(first.totalRecords)

    // Renaming the set touches one record; every word blob is already on disk.
    const second = await repository.commit(libraryWith(['alpha', 'beta'], '改過的名字'))
    expect(second.writtenBlobs).toBe(1)
    expect(second.totalRecords).toBe(first.totalRecords)

    const third = await repository.commit(libraryWith(['alpha', 'beta', 'gamma'], '改過的名字'))
    // The new word plus the membership record that now lists it.
    expect(third.writtenBlobs).toBe(2)
  })

  it('collects generations that are no longer live', async () => {
    const repository = new LibraryRepository('tester')
    await repository.commit(libraryWith(['alpha']))
    await repository.commit(libraryWith(['beta']))
    await repository.commit(libraryWith(['gamma']))
    await repository.commit(libraryWith(['delta']))

    const manifests = Array.from(store.keys()).filter(key => key.includes(':manifest:'))
    expect(manifests).toHaveLength(2)
    // Only the live and previous generations keep blobs, so storage stays flat
    // instead of accumulating a full copy of the Library per save.
    const loaded = await repository.loadState()
    expect(Object.keys(loaded.words)).toEqual(['delta'])
    expect(blobKeys().length).toBeLessThanOrEqual(8)
  })

  it('keeps the previous generation readable after a commit', async () => {
    const repository = new LibraryRepository('tester')
    await repository.commit(libraryWith(['alpha']))
    const firstManifest = Array.from(store.keys()).find(key => key.includes(':manifest:'))!
    await repository.commit(libraryWith(['beta']))
    expect(store.has(firstManifest)).toBe(true)
  })

  it('ignores a commit that never reached the head pointer', async () => {
    const repository = new LibraryRepository('tester')
    await repository.commit(libraryWith(['alpha']))
    const head = store.get('tester:lexiro-library:head')

    // Simulate a crash between writing a generation and publishing it.
    await new LibraryRepository('tester').commit(libraryWith(['beta']))
    store.set('tester:lexiro-library:head', head)

    const loaded = await new LibraryRepository('tester').loadState()
    expect(Object.keys(loaded.words)).toEqual(['alpha'])
  })

  it('recovers the newest complete generation when the head is lost', async () => {
    const repository = new LibraryRepository('tester')
    await repository.commit(libraryWith(['alpha']))
    await repository.commit(libraryWith(['beta']))
    store.delete('tester:lexiro-library:head')

    const loaded = await new LibraryRepository('tester').loadState()
    expect(Object.keys(loaded.words)).toEqual(['beta'])
    expect(store.has('tester:lexiro-library:head')).toBe(true)
  })

  it('rejects a blob whose content no longer matches its hash', async () => {
    const repository = new LibraryRepository('tester')
    await repository.commit(libraryWith(['alpha']))
    const wordBlob = blobKeys().find((key) => {
      const value = store.get(key) as { wordKey?: string }
      return value?.wordKey === 'alpha'
    })!
    store.set(wordBlob, { ...(store.get(wordBlob) as object), word: 'tampered' })

    // Nothing older exists to fall back to, so the caller is told rather than
    // shown a silently altered Library.
    await expect(new LibraryRepository('tester').loadState()).rejects.toThrow('checksum mismatch')
    expect(canonicalHash(store.get(wordBlob))).not.toBe(wordBlob.split(':blob:')[1])
  })

  it('falls back to the previous generation when the newest one is damaged', async () => {
    const repository = new LibraryRepository('tester')
    await repository.commit(libraryWith(['alpha']))
    await repository.commit(libraryWith(['beta']))
    const betaBlob = blobKeys().find((key) => {
      const value = store.get(key) as { wordKey?: string }
      return value?.wordKey === 'beta'
    })!
    store.set(betaBlob, { ...(store.get(betaBlob) as object), word: 'tampered' })

    const loaded = await new LibraryRepository('tester').loadState()
    expect(Object.keys(loaded.words)).toEqual(['alpha'])
  })

  it('starts from an empty library when nothing is stored', async () => {
    const loaded = await new LibraryRepository('fresh').loadState()
    expect(loaded.sets).toHaveLength(0)
    expect(loaded.folders.map(folder => folder.id)).toEqual(['__uncategorized__'])
  })

  it('keeps namespaces separate', async () => {
    await new LibraryRepository('one').commit(libraryWith(['alpha']))
    const other = await new LibraryRepository('two').loadState()
    expect(other.words).toEqual({})
  })
})

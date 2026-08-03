import type { LibraryRemoteStagingBatch } from '@/lib/library-repository'
import type { LibrarySet, LibraryState, SetMembership, WordEntry } from '@/types'
import { get, keys, set } from 'idb-keyval'
import { describe, expect, it } from 'vitest'
import { LIBRARY_STORAGE_KEY } from '@/constants'
import { buildV5LibraryChunks } from '@/lib/cloud-sync-schema'
import { buildSenseId } from '@/lib/library'
import { LIBRARY_CONTENT_CACHE_LIMIT, LIBRARY_PAGE_SIZE, LibraryRepository } from '@/lib/library-repository'
import { loadFromStorage, saveToStorage, setStorageNamespace } from '@/lib/persist'

function makeLibrary(setCount = 25): LibraryState {
  const timestamp = '2026-08-02T00:00:00.000Z'
  const words: Record<string, WordEntry> = {}
  const sets: LibrarySet[] = []
  const memberships: Record<string, SetMembership[]> = {}
  for (let index = 0; index < setCount; index += 1) {
    const wordKey = `apple ${index}`
    const setId = `set-${index}`
    const senseId = buildSenseId(wordKey, 'n.', `中文意思 ${index}`)
    words[wordKey] = { wordKey, word: `Apple ${index}`, senses: [{ id: senseId, pos: 'n.', meaningZh: `中文意思 ${index}`, examples: [] }], updatedAt: timestamp }
    sets.push({ id: setId, setName: `Set ${index}`, folderId: '__uncategorized__', createdAt: timestamp, updatedAt: timestamp })
    memberships[setId] = [{ wordKey, senseIds: [senseId] }]
  }
  return {
    version: 1,
    words,
    sets,
    memberships,
    folders: [{ id: '__uncategorized__', name: '未分類', order: -1, createdAt: timestamp, updatedAt: timestamp }],
    questions: [],
    updatedAt: timestamp,
  }
}

describe('libraryRepository', () => {
  it('notifies subscribers only after a committed mutation', async () => {
    const repository = new LibraryRepository(`repo-events-${crypto.randomUUID()}`)
    const versions: number[] = []
    const stop = repository.onMutation(version => versions.push(version))

    await repository.commitRecords(makeLibrary(1))
    await repository.commitRecords(makeLibrary(1))
    stop()
    await repository.commitRecords(makeLibrary(2))

    expect(versions).toEqual([1, 5])
    expect(repository.currentMutationVersion()).toBeGreaterThan(versions.at(-1)!)
  })

  it('migrates the legacy JSON once and keeps the active generation stable on restart', async () => {
    const namespace = `repo-migration-${crypto.randomUUID()}`
    const legacy = makeLibrary(3)
    setStorageNamespace(namespace)
    await saveToStorage(LIBRARY_STORAGE_KEY, JSON.stringify(legacy))

    const repository = new LibraryRepository(namespace)
    const migrated = await repository.loadIndex()
    const restarted = await new LibraryRepository(namespace).loadIndex()

    expect(migrated.sets).toHaveLength(3)
    expect(restarted.generation).toBe(migrated.generation)
    expect((await loadFromStorage(LIBRARY_STORAGE_KEY)).value).toBe('')
    setStorageNamespace('guest')
  })

  it('recovers a complete generation after an interrupted pointer or damaged index', async () => {
    const namespace = `repo-recovery-${crypto.randomUUID()}`
    const repository = new LibraryRepository(namespace)
    const committed = await repository.commitRecords(makeLibrary(3))
    await set(`${namespace}:lexiro-library-v5:active`, {
      schemaVersion: 1,
      generation: 'generation-that-was-never-published',
      updatedAt: committed.updatedAt,
    })

    const recoveredFromPointer = await new LibraryRepository(namespace).loadIndex()
    expect(recoveredFromPointer.generation).toBe(committed.generation)
    expect(recoveredFromPointer.sets).toHaveLength(3)

    await set(`${namespace}:lexiro-library-v5:${committed.generation}:index`, { schemaVersion: 1, generation: committed.generation, updatedAt: committed.updatedAt, folders: committed.folders, sets: [], searchIndex: [] })
    const recoveredFromIndex = await new LibraryRepository(namespace).loadIndex()
    expect(recoveredFromIndex.generation).toBe(committed.generation)
    expect(recoveredFromIndex.sets).toHaveLength(3)
  })

  it('quarantines a corrupt legacy blob instead of discarding it during recovery', async () => {
    const namespace = `repo-corrupt-legacy-${crypto.randomUUID()}`
    const raw = '{"broken":true}'
    setStorageNamespace(namespace)
    await saveToStorage(LIBRARY_STORAGE_KEY, raw)

    const index = await new LibraryRepository(namespace).loadIndex()
    expect(index.sets).toEqual([])
    expect((await loadFromStorage(LIBRARY_STORAGE_KEY)).value).toBe(raw)

    const quarantineKey = (await keys()).find(key => typeof key === 'string' && key.startsWith(`${namespace}:${LIBRARY_STORAGE_KEY}:quarantine:`))
    expect(quarantineKey).toBeTruthy()
    expect(await get(quarantineKey!)).toBe(raw)
    setStorageNamespace('guest')
  })

  it('keeps startup metadata light and loads set content on demand', async () => {
    const repository = new LibraryRepository(`repo-light-${crypto.randomUUID()}`)
    await repository.commitRecords(makeLibrary())

    const index = await repository.loadIndex()
    expect(index.sets).toHaveLength(25)
    expect(index.searchIndex[0]).toMatchObject({ setId: 'set-0' })

    const page = await repository.listFolderPage('__all__', 0, LIBRARY_PAGE_SIZE)
    expect(page.sets).toHaveLength(LIBRARY_PAGE_SIZE)
    expect(page.hasMore).toBe(true)

    const membershipBatches: Array<Array<{ setId: string, memberships: SetMembership[] }>> = []
    for await (const batch of repository.streamMemberships(1))
      membershipBatches.push(batch)
    expect(membershipBatches.flat()).toHaveLength(25)
    expect(membershipBatches[0][0]).toMatchObject({ setId: 'set-0', memberships: [{ wordKey: 'apple 0' }] })

    const payloads = await repository.loadSetPayloads('set-0')
    expect(payloads.get('set-0')).toMatchObject({
      words: [expect.objectContaining({ wordKey: 'apple 0' })],
      memberships: [{ wordKey: 'apple 0' }],
    })
  })

  it('searches set names, English words, and Chinese meanings through the index', async () => {
    const repository = new LibraryRepository(`repo-search-${crypto.randomUUID()}`)
    await repository.commitRecords(makeLibrary(2))

    expect((await repository.searchSets('apple 1')).items.map(set => set.id)).toEqual(['set-1'])
    expect((await repository.searchSets('中文意思 0')).items.map(set => set.id)).toEqual(['set-0'])
  })

  it('updates every affected search entry when a shared word changes or is removed', async () => {
    const repository = new LibraryRepository(`repo-shared-index-${crypto.randomUUID()}`)
    const library = makeLibrary(2)
    const timestamp = '2026-08-02T00:00:00.000Z'
    const sharedWordKey = 'shared word'
    const sharedSenseId = buildSenseId(sharedWordKey, 'n.', '共同意思')
    library.words[sharedWordKey] = { wordKey: sharedWordKey, word: 'Shared word', senses: [{ id: sharedSenseId, pos: 'n.', meaningZh: '共同意思', examples: [] }], updatedAt: timestamp }
    library.memberships['set-0'].push({ wordKey: sharedWordKey, senseIds: [sharedSenseId] })
    library.memberships['set-1'].push({ wordKey: sharedWordKey, senseIds: [sharedSenseId] })
    await repository.commitRecords(library)
    expect((await repository.searchSets('共同意思')).items.map(set => set.id)).toEqual(['set-0', 'set-1'])

    const updatedSenseId = buildSenseId(sharedWordKey, 'n.', '更新意思')
    library.words[sharedWordKey] = { ...library.words[sharedWordKey], senses: [{ id: updatedSenseId, pos: 'n.', meaningZh: '更新意思', examples: [] }] }
    library.memberships['set-0'] = library.memberships['set-0'].map(member => member.wordKey === sharedWordKey ? { ...member, senseIds: [updatedSenseId] } : member)
    library.memberships['set-1'] = library.memberships['set-1'].map(member => member.wordKey === sharedWordKey ? { ...member, senseIds: [updatedSenseId] } : member)
    await repository.commitRecords(library)
    expect(await repository.searchSets('共同意思')).toMatchObject({ items: [], total: 0 })
    expect((await repository.searchSets('更新意思')).items.map(set => set.id)).toEqual(['set-0', 'set-1'])

    delete library.words[sharedWordKey]
    library.memberships['set-0'] = library.memberships['set-0'].filter(member => member.wordKey !== sharedWordKey)
    library.memberships['set-1'] = library.memberships['set-1'].filter(member => member.wordKey !== sharedWordKey)
    await repository.commitRecords(library)
    expect(await repository.searchSets('更新意思')).toMatchObject({ items: [], total: 0 })
  })

  it('does not switch the active generation until activation is explicit', async () => {
    const repository = new LibraryRepository(`repo-generation-${crypto.randomUUID()}`)
    const first = await repository.commitRecords(makeLibrary(1))
    const generation = `staging-${crypto.randomUUID()}`
    await repository.stageRemoteBatch(generation, [])
    await expect(repository.activateGeneration(generation)).rejects.toThrow()
    await repository.stageRemoteBatch(generation, makeLibrary(1))

    expect((await repository.loadIndex()).generation).toBe(first.generation)
    const activated = await repository.activateGeneration(generation)
    expect(activated.generation).toBe(generation)
    expect((await repository.loadIndex()).generation).toBe(generation)
  })

  it('does not auto-publish an unactivated remote staging generation after restart', async () => {
    const namespace = `repo-remote-staging-${crypto.randomUUID()}`
    const repository = new LibraryRepository(namespace)
    const first = await repository.commitRecords(makeLibrary(1))
    const remoteGeneration = `remote-${crypto.randomUUID()}`
    await repository.stageRemoteBatch(remoteGeneration, makeLibrary(2))

    expect((await new LibraryRepository(namespace).loadIndex()).generation).toBe(first.generation)
    expect((await repository.activateGeneration(remoteGeneration)).generation).toBe(remoteGeneration)
  })

  it('retains verified remote chunks so a failed download can resume', async () => {
    const namespace = `repo-remote-resume-${crypto.randomUUID()}`
    const repository = new LibraryRepository(namespace)
    const library = makeLibrary(2)
    const chunk = buildV5LibraryChunks('cloud-user', library)[0]
    const generation = `remote-${crypto.randomUUID()}`
    const batch: LibraryRemoteStagingBatch = {
      kind: 'remote',
      revision: 'remote-revision-1',
      chunks: [chunk],
      records: [],
    }

    await repository.stageRemoteBatch(generation, batch)

    const resumable = await repository.findResumableRemoteGeneration()
    expect(resumable).toMatchObject({ generation, revision: 'remote-revision-1', chunkIds: [chunk.chunkId] })
    expect((await repository.loadStagedRemoteChunks(generation)).get(chunk.chunkId)).toEqual(chunk)
  })

  it('keeps only the most recent 48 payloads in the content cache', async () => {
    const repository = new LibraryRepository(`repo-lru-${crypto.randomUUID()}`)
    await repository.commitRecords(makeLibrary(50))

    await repository.loadSetPayloads(Array.from({ length: 50 }, (_, index) => `set-${index}`))

    const cache = (repository as unknown as { payloadCache: Map<string, unknown> }).payloadCache
    expect(cache.size).toBe(LIBRARY_CONTENT_CACHE_LIMIT)
    expect(cache.has('set-0')).toBe(false)
    expect(cache.has('set-49')).toBe(true)
  })

  it('keeps the 250-set startup index light and pages exactly 24 summaries', async () => {
    const repository = new LibraryRepository(`repo-large-fixture-${crypto.randomUUID()}`)
    await repository.commitRecords(makeLibrary(250))

    const index = await repository.loadIndex()
    expect(index.sets).toHaveLength(250)
    expect(index.sets[0]).not.toHaveProperty('words')
    expect(index.searchIndex).toHaveLength(250)
    const cache = (repository as unknown as { payloadCache: Map<string, unknown> }).payloadCache
    expect(cache.size).toBe(0)

    const first = await repository.listFolderPage('__all__', 0, LIBRARY_PAGE_SIZE)
    const second = await repository.listFolderPage('__all__', 1, LIBRARY_PAGE_SIZE)
    expect(first.sets).toHaveLength(24)
    expect(second.sets).toHaveLength(24)
    expect(first.sets[0].id).not.toBe(second.sets[0].id)
    expect((await repository.searchSets('中文意思 249')).items.map(set => set.id)).toEqual(['set-249'])
    expect(cache.size).toBe(0)

    await repository.loadSetPayloads('set-0')
    expect(cache.size).toBe(1)
    await repository.loadSetPayloads('set-0')
    expect(cache.get('set-0')).toBeTruthy()
  })

  it('refuses to hydrate a set when a required content record is missing', async () => {
    const namespace = `repo-missing-content-${crypto.randomUUID()}`
    const repository = new LibraryRepository(namespace)
    await repository.commitRecords(makeLibrary(1))
    await set(`${namespace}:lexiro-library-v5:${(await repository.loadIndex()).generation}:record:membership:set-0`, null)

    await expect(repository.loadSetPayloads('set-0')).rejects.toThrow('membership')
    expect((await new LibraryRepository(namespace).loadIndex()).sets).toHaveLength(1)
  })
})

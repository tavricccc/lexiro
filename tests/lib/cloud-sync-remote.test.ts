import type { Firestore } from 'firebase/firestore'
import type { LibraryState } from '@/types'
import { describe, expect, it, vi } from 'vitest'
import { defaultAiSettings } from '@/lib/ai-provider'
import { parseCloudLibrarySnapshot, readCloudLibraryV5, writeCloudAiSettings, writeCloudLearningState, writeCloudLibraryChunks, writeCloudLibraryChunksV5 } from '@/lib/cloud-sync-remote'
import { buildLibraryChunks, buildLibraryManifest, buildV5LibraryChunks, buildV5LibraryManifest } from '@/lib/cloud-sync-schema'
import { createDefaultStats } from '@/lib/learning-defaults'
import { buildSenseId } from '@/lib/library'

const mockedCloud = vi.hoisted(() => ({
  runTransaction: vi.fn(),
  transactionDocuments: new Map<string, unknown>(),
  sets: [] as unknown[][],
  batchSets: [] as unknown[][][],
  batchDeletes: [] as unknown[][][],
  getDocFromServer: vi.fn(),
  getDocsFromServer: vi.fn(),
  writeBatch: vi.fn(),
}))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((...segments: unknown[]) => ({ kind: 'collection', path: segments.join('/') })),
  doc: vi.fn((...segments: unknown[]) => ({ kind: 'document', path: segments.join('/') })),
  documentId: vi.fn(() => '__name__'),
  getDocFromServer: mockedCloud.getDocFromServer,
  getDocsFromServer: mockedCloud.getDocsFromServer,
  limit: vi.fn((value: number) => ({ kind: 'limit', value })),
  orderBy: vi.fn((field: unknown) => ({ kind: 'orderBy', field })),
  query: vi.fn((...parts: unknown[]) => ({ kind: 'query', parts })),
  runTransaction: mockedCloud.runTransaction,
  startAfter: vi.fn((cursor: unknown) => ({ kind: 'startAfter', cursor })),
  writeBatch: mockedCloud.writeBatch,
}))

vi.mock('@/lib/firebase', () => ({
  getFirebaseFirestore: vi.fn(() => ({})),
}))

function setupSuccessfulTransaction(currentManifest?: object) {
  mockedCloud.sets.length = 0
  mockedCloud.batchSets.length = 0
  mockedCloud.batchDeletes.length = 0
  mockedCloud.getDocFromServer.mockReset()
  mockedCloud.getDocsFromServer.mockReset()
  mockedCloud.writeBatch.mockReset()
  mockedCloud.transactionDocuments.clear()
  mockedCloud.writeBatch.mockImplementation(() => {
    const sets: unknown[][] = []
    const deletes: unknown[][] = []
    mockedCloud.batchSets.push(sets)
    mockedCloud.batchDeletes.push(deletes)
    return {
      set: (...args: unknown[]) => sets.push(args),
      delete: (...args: unknown[]) => deletes.push(args),
      commit: vi.fn(async () => undefined),
    }
  })
  mockedCloud.runTransaction.mockReset()
  mockedCloud.runTransaction.mockImplementation(async (_db: unknown, callback: (transaction: unknown) => Promise<unknown>) => callback({
    get: async (reference: { path?: string }) => {
      const data = reference.path?.endsWith('/library/manifest')
        ? currentManifest
        : mockedCloud.transactionDocuments.get(reference.path ?? '')
      return { exists: () => Boolean(data), data: () => data }
    },
    set: (reference: { path?: string }, payload: unknown) => {
      mockedCloud.sets.push([reference, payload])
      mockedCloud.transactionDocuments.set(reference.path ?? '', payload)
    },
    delete: (reference: { path?: string }) => {
      mockedCloud.transactionDocuments.delete(reference.path ?? '')
    },
  }))
}

function makeLargeLibrary(wordCount = 100): LibraryState {
  const timestamp = '2026-08-02T00:00:00.000Z'
  const words = Object.fromEntries(Array.from({ length: wordCount }, (_, index) => {
    const wordKey = `large-word-${index}`
    const senseId = buildSenseId(wordKey, 'n.', `大型意思 ${index}`)
    return [wordKey, {
      wordKey,
      word: `large-word-${index}`,
      senses: [{ id: senseId, pos: 'n.', meaningZh: `${'大型資料'.repeat(9000)} ${index}`, examples: [] }],
      updatedAt: timestamp,
    }]
  }))
  const sets = Array.from({ length: wordCount }, (_, index) => ({ id: `large-set-${index}`, setName: `Large set ${index}`, folderId: '__uncategorized__', createdAt: timestamp, updatedAt: timestamp }))
  const memberships = Object.fromEntries(sets.map((set, index) => {
    const wordKey = `large-word-${index}`
    const senseId = words[wordKey].senses[0].id
    return [set.id, [{ wordKey, senseIds: [senseId] }]]
  }))
  return {
    version: 1,
    words,
    sets,
    memberships,
    folders: [{ id: '__uncategorized__', name: '未分類', createdAt: timestamp, updatedAt: timestamp, order: -1 }],
    questions: [],
    updatedAt: timestamp,
  }
}

describe('cloud sync remote repository', () => {
  it('writes learning documents through conditional writes', async () => {
    setupSuccessfulTransaction()
    const progress = { cards: {}, updatedAt: '2026-08-01T00:00:00.000Z' }
    const stats = createDefaultStats()
    const reported: Array<[number, number]> = []

    const result = await writeCloudLearningState({} as Firestore, 'cloud-user', progress, stats, { progress: '', stats: '' }, (completed, total) => reported.push([completed, total]))

    expect(result.progress).toEqual({ written: true })
    expect(result.stats).toEqual({ written: true })
    expect(mockedCloud.sets).toHaveLength(2)
    expect(mockedCloud.sets[0][1]).toMatchObject({ ownerId: 'cloud-user', schemaVersion: 4 })
    expect(mockedCloud.sets[1][1]).toMatchObject({ ownerId: 'cloud-user', schemaVersion: 4 })
    expect(reported).toEqual([[0, 2], [1, 2], [2, 2]])
  })

  it('keeps AI API keys out of Cloud payloads', async () => {
    setupSuccessfulTransaction()
    const reported: Array<[number, number]> = []
    const result = await writeCloudAiSettings({} as Firestore, 'cloud-user', { ...defaultAiSettings, apiKey: 'device-secret', model: 'cloud-model' }, '', (completed, total) => reported.push([completed, total]))

    expect(result.result).toEqual({ written: true })
    expect(mockedCloud.sets).toHaveLength(1)
    expect(mockedCloud.sets[0][1]).not.toHaveProperty('apiKey')
    expect(mockedCloud.sets[0][1]).toMatchObject({ model: 'cloud-model', ownerId: 'cloud-user', schemaVersion: 4 })
    expect(reported).toEqual([[0, 1], [1, 1]])
  })

  it('transports a fresh local set without undefined Firestore values', async () => {
    setupSuccessfulTransaction()
    const timestamp = '2026-08-02T00:00:00.000Z'
    const library: LibraryState = {
      version: 1,
      words: {
        apple: { wordKey: 'apple', word: 'apple', senses: [{ id: 'sense-1', pos: 'n.', meaningZh: '蘋果', examples: [] }], updatedAt: timestamp },
      },
      sets: [{ id: 'set-1', setName: 'Fresh set', folderId: '__uncategorized__', createdAt: timestamp, updatedAt: timestamp }],
      memberships: { 'set-1': [{ wordKey: 'apple', senseIds: ['sense-1'] }] },
      folders: [{ id: '__uncategorized__', name: '未分類', parentId: undefined, order: -1, createdAt: timestamp, updatedAt: timestamp }],
      questions: [],
      updatedAt: timestamp,
    }

    const result = await writeCloudLibraryChunks({} as Firestore, 'cloud-user', library, new Map())

    expect(result.conflicted).toBe(false)
    expect(mockedCloud.runTransaction).toHaveBeenCalledTimes(1)
    expect(mockedCloud.sets).toHaveLength(6)
    for (const [, payload] of mockedCloud.sets)
      expect(JSON.parse(JSON.stringify(payload))).toEqual(payload)
  })

  it('uses the manifest revision as the compare-and-set boundary for the whole library', async () => {
    const timestamp = '2026-08-02T00:00:00.000Z'
    const library: LibraryState = {
      version: 1,
      words: {},
      sets: [],
      memberships: {},
      folders: [{ id: '__uncategorized__', name: '未分類', order: -1, createdAt: timestamp, updatedAt: timestamp }],
      questions: [],
      updatedAt: timestamp,
    }
    const remoteManifest = buildLibraryManifest('cloud-user', buildLibraryChunks('cloud-user', library), timestamp)
    setupSuccessfulTransaction(remoteManifest)

    const result = await writeCloudLibraryChunks({} as Firestore, 'cloud-user', library, new Map(), 'stale-revision')

    expect(result.conflicted).toBe(true)
    expect(mockedCloud.sets).toEqual([])
  })

  it('reads only a complete manifest-backed library snapshot', () => {
    const timestamp = '2026-08-02T00:00:00.000Z'
    const library: LibraryState = {
      version: 1,
      words: {},
      sets: [],
      memberships: {},
      folders: [{ id: '__uncategorized__', name: '未分類', order: -1, createdAt: timestamp, updatedAt: timestamp }],
      questions: [],
      updatedAt: timestamp,
    }
    const chunks = buildLibraryChunks('cloud-user', library)
    const manifest = buildLibraryManifest('cloud-user', chunks, timestamp)
    const docs = [
      { id: 'manifest', data: () => manifest },
      ...chunks.map(chunk => ({ id: chunk.chunkId, data: () => chunk })),
    ]

    expect(parseCloudLibrarySnapshot({ docs } as never, 'cloud-user')).toEqual({
      library,
      hashes: new Map(chunks.map(chunk => [chunk.chunkId, chunk.checksum])),
      revision: manifest.revision,
    })
    expect(() => parseCloudLibrarySnapshot({ docs: docs.slice(0, -1) } as never, 'cloud-user')).toThrow('manifest 與 chunks 不一致')
  })

  it('reads v5 manifest first and reports legacy v4 snapshots for upgrade', async () => {
    const timestamp = '2026-08-02T00:00:00.000Z'
    const library: LibraryState = {
      version: 1,
      words: {},
      sets: [],
      memberships: {},
      folders: [{ id: '__uncategorized__', name: '未分類', order: -1, createdAt: timestamp, updatedAt: timestamp }],
      questions: [],
      updatedAt: timestamp,
    }
    const v5Chunks = buildV5LibraryChunks('cloud-user', library)
    const v5Manifest = buildV5LibraryManifest('cloud-user', v5Chunks, timestamp)
    const calls: string[] = []
    setupSuccessfulTransaction()
    mockedCloud.getDocFromServer.mockImplementation(async (reference: { path?: string }) => {
      const id = reference.path?.split('/').at(-1) ?? ''
      calls.push(id)
      const data = id === 'manifest' ? v5Manifest : v5Chunks.find(chunk => chunk.chunkId === id)
      return { exists: () => Boolean(data), data: () => data }
    })

    const result = await readCloudLibraryV5({} as Firestore, 'cloud-user')

    expect(result.legacy).toBe(false)
    expect(calls[0]).toBe('manifest')
    expect(calls.slice(1)).toEqual(v5Chunks.map(chunk => chunk.chunkId))

    const v4Chunks = buildLibraryChunks('cloud-user', library)
    const v4Manifest = buildLibraryManifest('cloud-user', v4Chunks, timestamp)
    const legacyCalls: string[] = []
    const legacyProgress: Array<{ currentBatch: number, totalBatches: number, completed: number, total: number }> = []
    mockedCloud.getDocFromServer.mockImplementation(async (reference: { path?: string }) => {
      const id = reference.path?.split('/').at(-1) ?? ''
      legacyCalls.push(id)
      const data = id === 'manifest' ? v4Manifest : v4Chunks.find(chunk => chunk.chunkId === id)
      return { exists: () => Boolean(data), data: () => data }
    })

    const legacy = await readCloudLibraryV5({} as Firestore, 'cloud-user', value => legacyProgress.push(value))

    expect(legacy.legacy).toBe(true)
    expect(legacy.revision).toBe(v4Manifest.revision)
    expect(legacyCalls[0]).toBe('manifest')
    expect(legacyCalls.slice(1)).toEqual(v4Chunks.map(chunk => chunk.chunkId))
    expect(legacyProgress).toHaveLength(v4Chunks.length + 1)
    expect(legacyProgress[0]).toMatchObject({ currentBatch: 0, completed: 0, total: v4Chunks.length })
    expect(legacyProgress.every(item => item.completed <= item.total && item.totalBatches <= Math.ceil(v4Chunks.length / 8))).toBe(true)

    const resumedLegacyCalls: string[] = []
    mockedCloud.getDocFromServer.mockImplementation(async (reference: { path?: string }) => {
      const id = reference.path?.split('/').at(-1) ?? ''
      resumedLegacyCalls.push(id)
      const data = id === 'manifest' ? v4Manifest : v4Chunks.find(chunk => chunk.chunkId === id)
      return { exists: () => Boolean(data), data: () => data }
    })
    const resumedLegacy = await readCloudLibraryV5(
      {} as Firestore,
      'cloud-user',
      undefined,
      undefined,
      { existingChunks: new Map(v4Chunks.map(chunk => [chunk.chunkId, chunk])) },
    )
    expect(resumedLegacy.legacy).toBe(true)
    expect(resumedLegacy.library).toEqual(library)
    expect(resumedLegacyCalls).toEqual(['manifest'])
  })

  it('publishes v5 chunks only after strict batches of at most eight', async () => {
    const timestamp = '2026-08-02T00:00:00.000Z'
    const library: LibraryState = {
      version: 1,
      words: {},
      sets: [],
      memberships: {},
      folders: [{ id: '__uncategorized__', name: '未分類', order: -1, createdAt: timestamp, updatedAt: timestamp }],
      questions: [],
      updatedAt: timestamp,
    }
    setupSuccessfulTransaction()
    mockedCloud.getDocsFromServer.mockResolvedValue({ docs: [] })

    const result = await writeCloudLibraryChunksV5({} as Firestore, 'cloud-user', library, new Map())

    expect(result.conflicted).toBe(false)
    expect(mockedCloud.batchSets.length).toBeGreaterThan(0)
    expect(mockedCloud.batchSets.every(batch => batch.length <= 8)).toBe(true)
    expect(mockedCloud.sets.at(-1)?.[0]).toMatchObject({ path: expect.stringMatching(/\/library\/manifest$/) })
  })

  it('does not re-upload unchanged content-addressed chunks', async () => {
    const library = makeLargeLibrary(2)
    const chunks = buildV5LibraryChunks('cloud-user', library)
    const manifest = buildV5LibraryManifest('cloud-user', chunks, library.updatedAt)
    setupSuccessfulTransaction(manifest)
    mockedCloud.getDocsFromServer.mockResolvedValue({ docs: [] })

    const result = await writeCloudLibraryChunksV5(
      {} as Firestore,
      'cloud-user',
      library,
      new Map(chunks.map(chunk => [chunk.chunkId, chunk.checksum])),
      manifest.revision,
    )

    expect(result.conflicted).toBe(false)
    expect(mockedCloud.batchSets).toHaveLength(0)
    expect(mockedCloud.sets.at(-1)?.[0]).toMatchObject({ path: expect.stringMatching(/\/library\/manifest$/) })
  })

  it('reads and writes a large library in ordered groups of at most eight chunks', async () => {
    const library = makeLargeLibrary()
    const chunks = buildV5LibraryChunks('cloud-user', library)
    const manifest = buildV5LibraryManifest('cloud-user', chunks, library.updatedAt)
    expect(chunks.length).toBeGreaterThan(8)

    const readCalls: string[] = []
    const progress: Array<{ currentBatch: number, totalBatches: number, completed: number, total: number }> = []
    const stagedBatches: string[][] = []
    setupSuccessfulTransaction()
    mockedCloud.getDocFromServer.mockImplementation(async (reference: { path?: string }) => {
      const id = reference.path?.split('/').at(-1) ?? ''
      readCalls.push(id)
      const data = id === 'manifest' ? manifest : chunks.find(chunk => chunk.chunkId === id)
      return { exists: () => Boolean(data), data: () => data }
    })
    const read = await readCloudLibraryV5(
      {} as Firestore,
      'cloud-user',
      value => progress.push(value),
      (batch) => { stagedBatches.push(batch.chunks.map(chunk => chunk.chunkId)) },
    )
    expect(read.library.words).toHaveProperty('large-word-99')
    expect(readCalls[0]).toBe('manifest')
    expect(progress).toHaveLength(chunks.length + 1)
    expect(progress[0]).toMatchObject({ currentBatch: 0, completed: 0, total: chunks.length })
    expect(stagedBatches).toHaveLength(Math.ceil(chunks.length / 8))
    expect(stagedBatches.flat()).toEqual(chunks.map(chunk => chunk.chunkId))
    expect(stagedBatches.every(batch => batch.length <= 8)).toBe(true)
    expect(progress.every(item => item.totalBatches === Math.ceil(chunks.length / 8) && item.completed <= item.total)).toBe(true)
    expect(progress.every((item, index) => index === 0 || item.completed - progress[index - 1].completed === 1)).toBe(true)

    const resumedCalls: string[] = []
    mockedCloud.getDocFromServer.mockImplementation(async (reference: { path?: string }) => {
      const id = reference.path?.split('/').at(-1) ?? ''
      resumedCalls.push(id)
      const data = id === 'manifest' ? manifest : chunks.find(chunk => chunk.chunkId === id)
      return { exists: () => Boolean(data), data: () => data }
    })
    const resumed = await readCloudLibraryV5(
      {} as Firestore,
      'cloud-user',
      undefined,
      undefined,
      { existingChunks: new Map(chunks.map(chunk => [chunk.chunkId, chunk])) },
    )
    expect(resumed.library.words).toHaveProperty('large-word-99')
    expect(resumedCalls).toEqual(['manifest'])

    setupSuccessfulTransaction()
    mockedCloud.getDocsFromServer.mockResolvedValue({ docs: [] })
    const uploadProgress: Array<{ completed: number, total: number }> = []
    const written = await writeCloudLibraryChunksV5({} as Firestore, 'cloud-user', library, new Map(), '', progress => uploadProgress.push(progress))
    expect(written.conflicted).toBe(false)
    expect(mockedCloud.batchSets).toHaveLength(Math.ceil(chunks.length / 8))
    expect(mockedCloud.batchSets.every(batch => batch.length <= 8)).toBe(true)
    expect(mockedCloud.sets.at(-1)?.[0]).toMatchObject({ path: expect.stringMatching(/\/library\/manifest$/) })
    expect(uploadProgress[0]).toMatchObject({ completed: 0, total: chunks.length })
    expect(uploadProgress.at(-1)).toMatchObject({ completed: chunks.length, total: chunks.length })
  })
})

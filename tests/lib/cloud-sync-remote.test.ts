import type { Firestore } from 'firebase/firestore'
import type { LibraryState } from '@/types'
import { describe, expect, it, vi } from 'vitest'
import { defaultAiSettings } from '@/lib/ai-provider'
import { parseCloudLibrarySnapshot, writeCloudAiSettings, writeCloudLearningState, writeCloudLibraryChunks } from '@/lib/cloud-sync-remote'
import { buildLibraryChunks, buildLibraryManifest } from '@/lib/cloud-sync-schema'
import { createDefaultStats } from '@/lib/learning-defaults'

const mockedCloud = vi.hoisted(() => ({
  runTransaction: vi.fn(),
  sets: [] as unknown[][],
}))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((...segments: unknown[]) => ({ kind: 'collection', path: segments.join('/') })),
  doc: vi.fn((...segments: unknown[]) => ({ kind: 'document', path: segments.join('/') })),
  getDocsFromServer: vi.fn(),
  runTransaction: mockedCloud.runTransaction,
}))

vi.mock('@/lib/firebase', () => ({
  getFirebaseFirestore: vi.fn(() => ({})),
}))

function setupSuccessfulTransaction(currentManifest?: object) {
  mockedCloud.sets.length = 0
  mockedCloud.runTransaction.mockReset()
  mockedCloud.runTransaction.mockImplementation(async (_db: unknown, callback: (transaction: unknown) => Promise<unknown>) => callback({
    get: async (reference: { path?: string }) => {
      const data = reference.path?.endsWith('/library/manifest') ? currentManifest : undefined
      return { exists: () => Boolean(data), data: () => data }
    },
    set: (...args: unknown[]) => mockedCloud.sets.push(args),
    delete: vi.fn(),
  }))
}

describe('cloud sync remote repository', () => {
  it('writes learning documents through conditional writes', async () => {
    setupSuccessfulTransaction()
    const progress = { cards: {}, updatedAt: '2026-08-01T00:00:00.000Z' }
    const stats = createDefaultStats()

    const result = await writeCloudLearningState({} as Firestore, 'cloud-user', progress, stats, { progress: '', stats: '' })

    expect(result.progress).toEqual({ written: true })
    expect(result.stats).toEqual({ written: true })
    expect(mockedCloud.sets).toHaveLength(2)
    expect(mockedCloud.sets[0][1]).toMatchObject({ ownerId: 'cloud-user', schemaVersion: 4 })
    expect(mockedCloud.sets[1][1]).toMatchObject({ ownerId: 'cloud-user', schemaVersion: 4 })
  })

  it('keeps AI API keys out of Cloud payloads', async () => {
    setupSuccessfulTransaction()
    const result = await writeCloudAiSettings({} as Firestore, 'cloud-user', { ...defaultAiSettings, apiKey: 'device-secret', model: 'cloud-model' }, '')

    expect(result.result).toEqual({ written: true })
    expect(mockedCloud.sets).toHaveLength(1)
    expect(mockedCloud.sets[0][1]).not.toHaveProperty('apiKey')
    expect(mockedCloud.sets[0][1]).toMatchObject({ model: 'cloud-model', ownerId: 'cloud-user', schemaVersion: 4 })
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
})

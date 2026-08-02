import type { Firestore } from 'firebase/firestore'
import type { LibraryState } from '@/types'
import { describe, expect, it, vi } from 'vitest'
import { defaultAiSettings } from '@/lib/ai-provider'
import { writeCloudAiSettings, writeCloudLearningState, writeCloudLibraryChunks } from '@/lib/cloud-sync-remote'
import { createDefaultStats } from '@/lib/learning-defaults'

const mockedCloud = vi.hoisted(() => ({
  runTransaction: vi.fn(),
  sets: [] as unknown[][],
}))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((...segments: unknown[]) => ({ kind: 'collection', path: segments.join('/') })),
  doc: vi.fn((...segments: unknown[]) => ({ kind: 'document', path: segments.join('/') })),
  getDocs: vi.fn(),
  runTransaction: mockedCloud.runTransaction,
}))

vi.mock('@/lib/firebase', () => ({
  getFirebaseFirestore: vi.fn(() => ({})),
}))

function setupSuccessfulTransaction() {
  mockedCloud.sets.length = 0
  mockedCloud.runTransaction.mockReset()
  mockedCloud.runTransaction.mockImplementation(async (_db: unknown, callback: (transaction: unknown) => Promise<unknown>) => callback({
    get: async () => ({ exists: () => false, data: () => undefined }),
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
    expect(mockedCloud.sets[0][1]).toMatchObject({ ownerId: 'cloud-user', schemaVersion: 3 })
    expect(mockedCloud.sets[1][1]).toMatchObject({ ownerId: 'cloud-user', schemaVersion: 3 })
  })

  it('keeps AI API keys out of Cloud payloads', async () => {
    setupSuccessfulTransaction()
    const result = await writeCloudAiSettings({} as Firestore, 'cloud-user', { ...defaultAiSettings, apiKey: 'device-secret', model: 'cloud-model' }, '')

    expect(result.result).toEqual({ written: true })
    expect(mockedCloud.sets).toHaveLength(1)
    expect(mockedCloud.sets[0][1]).not.toHaveProperty('apiKey')
    expect(mockedCloud.sets[0][1]).toMatchObject({ model: 'cloud-model', ownerId: 'cloud-user', schemaVersion: 3 })
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
    expect(mockedCloud.sets).toHaveLength(5)
    for (const [, payload] of mockedCloud.sets)
      expect(JSON.parse(JSON.stringify(payload))).toEqual(payload)
  })
})

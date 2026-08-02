import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { AI_SETTINGS_KEY, LEARNING_STORAGE_KEY, LIBRARY_SYNC_PENDING_STORAGE_KEY } from '@/constants'
import { loadAiSettings } from '@/lib/ai-provider'
import { loadCloudOutbox } from '@/lib/cloud-sync-outbox-storage'
import { canonicalHash } from '@/lib/hash'
import { createDefaultStats } from '@/lib/learning-defaults'
import { buildSenseId } from '@/lib/library'
import { loadFromStorage, saveToStorage, setStorageNamespace } from '@/lib/persist'
import { useCloudSyncStore } from '@/stores/cloudSync'
import { useLearningStore } from '@/stores/learning'
import { useLibraryStore } from '@/stores/library'

const mockedCloud = vi.hoisted(() => ({
  authCallbacks: [] as Array<(user: { uid: string, displayName: string, email: string, photoURL: string } | null) => Promise<void>>,
  remoteSettings: null as Record<string, unknown> | null,
  transactionSets: [] as unknown[],
  transactionDocuments: new Map<string, unknown>(),
  libraryBatchCommits: 0,
  runTransaction: vi.fn(),
  serverSnapshotsEnabled: true,
}))

vi.mock('@vueuse/core', () => ({
  useOnline: () => ref(true),
  useDocumentVisibility: () => ref('visible'),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/lib/firebase', () => ({
  configureFirebaseAuth: vi.fn(async () => ({})),
  getFirebaseAuth: vi.fn(() => ({})),
  getFirebaseFirestore: vi.fn(() => ({})),
  isFirebaseConfigured: vi.fn(() => true),
}))

vi.mock('@/lib/googleIdentity', () => ({
  requestGoogleAccessToken: vi.fn(),
}))

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: { credential: vi.fn() },
  onAuthStateChanged: vi.fn((_auth, callback) => {
    mockedCloud.authCallbacks.push(callback)
    return vi.fn()
  }),
  signInWithCredential: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((...segments: unknown[]) => ({ kind: 'collection', path: segments.join('/') })),
  doc: vi.fn((...segments: unknown[]) => ({ kind: 'document', path: segments.join('/') })),
  documentId: vi.fn(() => '__name__'),
  getDocFromServer: vi.fn(async () => ({ exists: () => false, data: () => undefined })),
  getDocsFromServer: vi.fn(async () => ({ docs: [] })),
  limit: vi.fn((value: number) => ({ kind: 'limit', value })),
  onSnapshot: vi.fn((reference, optionsOrCallback, callbackOrError) => {
    const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : callbackOrError
    if (reference.kind === 'collection') {
      callback({
        docs: [{ id: 'stale-cache-chunk', data: () => ({ schemaVersion: 1, checksum: 'stale' }) }],
        metadata: { fromCache: true },
      })
      if (mockedCloud.serverSnapshotsEnabled)
        callback({ docs: [], metadata: { fromCache: false } })
    }
    else {
      callback({ exists: () => true, data: () => ({ schemaVersion: 1 }), metadata: { fromCache: true } })
      if (!mockedCloud.serverSnapshotsEnabled) {
        // Remain on the local IndexedDB/cache view until the server is reachable.
      }
      else if (reference.path.endsWith('/settings/ai') && mockedCloud.remoteSettings) {
        callback({
          exists: () => true,
          data: () => mockedCloud.remoteSettings,
          metadata: { fromCache: false },
        })
      }
      else {
        callback({ exists: () => false, data: () => undefined, metadata: { fromCache: false } })
      }
    }
    return vi.fn()
  }),
  orderBy: vi.fn((field: unknown) => ({ kind: 'orderBy', field })),
  query: vi.fn((...parts: unknown[]) => ({ kind: 'query', parts })),
  runTransaction: mockedCloud.runTransaction,
  startAfter: vi.fn((cursor: unknown) => ({ kind: 'startAfter', cursor })),
  writeBatch: vi.fn(() => ({
    set: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn(async () => { mockedCloud.libraryBatchCommits += 1 }),
  })),
}))

describe('cloud sync baseline rebase', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    mockedCloud.authCallbacks.length = 0
    mockedCloud.transactionSets.length = 0
    mockedCloud.transactionDocuments.clear()
    mockedCloud.libraryBatchCommits = 0
    mockedCloud.serverSnapshotsEnabled = true
    mockedCloud.remoteSettings = {
      enabled: true,
      provider: 'openai',
      baseUrl: '',
      model: 'cloud-model',
      batchSize: 10,
      ownerId: 'cloud-user',
      schemaVersion: 4,
    }
    mockedCloud.runTransaction.mockReset()
    mockedCloud.runTransaction.mockImplementation(async (_db: unknown, callback: (transaction: unknown) => Promise<unknown>) => {
      const transaction = {
        get: async (reference: { path?: string }) => reference.path?.endsWith('/settings/ai')
          ? { exists: () => true, data: () => mockedCloud.remoteSettings }
          : (() => {
              const data = mockedCloud.transactionDocuments.get(reference.path ?? '')
              return { exists: () => data !== undefined, data: () => data }
            })(),
        set: vi.fn((reference: { path?: string }, payload: unknown) => {
          mockedCloud.transactionSets.push([reference, payload])
          mockedCloud.transactionDocuments.set(reference.path ?? '', payload)
        }),
        delete: vi.fn((reference: { path?: string }) => {
          mockedCloud.transactionDocuments.delete(reference.path ?? '')
        }),
      }
      return callback(transaction)
    })

    const remoteShareable = { ...mockedCloud.remoteSettings }
    delete remoteShareable.ownerId
    delete remoteShareable.schemaVersion
    const pending = [{
      id: 'pending-settings',
      domain: 'settings',
      recordKey: 'settings:ai',
      baseHash: canonicalHash(remoteShareable),
      payload: { ...remoteShareable, model: 'local-model' },
      attempts: 0,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    }]
    await saveToStorage('lexiro_sync_outbox:cloud-user', pending)
  })

  afterEach(() => {
    vi.useRealTimers()
    setStorageNamespace('guest')
  })

  it('flushes accepted pending records after the Cloud baseline arrives', async () => {
    vi.useFakeTimers()
    const cloudStore = useCloudSyncStore()
    await cloudStore.init()
    expect(mockedCloud.authCallbacks).toHaveLength(1)

    await mockedCloud.authCallbacks[0]({ uid: 'cloud-user', displayName: 'Cloud', email: 'cloud@example.com', photoURL: '' })
    expect(cloudStore.pendingWrites).toBe(1)

    await vi.advanceTimersByTimeAsync(1200)

    expect(mockedCloud.transactionSets).toHaveLength(1)
    expect(cloudStore.pendingWrites).toBe(0)
    expect(cloudStore.status).toBe('synced')
  })

  it('persists a newly created set membership as a valid outbox record', async () => {
    const cloudStore = useCloudSyncStore()
    await cloudStore.init()
    await mockedCloud.authCallbacks[0]({ uid: 'cloud-user', displayName: 'Cloud', email: 'cloud@example.com', photoURL: '' })

    const libraryStore = useLibraryStore()
    const senseId = buildSenseId('apple', 'n.', '蘋果')
    libraryStore.createSetWithContent(
      'Fresh set',
      undefined,
      [{ wordKey: 'apple', word: 'apple', senses: [{ id: senseId, pos: 'n.', meaningZh: '蘋果', examples: [] }], updatedAt: '2026-08-02T00:00:00.000Z' }],
      [{ wordKey: 'apple', senseIds: [senseId] }],
    )
    await nextTick()

    const stored = await loadCloudOutbox('cloud-user')
    expect(stored).toContainEqual(expect.objectContaining({
      domain: 'library',
      recordKey: expect.stringMatching(/^membership:set-/),
      payload: [{ wordKey: 'apple', senseIds: [senseId] }],
    }))
  })

  it('queues offline account edits before a server baseline exists without flushing them', async () => {
    mockedCloud.serverSnapshotsEnabled = false
    const cloudStore = useCloudSyncStore()
    await cloudStore.init()
    await mockedCloud.authCallbacks[0]({ uid: 'cloud-user', displayName: 'Cloud', email: 'cloud@example.com', photoURL: '' })

    const libraryStore = useLibraryStore()
    const senseId = buildSenseId('offline', 'adj.', '離線的')
    libraryStore.createSetWithContent(
      'Offline set',
      undefined,
      [{ wordKey: 'offline', word: 'offline', senses: [{ id: senseId, pos: 'adj.', meaningZh: '離線的', examples: [] }], updatedAt: '2026-08-02T00:00:00.000Z' }],
      [{ wordKey: 'offline', senseIds: [senseId] }],
    )
    await nextTick()

    expect((await loadCloudOutbox('cloud-user')).some(entry => entry.recordKey.startsWith('membership:set-'))).toBe(true)
    expect(mockedCloud.runTransaction).not.toHaveBeenCalled()
    expect(cloudStore.status).toBe('connecting')
  })

  it('treats missing Cloud learning documents as an empty authoritative baseline', async () => {
    const cachedStats = createDefaultStats()
    cachedStats.xp = 42
    setStorageNamespace('cloud-user')
    await saveToStorage(LEARNING_STORAGE_KEY, {
      version: 1,
      progress: { cards: {}, updatedAt: 'cached-progress' },
      stats: cachedStats,
    })
    setStorageNamespace('guest')

    const cloudStore = useCloudSyncStore()
    await cloudStore.init()
    await mockedCloud.authCallbacks[0]({ uid: 'cloud-user', displayName: 'Cloud', email: 'cloud@example.com', photoURL: '' })
    await vi.waitFor(() => expect(cloudStore.status).toBe('synced'))
    await vi.waitFor(() => expect(cloudStore.appReady).toBe(true))

    const learningStore = useLearningStore()
    expect(learningStore.stats.xp).toBe(0)
    const stored = await loadFromStorage(LEARNING_STORAGE_KEY)
    expect(stored.value).toContain('"xp":0')
  })

  it('treats missing Cloud AI settings as an empty authoritative baseline', async () => {
    setStorageNamespace('cloud-user')
    await saveToStorage(AI_SETTINGS_KEY, {
      enabled: true,
      provider: 'openai',
      baseUrl: '',
      model: 'cached-model',
      batchSize: 10,
    })
    setStorageNamespace('guest')
    mockedCloud.remoteSettings = null
    await saveToStorage('lexiro_sync_outbox:cloud-user', [])

    const cloudStore = useCloudSyncStore()
    await cloudStore.init()
    await mockedCloud.authCallbacks[0]({ uid: 'cloud-user', displayName: 'Cloud', email: 'cloud@example.com', photoURL: '' })

    expect(loadAiSettings().enabled).toBe(false)
    expect(loadAiSettings().model).toBe('gpt-4o-mini')
  })

  it('does not restart cloud writes after choosing to continue offline', async () => {
    const cloudStore = useCloudSyncStore()
    await cloudStore.init()
    await mockedCloud.authCallbacks[0]({ uid: 'cloud-user', displayName: 'Cloud', email: 'cloud@example.com', photoURL: '' })

    mockedCloud.runTransaction.mockClear()
    cloudStore.continueOffline()

    expect(cloudStore.status).toBe('offline')
    expect(await cloudStore.syncNow()).toBe(true)
    expect(mockedCloud.runTransaction).not.toHaveBeenCalled()
  })

  it('uploads repository-only Library pending work after reconnect', async () => {
    setStorageNamespace('cloud-user')
    await saveToStorage(LIBRARY_SYNC_PENDING_STORAGE_KEY, { pending: true })
    await saveToStorage('lexiro_sync_outbox:cloud-user', [])
    setStorageNamespace('guest')
    mockedCloud.remoteSettings = null

    const cloudStore = useCloudSyncStore()
    await cloudStore.init()
    await mockedCloud.authCallbacks[0]({ uid: 'cloud-user', displayName: 'Cloud', email: 'cloud@example.com', photoURL: '' })

    await vi.waitFor(() => expect(mockedCloud.libraryBatchCommits).toBeGreaterThan(0))
    expect(cloudStore.pendingWrites).toBe(0)
    setStorageNamespace('cloud-user')
    expect((await loadFromStorage(LIBRARY_SYNC_PENDING_STORAGE_KEY)).value).toBe('')
  })

  it('keeps a learning edit made during upload in the outbox', async () => {
    vi.useFakeTimers()
    await saveToStorage('lexiro_sync_outbox:cloud-user', [])

    const cloudStore = useCloudSyncStore()
    await cloudStore.init()
    await mockedCloud.authCallbacks[0]({ uid: 'cloud-user', displayName: 'Cloud', email: 'cloud@example.com', photoURL: '' })
    await vi.waitFor(() => expect(cloudStore.status).toBe('synced'))
    await vi.waitFor(() => expect(cloudStore.appReady).toBe(true))

    const learningStore = useLearningStore()
    learningStore.replaceStats({ ...learningStore.stats, xp: 1 })
    await nextTick()
    expect((await loadCloudOutbox('cloud-user')).some(entry => entry.recordKey === 'stats:summary')).toBe(true)

    let releaseTransaction: (() => void) | undefined
    mockedCloud.runTransaction.mockImplementationOnce(async (_db: unknown, callback: (transaction: unknown) => Promise<unknown>) => new Promise((resolve, reject) => {
      releaseTransaction = () => {
        void callback({
          get: async () => ({ exists: () => false, data: () => undefined }),
          set: vi.fn((reference: { path?: string }, payload: unknown) => mockedCloud.transactionDocuments.set(reference.path ?? '', payload)),
          delete: vi.fn(),
        }).then(resolve, reject)
      }
    }))

    const upload = cloudStore.flushLearning()
    await vi.waitFor(() => expect(releaseTransaction).toBeTypeOf('function'))
    learningStore.replaceStats({ ...learningStore.stats, xp: 2 })
    await nextTick()
    await nextTick()
    expect(learningStore.stats.xp).toBe(2)
    expect((await loadCloudOutbox('cloud-user')).find(entry => entry.recordKey === 'stats:summary')?.payload).toMatchObject({ xp: 2 })
    releaseTransaction?.()
    await upload
    await nextTick()

    const outbox = await loadCloudOutbox('cloud-user')
    expect(outbox).toContainEqual(expect.objectContaining({
      domain: 'learning',
      recordKey: 'stats:summary',
      payload: expect.objectContaining({ xp: 2 }),
    }))
    vi.clearAllTimers()
  })

  it('keeps a Library edit made during manifest publication in the outbox', async () => {
    vi.useFakeTimers()
    await saveToStorage('lexiro_sync_outbox:cloud-user', [])

    const cloudStore = useCloudSyncStore()
    await cloudStore.init()
    await mockedCloud.authCallbacks[0]({ uid: 'cloud-user', displayName: 'Cloud', email: 'cloud@example.com', photoURL: '' })
    await vi.waitFor(() => expect(cloudStore.status).toBe('synced'))

    const libraryStore = useLibraryStore()
    const firstSenseId = buildSenseId('first', 'n.', '第一個')
    libraryStore.createSetWithContent(
      'First set',
      undefined,
      [{ wordKey: 'first', word: 'first', senses: [{ id: firstSenseId, pos: 'n.', meaningZh: '第一個', examples: [] }], updatedAt: '2026-08-02T00:00:00.000Z' }],
      [{ wordKey: 'first', senseIds: [firstSenseId] }],
    )
    await nextTick()
    await libraryStore.waitForPersistence()

    let releaseTransaction: (() => void) | undefined
    mockedCloud.runTransaction.mockImplementationOnce(async (_db: unknown, callback: (transaction: unknown) => Promise<unknown>) => new Promise((resolve, reject) => {
      releaseTransaction = () => {
        void callback({
          get: async () => ({ exists: () => false, data: () => undefined }),
          set: vi.fn((reference: { path?: string }, payload: unknown) => mockedCloud.transactionDocuments.set(reference.path ?? '', payload)),
          delete: vi.fn(),
        }).then(resolve, reject)
      }
    }))

    const upload = cloudStore.flushAll()
    await vi.waitFor(() => expect(releaseTransaction).toBeTypeOf('function'))
    const secondSenseId = buildSenseId('second', 'n.', '第二個')
    const secondSet = libraryStore.createSetWithContent(
      'Second set',
      undefined,
      [{ wordKey: 'second', word: 'second', senses: [{ id: secondSenseId, pos: 'n.', meaningZh: '第二個', examples: [] }], updatedAt: '2026-08-02T00:00:00.000Z' }],
      [{ wordKey: 'second', senseIds: [secondSenseId] }],
    )
    await nextTick()
    await libraryStore.waitForPersistence()
    releaseTransaction?.()
    await upload

    const outbox = await loadCloudOutbox('cloud-user')
    expect(outbox.some(entry => entry.domain === 'library' && entry.recordKey === `set:${secondSet.id}`)).toBe(true)
    vi.clearAllTimers()
  })

  it('does not let a stale account transition overwrite the newer namespace', async () => {
    mockedCloud.serverSnapshotsEnabled = false
    await saveToStorage('lexiro_sync_outbox:account-a', [{
      id: 'account-a-pending',
      domain: 'settings',
      recordKey: 'settings:ai',
      baseHash: '',
      payload: {
        enabled: true,
        provider: 'openai',
        baseUrl: '',
        model: 'account-a-model',
        batchSize: 10,
      },
      attempts: 0,
      createdAt: '2026-08-02T00:00:00.000Z',
      updatedAt: '2026-08-02T00:00:00.000Z',
    }])
    await saveToStorage('lexiro_sync_outbox:account-b', [])

    const pinia = createPinia()
    setActivePinia(pinia)
    const cloudStore = useCloudSyncStore(pinia)
    await cloudStore.init()
    const accountA = mockedCloud.authCallbacks[0]({ uid: 'account-a', displayName: 'A', email: 'a@example.com', photoURL: '' })
    const accountB = mockedCloud.authCallbacks[0]({ uid: 'account-b', displayName: 'B', email: 'b@example.com', photoURL: '' })
    await Promise.all([accountA, accountB])

    expect(cloudStore.user?.uid).toBe('account-b')
    expect(cloudStore.pendingWrites).toBe(0)
    setStorageNamespace('account-b')
    expect((await loadFromStorage(LIBRARY_SYNC_PENDING_STORAGE_KEY)).value).not.toBe('{"pending":true}')
  })
})

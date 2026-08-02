import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { AI_SETTINGS_KEY, LEARNING_STORAGE_KEY } from '@/constants'
import { loadAiSettings } from '@/lib/ai-provider'
import { stableHash } from '@/lib/hash'
import { createDefaultStats } from '@/lib/learning-defaults'
import { loadFromStorage, saveToStorage, setStorageNamespace } from '@/lib/persist'
import { useCloudSyncStore } from '@/stores/cloudSync'
import { useLearningStore } from '@/stores/learning'

const mockedCloud = vi.hoisted(() => ({
  authCallbacks: [] as Array<(user: { uid: string, displayName: string, email: string, photoURL: string }) => Promise<void>>,
  remoteSettings: null as Record<string, unknown> | null,
  transactionSets: [] as unknown[],
  runTransaction: vi.fn(),
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
  getDocs: vi.fn(async () => ({ docs: [] })),
  onSnapshot: vi.fn((reference, callback) => {
    if (reference.kind === 'collection') {
      callback({ docs: [] })
    }
    else if (reference.path.endsWith('/settings/ai') && mockedCloud.remoteSettings) {
      callback({
        exists: () => true,
        data: () => mockedCloud.remoteSettings,
      })
    }
    else {
      callback({ exists: () => false, data: () => undefined })
    }
    return vi.fn()
  }),
  runTransaction: mockedCloud.runTransaction,
}))

describe('cloud sync baseline rebase', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    mockedCloud.authCallbacks.length = 0
    mockedCloud.transactionSets.length = 0
    mockedCloud.remoteSettings = {
      enabled: true,
      provider: 'openai',
      baseUrl: '',
      model: 'cloud-model',
      batchSize: 10,
      ownerId: 'cloud-user',
      schemaVersion: 3,
    }
    mockedCloud.runTransaction.mockReset()
    mockedCloud.runTransaction.mockImplementation(async (_db: unknown, callback: (transaction: unknown) => Promise<unknown>) => {
      const transaction = {
        get: async () => ({ exists: () => true, data: () => mockedCloud.remoteSettings }),
        set: vi.fn((...args: unknown[]) => mockedCloud.transactionSets.push(args)),
        delete: vi.fn(),
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
      baseHash: stableHash(remoteShareable),
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

    const cloudStore = useCloudSyncStore()
    await cloudStore.init()
    await mockedCloud.authCallbacks[0]({ uid: 'cloud-user', displayName: 'Cloud', email: 'cloud@example.com', photoURL: '' })

    expect(loadAiSettings().enabled).toBe(false)
    expect(loadAiSettings().model).toBe('gpt-4o-mini')
  })
})

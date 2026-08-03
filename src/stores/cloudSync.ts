import type { Auth, User } from 'firebase/auth'
import type { Unsubscribe } from 'firebase/firestore'
import type { SyncOutboxEntry, SyncRecords } from '@/lib/sync-outbox'
import type { AiSettings, DashboardStats, LearningProgress, LibraryState, SyncProgressState, SyncStatus } from '@/types'
import { useDocumentVisibility, useOnline } from '@vueuse/core'
import { GoogleAuthProvider, onAuthStateChanged, signInWithCredential, signOut } from 'firebase/auth'
import { getDocFromServer, onSnapshot } from 'firebase/firestore'
import { defineStore } from 'pinia'
import { computed, nextTick, ref, watch } from 'vue'
import { LIBRARY_SYNC_PENDING_STORAGE_KEY } from '@/constants'
import { defaultAiSettings, getShareableAiSettings, loadAiSettings, loadAiSettingsState, onAiSettingsChanged, saveAiSettings, waitForAiSettingsPersistence } from '@/lib/ai-provider'
import { CloudSyncError, isRetryableSyncError, syncErrorDetails } from '@/lib/cloud-sync-errors'
import { loadCloudOutbox, saveCloudOutbox } from '@/lib/cloud-sync-outbox-storage'
import { reconcileAiSettingsState, reconcileLearningState, reconcileLibraryState } from '@/lib/cloud-sync-reconcile'
import { cloudDocument, emptyCloudLibrary, emptyCloudProgress, emptyCloudStats, requireCloudFirestore, writeCloudAiSettings, writeCloudLearningState, writeCloudLibraryChunksV5 } from '@/lib/cloud-sync-remote'
import { normalizeCloudAiSettings, normalizeCloudProgress, normalizeCloudStats } from '@/lib/cloud-sync-schema'
import { configureFirebaseAuth, getFirebaseAuth, isFirebaseConfigured } from '@/lib/firebase'
import { requestGoogleAccessToken } from '@/lib/googleIdentity'
import { canonicalHash } from '@/lib/hash'
import { i18n } from '@/lib/i18n'
import { mergeLibraryStates } from '@/lib/library-merge'
import { getLibraryRepository } from '@/lib/library-repository'
import { stageCloudLibrary } from '@/lib/library-sync-staging'
import { loadFromStorage, saveToStorage, setStorageNamespace } from '@/lib/persist'
import { normalizeLibraryState } from '@/lib/share'
import { hasOutboxDomain, incrementOutboxAttempts, learningRecords, libraryRecords, queueRecordChanges, removeOutboxDomain, settingsRecords } from '@/lib/sync-outbox'
import { withSyncTimeout } from '@/lib/sync-timeout'
import { useAccountStore } from './account'
import { useLearningStore } from './learning'
import { useLibraryStore } from './library'
import { useSessionStore } from './session'
import { useSetsStore } from './sets'
import { useUIStore } from './ui'

export const useCloudSyncStore = defineStore('cloudSync', () => {
  const configured = ref(isFirebaseConfigured())
  const accountStore = useAccountStore()
  const authReady = ref(false)
  const user = ref<User | null>(null)
  const status = ref<SyncStatus>(configured.value ? 'signed-out' : 'disabled')
  const error = ref('')
  const lastSyncedAt = ref('')
  const pendingWrites = ref(0)
  const operationBlocked = ref(false)
  const outbox = ref<SyncOutboxEntry[]>([])
  const progress = ref<SyncProgressState>({
    phase: configured.value ? 'preparing' : 'synced',
    direction: 'idle',
    completed: 0,
    total: 0,
    percent: configured.value ? 0 : 100,
    message: configured.value ? i18n.global.t('sync.connecting') : i18n.global.t('sync.notConfigured'),
    retryable: false,
    currentBatch: 0,
    totalBatches: 0,
    pendingWrites: 0,
  })
  const appReady = ref(!configured.value)

  let libraryUnsubscribe: Unsubscribe | null = null
  let progressUnsubscribe: Unsubscribe | null = null
  let statsUnsubscribe: Unsubscribe | null = null
  let aiSettingsUnsubscribe: Unsubscribe | null = null
  let started = false
  let activeUid = ''
  let realtimeUid = ''
  let realtimeEpoch = 0
  let applyingRemote = false
  let libraryBaselineReady = false
  let progressBaselineReady = false
  let statsBaselineReady = false
  let aiSettingsBaselineReady = false
  let libraryDirty = false
  let learningDirty = false
  let libraryLocalChangeVersion = 0
  let learningLocalChangeVersion = 0
  let knownProgressHash = ''
  let knownStatsHash = ''
  const knownLibraryHashes = new Map<string, string>()
  let knownLibraryRevision = ''
  let libraryNeedsUpgrade = false
  let baselineLibraryRecords: SyncRecords = {}
  let observedLibraryRecords: SyncRecords = {}
  let observedLibraryHydrationVersion = 0
  let baselineLearningRecords: SyncRecords = {}
  let observedLearningRecords: SyncRecords = {}
  let remoteProgress: LearningProgress | null = null
  let remoteStats: DashboardStats | null = null
  let aiSettingsDirty = false
  let aiSettingsLocalChangeVersion = 0
  let baselineAiSettingsRecords: SyncRecords = {}
  let observedAiSettingsRecords: SyncRecords = {}
  let knownAiSettingsHash = ''
  const isOnline = useOnline()
  const visibility = useDocumentVisibility()
  let initialSyncWork: Promise<void> | null = null
  let automaticRemoteSync: Promise<boolean> | null = null
  let syncQueue: Promise<void> = Promise.resolve()
  let initialSnapshotObserved = false
  let initialRealtimeLoading = false
  let manualOfflineMode = false
  const remoteUpdateAvailable = ref(false)
  type RemoteSyncDomain = 'library' | 'learning' | 'settings'
  const pendingRemoteDomains = new Set<RemoteSyncDomain>()
  let outboxPersistencePromise: Promise<void> = Promise.resolve()
  let libraryRepositoryPending = false
  let libraryChangeQueue: Promise<void> = Promise.resolve()
  let authTransitionVersion = 0
  let namespaceSwitchQueue: Promise<void> = Promise.resolve()

  const isSignedIn = computed(() => Boolean(user.value))
  const accountLabel = computed(() => user.value?.displayName || user.value?.email || '')

  function markRemoteUpdate(domain: RemoteSyncDomain, available: boolean) {
    if (available)
      pendingRemoteDomains.add(domain)
    else
      pendingRemoteDomains.delete(domain)
    remoteUpdateAvailable.value = pendingRemoteDomains.size > 0
    if (available) {
      scheduleRemoteSync()
    }
  }

  function scheduleRemoteSync() {
    if (!remoteUpdateAvailable.value
      || automaticRemoteSync
      || !user.value
      || !isOnline.value
      || manualOfflineMode
      || !appReady.value
      || !allInitialBaselinesReady()) {
      return
    }

    operationBlocked.value = true
    setProgressPhase('preparing', i18n.global.t('sync.autoUpdating'), { direction: 'download', retryable: false })
    const work = (async () => {
      try {
        const synced = await syncNow()
        if (synced && status.value === 'synced') {
          operationBlocked.value = false
          return true
        }
        if (!synced && status.value !== 'error' && status.value !== 'offline')
          setError(new Error('Cloud synchronization did not complete'))
        return synced
      }
      catch (syncError) {
        handleSyncError(syncError)
        return false
      }
    })()
    automaticRemoteSync = work
    void work.finally(() => {
      automaticRemoteSync = null
      if (remoteUpdateAvailable.value)
        scheduleRemoteSync()
    }).catch(() => undefined)
  }

  function pendingWriteCount(): number {
    return outbox.value.length + (libraryRepositoryPending ? 1 : 0)
  }

  function isCurrentSync(uid: string, epoch: number): boolean {
    return activeUid === uid && user.value?.uid === uid && realtimeEpoch === epoch
  }

  function updateProgress(patch: Partial<SyncProgressState>) {
    const next = { ...progress.value, ...patch }
    const total = Math.max(0, next.total)
    const calculated = total > 0 ? Math.round(Math.min(100, (next.completed / total) * 100)) : next.phase === 'synced' ? 100 : next.phase === 'preparing' ? 0 : next.percent
    next.percent = calculated
    next.pendingWrites = pendingWrites.value
    progress.value = next
  }

  function setProgressPhase(phase: SyncProgressState['phase'], message: string, patch: Partial<SyncProgressState> = {}) {
    const reset = phase !== progress.value.phase
      ? { completed: 0, total: 0, percent: 0, currentBatch: 0, totalBatches: 0 }
      : {}
    updateProgress({ ...reset, phase, message, ...patch })
  }

  function allInitialBaselinesReady(): boolean {
    return libraryBaselineReady && progressBaselineReady && statsBaselineReady && aiSettingsBaselineReady
  }

  async function maybeCompleteInitialSync() {
    if (!user.value || !isOnline.value || appReady.value || !allInitialBaselinesReady() || initialSyncWork)
      return
    const syncUid = user.value.uid
    const syncEpoch = realtimeEpoch
    const work = (async () => {
      if (syncEpoch !== realtimeEpoch || user.value?.uid !== syncUid)
        return
      setProgressPhase('reconciling', i18n.global.t('sync.reconciling'))
      await enqueueSync(flushAll)
      if (syncEpoch !== realtimeEpoch || user.value?.uid !== syncUid)
        return
      await useLibraryStore().waitForPersistence()
      await nextTick()
      await libraryChangeQueue.catch(() => undefined)
      await waitForLocalPersistence()
      if (status.value === 'error')
        return
      setProgressPhase('verifying', i18n.global.t('sync.verifying'))
      if (outbox.value.length > 0
        || libraryRepositoryPending
        || libraryDirty
        || learningDirty
        || aiSettingsDirty
        || hasOutboxDomain(outbox.value, 'library')
        || hasOutboxDomain(outbox.value, 'learning')
        || hasOutboxDomain(outbox.value, 'settings')) {
        setStatus('error')
        setProgressPhase('error', i18n.global.t('sync.error'), { retryable: true })
        return
      }
      setStatus('synced')
      setProgressPhase('synced', i18n.global.t('sync.synced'), { completed: 1, total: 1, direction: 'idle', retryable: false })
      appReady.value = true
      operationBlocked.value = false
    })().catch((syncError) => {
      if (syncEpoch === realtimeEpoch && user.value?.uid === syncUid)
        handleSyncError(syncError)
    })
    const trackedWorkRef: { value?: Promise<void> } = {}
    const trackedWork = work.finally(() => {
      if (initialSyncWork === trackedWorkRef.value)
        initialSyncWork = null
    })
    trackedWorkRef.value = trackedWork
    initialSyncWork = trackedWork
  }

  async function loadOutbox(uid: string, isCurrent?: () => boolean): Promise<boolean> {
    const next = await loadCloudOutbox(uid)
    if (isCurrent && !isCurrent())
      return false
    outbox.value = next
    pendingWrites.value = outbox.value.length
    outboxPersistencePromise = Promise.resolve()
    updateProgress({ pendingWrites: pendingWrites.value })
    return true
  }

  async function loadLibraryRepositoryPending(isCurrent?: () => boolean): Promise<boolean> {
    const marker = await loadFromStorage(LIBRARY_SYNC_PENDING_STORAGE_KEY)
    if (isCurrent && !isCurrent())
      return false
    if (!marker.value) {
      libraryRepositoryPending = false
    }
    else {
      try {
        const parsed = JSON.parse(marker.value) as { pending?: boolean }
        libraryRepositoryPending = parsed.pending === true
      }
      catch {
        libraryRepositoryPending = false
      }
    }
    pendingWrites.value = pendingWriteCount()
    updateProgress({ pendingWrites: pendingWrites.value })
    return true
  }

  async function startAccountSync(uid: string) {
    const transitionVersion = authTransitionVersion
    const isCurrentAccount = () => transitionVersion === authTransitionVersion && activeUid === uid && user.value?.uid === uid
    if (!isCurrentAccount())
      return
    try {
      manualOfflineMode = false
      appReady.value = !isOnline.value
      if (isOnline.value)
        setProgressPhase('preparing', i18n.global.t('sync.connecting'), { direction: 'download', completed: 0, total: 0, retryable: false })
      if (!await loadOutbox(uid, isCurrentAccount) || !await loadLibraryRepositoryPending(isCurrentAccount) || !isCurrentAccount())
        return
      if (!isOnline.value) {
        clearListeners()
        setStatus('offline')
        setProgressPhase('offline', i18n.global.t('sync.offline'), { direction: 'idle', retryable: true })
        appReady.value = true
        return
      }
      // Keep auth/online callbacks responsive when the network has not
      // delivered a server snapshot yet. Test/local Firestore adapters can
      // deliver the first server snapshot synchronously, so wait for that
      // already-started ordered pass when it is observable immediately.
      const initialWork = startRealtime(uid)
      await Promise.resolve()
      if (!isCurrentAccount())
        return
      if (initialSnapshotObserved && await settlesImmediately(initialWork)) {
        await initialWork
        if (isCurrentAccount())
          void maybeCompleteInitialSync()
      }
      else {
        void initialWork.then(() => {
          if (isCurrentAccount())
            void maybeCompleteInitialSync()
        }).catch((syncError) => {
          if (isCurrentAccount())
            handleSyncError(syncError)
        })
      }
    }
    catch (syncError) {
      if (isCurrentAccount())
        handleSyncError(syncError)
    }
  }

  function persistOutbox() {
    pendingWrites.value = pendingWriteCount()
    const write = saveCloudOutbox(activeUid, outbox.value)
    const next = Promise.all([outboxPersistencePromise.catch(() => undefined), write]).then(() => undefined)
    outboxPersistencePromise = next
    void next.catch(handleSyncError)
  }

  function replaceOutbox(next: SyncOutboxEntry[]) {
    outbox.value = next
    persistOutbox()
    updateProgress({ pendingWrites: next.length })
  }

  async function switchLocalNamespace(namespace: string, isCurrent?: () => boolean): Promise<boolean> {
    const previous = namespaceSwitchQueue
    const run = previous.catch(() => undefined).then(async () => {
      if (isCurrent && !isCurrent())
        return false
      setStorageNamespace(namespace)
      const setsStore = useSetsStore()
      const libraryStore = useLibraryStore()
      const learningStore = useLearningStore()
      const sessionStore = useSessionStore()
      setsStore.resetForNamespace()
      libraryStore.resetForNamespace()
      learningStore.resetForNamespace()
      sessionStore.resetForNamespace()
      await libraryStore.loadState()
      await learningStore.loadState()
      await sessionStore.loadState()
      await loadAiSettingsState()
      return !isCurrent || isCurrent()
    })
    namespaceSwitchQueue = run.then(() => undefined, () => undefined)
    return run
  }

  function userDocument(uid: string, collectionName: string, id: string) {
    return cloudDocument(requireCloudFirestore(), uid, collectionName, id)
  }

  function clearListeners() {
    realtimeEpoch += 1
    libraryUnsubscribe?.()
    progressUnsubscribe?.()
    statsUnsubscribe?.()
    aiSettingsUnsubscribe?.()
    libraryUnsubscribe = null
    progressUnsubscribe = null
    statsUnsubscribe = null
    aiSettingsUnsubscribe = null
    realtimeUid = ''
    pendingRemoteDomains.clear()
    remoteUpdateAvailable.value = false
  }

  function setStatus(next: SyncStatus) {
    status.value = next
    if (next === 'offline')
      setProgressPhase('offline', i18n.global.t('sync.offline'), { direction: 'idle' })
    else if (next === 'error')
      setProgressPhase('error', i18n.global.t('sync.error'), { retryable: true })
  }

  function withRemoteApplication<T>(operation: () => T): T {
    applyingRemote = true
    try {
      return operation()
    }
    finally {
      applyingRemote = false
    }
  }

  async function withRemoteApplicationAsync<T>(operation: () => Promise<T>): Promise<T> {
    applyingRemote = true
    try {
      return await operation()
    }
    finally {
      applyingRemote = false
    }
  }

  function explainSyncError(error: unknown): string {
    const details = syncErrorDetails(error)
    const translationKeys = {
      'aborted': 'sync.errorAborted',
      'app-check': 'sync.errorAppCheck',
      'auth': 'sync.errorAuth',
      'blocked-client': 'sync.errorBlockedByClient',
      'cloud-data': 'sync.errorCloudData',
      'cloud-schema': 'sync.errorCloudSchema',
      'network': 'sync.errorNetwork',
      'not-configured': 'sync.firebaseNotConfigured',
      'outbox': 'sync.errorOutbox',
      'permission': 'sync.errorPermission',
      'persistence': 'sync.errorPersistence',
      'resource': 'sync.errorResource',
      'timeout': 'sync.errorTimeout',
    } as const
    if (details.kind === 'unknown')
      return i18n.global.t('sync.errorUnknown', { code: details.code })
    return i18n.global.t(translationKeys[details.kind])
  }

  function setError(syncError: unknown) {
    error.value = explainSyncError(syncError)
    status.value = 'error'
    setProgressPhase('error', error.value, { retryable: operationBlocked.value || isRetryableSyncError(syncError), direction: 'idle' })
  }

  function handleSyncError(syncError: unknown) {
    const details = syncErrorDetails(syncError)
    console.error('[Cloud Sync] operation failed', {
      code: details.code,
      kind: details.kind,
      message: details.message,
      error: syncError,
    })
    setError(syncError)
    clearListeners()
  }

  async function settlesImmediately(work: Promise<void>, maxMicrotasks = 10_000): Promise<boolean> {
    let settled = false
    void work.then(
      () => { settled = true },
      () => { settled = true },
    )
    for (let index = 0; index < maxMicrotasks; index += 1) {
      await Promise.resolve()
      if (settled)
        break
    }
    return settled
  }

  const handleRealtimeError = handleSyncError

  function markSynced() {
    lastSyncedAt.value = new Date().toISOString()
    pendingWrites.value = pendingWriteCount()
    if (isOnline.value)
      status.value = 'synced'
    if (!initialRealtimeLoading) {
      const hasPendingChanges = pendingWrites.value > 0
        || libraryRepositoryPending
        || libraryDirty
        || learningDirty
        || aiSettingsDirty
      if (!operationBlocked.value && !hasPendingChanges)
        setProgressPhase('synced', i18n.global.t('sync.synced'), { completed: 1, total: 1, direction: 'idle', retryable: false })
      void maybeCompleteInitialSync()
    }
  }

  async function reconcileLibraryRemote(remote: LibraryState, stagingGeneration?: string, isCurrent?: () => boolean): Promise<void> {
    if (isCurrent && !isCurrent())
      return
    const normalizedRemote = normalizeLibraryState(remote)
    const reconciled = reconcileLibraryState(normalizedRemote, outbox.value)
    let merged = reconciled.merged
    if (libraryRepositoryPending) {
      const local = await getLibraryRepository().loadState()
      if (isCurrent && !isCurrent())
        return
      // A repository-level import may have happened while offline, without
      // creating one reactive outbox record per payload. Treat that complete
      // local generation as the first input so local commits win while new
      // remote records are still merged in.
      merged = mergeLibraryStates(local, reconciled.merged).state
    }
    if (isCurrent && !isCurrent())
      return
    const result = {
      ...reconciled,
      merged,
      observedRecords: libraryRecords(merged),
      dirty: reconciled.dirty || libraryRepositoryPending,
    }
    const libraryStore = useLibraryStore()
    if (isCurrent && !isCurrent())
      return
    const canActivateStaged = Boolean(!libraryRepositoryPending && stagingGeneration && canonicalHash(result.merged) === canonicalHash(normalizedRemote))
    if (canActivateStaged) {
      await withRemoteApplicationAsync(() => libraryStore.activateStagedRemoteState(stagingGeneration!, result.merged, { preserveHydratedSets: true }))
    }
    else if (canonicalHash(result.merged) !== canonicalHash(libraryStore.state)) {
      await withRemoteApplicationAsync(() => libraryStore.activateRemoteState(result.merged, { preserveHydratedSets: true }))
    }
    if (isCurrent && !isCurrent())
      return
    // Remote activation changes the content hydration generation while the
    // watcher is intentionally muted. Advance the observed marker here so
    // the next user edit is queued instead of being mistaken for hydration.
    observedLibraryHydrationVersion = libraryStore.hydrationVersion
    baselineLibraryRecords = result.baselineRecords
    observedLibraryRecords = result.observedRecords
    replaceOutbox([...removeOutboxDomain(outbox.value, 'library'), ...result.accepted])
    libraryDirty = result.dirty
  }

  async function refreshLibraryRemote(uid: string, isCurrent?: () => boolean) {
    const remote = await stageCloudLibrary({ db: requireCloudFirestore(), uid })
    if (isCurrent && !isCurrent())
      return
    await reconcileLibraryRemote(remote.library, remote.stagingGeneration, isCurrent)
    if (isCurrent && !isCurrent())
      return
    libraryNeedsUpgrade = remote.legacy
    knownLibraryHashes.clear()
    for (const [chunkId, checksum] of remote.hashes)
      knownLibraryHashes.set(chunkId, checksum)
    knownLibraryRevision = remote.revision
    markRemoteUpdate('library', false)
  }

  async function refreshSecondaryRemote(uid: string, isCurrent?: () => boolean) {
    const db = requireCloudFirestore()
    const [progressSnapshot, statsSnapshot, settingsSnapshot] = await Promise.all([
      withSyncTimeout(getDocFromServer(cloudDocument(db, uid, 'progress', 'global')), 'Learning progress refresh'),
      withSyncTimeout(getDocFromServer(cloudDocument(db, uid, 'stats', 'summary')), 'Learning stats refresh'),
      withSyncTimeout(getDocFromServer(cloudDocument(db, uid, 'settings', 'ai')), 'AI settings refresh'),
    ])
    if (isCurrent && !isCurrent())
      return
    remoteProgress = progressSnapshot.exists() ? normalizeCloudProgress(progressSnapshot.data(), uid) : emptyCloudProgress()
    remoteStats = statsSnapshot.exists() ? normalizeCloudStats(statsSnapshot.data(), uid) : emptyCloudStats()
    reconcileLearningRemote(remoteProgress, remoteStats)
    knownProgressHash = progressSnapshot.exists() ? canonicalHash(remoteProgress) : ''
    knownStatsHash = statsSnapshot.exists() ? canonicalHash(remoteStats) : ''

    const remoteSettings = settingsSnapshot.exists() ? normalizeCloudAiSettings(settingsSnapshot.data(), uid) : null
    reconcileAiSettingsRemote(remoteSettings)
    markRemoteUpdate('learning', false)
    markRemoteUpdate('settings', false)
  }

  function reconcileLearningRemote(progress: LearningProgress, stats: DashboardStats) {
    if (!progressBaselineReady || !statsBaselineReady)
      return
    const result = reconcileLearningState(progress, stats, outbox.value)
    const learningStore = useLearningStore()
    if (canonicalHash(result.merged.progress) !== canonicalHash(learningStore.progress)) {
      withRemoteApplication(() => {
        learningStore.replaceProgress(result.merged.progress)
      })
    }
    if (canonicalHash(result.merged.stats) !== canonicalHash(learningStore.stats)) {
      withRemoteApplication(() => {
        learningStore.replaceStats(result.merged.stats)
      })
    }
    baselineLearningRecords = result.baselineRecords
    observedLearningRecords = result.observedRecords
    replaceOutbox([...removeOutboxDomain(outbox.value, 'learning'), ...result.accepted])
    learningDirty = result.dirty
  }

  function reconcileAiSettingsRemote(remote: Omit<AiSettings, 'apiKey'> | null) {
    if (!aiSettingsBaselineReady)
      return
    const localSettings = loadAiSettings()
    const result = reconcileAiSettingsState(remote, localSettings, outbox.value)
    if (canonicalHash(getShareableAiSettings(result.merged)) !== canonicalHash(getShareableAiSettings(localSettings))) {
      withRemoteApplication(() => {
        saveAiSettings(result.merged)
      })
    }
    baselineAiSettingsRecords = result.baselineRecords
    observedAiSettingsRecords = result.observedRecords
    knownAiSettingsHash = canonicalHash(remote ?? null)
    replaceOutbox([...removeOutboxDomain(outbox.value, 'settings'), ...result.accepted])
    aiSettingsDirty = result.dirty
  }

  async function applyRemoteLibraryChanges(uid: string): Promise<void> {
    const epoch = realtimeEpoch
    setProgressPhase('downloading', i18n.global.t('sync.fetchingManifest'), { direction: 'download' })
    let initialSettled = false
    let resolveInitial: (() => void) | null = null
    let rejectInitial: ((error: unknown) => void) | null = null
    const initial = new Promise<void>((resolve, reject) => {
      resolveInitial = resolve
      rejectInitial = reject
    })
    let snapshotQueue: Promise<void> = Promise.resolve()
    const finishInitial = () => {
      if (initialSettled)
        return
      initialSettled = true
      resolveInitial?.()
    }
    const fail = (syncError: unknown) => {
      if (!initialSettled) {
        initialSettled = true
        rejectInitial?.(syncError)
      }
      else {
        handleRealtimeError(syncError)
      }
    }
    try {
      libraryUnsubscribe = onSnapshot(userDocument(uid, 'library', 'manifest'), { includeMetadataChanges: true }, (snapshot) => {
        if (epoch !== realtimeEpoch) {
          finishInitial()
          return
        }
        if (snapshot.metadata.fromCache)
          return
        initialSnapshotObserved = true
        snapshotQueue = snapshotQueue.catch(() => undefined).then(async () => {
          if (epoch !== realtimeEpoch) {
            finishInitial()
            return
          }
          try {
            if (libraryBaselineReady) {
              const remoteRevision = snapshot.exists() && typeof snapshot.data().revision === 'string'
                ? snapshot.data().revision as string
                : ''
              markRemoteUpdate('library', remoteRevision !== knownLibraryRevision)
              finishInitial()
              return
            }
            if (!snapshot.exists()) {
              await reconcileLibraryRemote(normalizeLibraryState(emptyCloudLibrary()), undefined, () => epoch === realtimeEpoch && user.value?.uid === uid)
              if (epoch !== realtimeEpoch || user.value?.uid !== uid) {
                finishInitial()
                return
              }
              libraryBaselineReady = true
              libraryNeedsUpgrade = false
              knownLibraryHashes.clear()
              knownLibraryRevision = ''
              markRemoteUpdate('library', false)
              updateProgress({ completed: 1, total: 1, currentBatch: 0, totalBatches: 0 })
              markSynced()
              finishInitial()
              return
            }
            const remote = await stageCloudLibrary({
              db: requireCloudFirestore(),
              uid,
              manifestData: snapshot.data(),
              onProgress: (batch) => {
                if (epoch !== realtimeEpoch)
                  return
                updateProgress({ phase: 'downloading', message: i18n.global.t('sync.downloadingLibrary'), direction: 'download', completed: batch.completed, total: batch.total, currentBatch: batch.currentBatch, totalBatches: batch.totalBatches })
              },
            })
            if (epoch !== realtimeEpoch) {
              finishInitial()
              return
            }
            setProgressPhase('reconciling', i18n.global.t('sync.applyingLibrary'), { direction: 'download', completed: 0, total: 1 })
            await reconcileLibraryRemote(remote.library, remote.stagingGeneration, () => epoch === realtimeEpoch && user.value?.uid === uid)
            if (epoch !== realtimeEpoch || user.value?.uid !== uid) {
              finishInitial()
              return
            }
            libraryBaselineReady = true
            updateProgress({ completed: 1, total: 1, currentBatch: 0, totalBatches: 0 })
            knownLibraryHashes.clear()
            for (const [chunkId, checksum] of remote.hashes)
              knownLibraryHashes.set(chunkId, checksum)
            knownLibraryRevision = remote.revision
            libraryNeedsUpgrade = remote.legacy
            markRemoteUpdate('library', false)
            markSynced()
            finishInitial()
          }
          catch (syncError) {
            fail(syncError)
          }
        })
        void snapshotQueue.catch(fail)
      }, fail)
    }
    catch (syncError) {
      fail(syncError)
    }
    await withSyncTimeout(initial, 'Library server snapshot')
  }

  async function applyRemoteLearningChanges(uid: string): Promise<void> {
    const epoch = realtimeEpoch
    setProgressPhase('downloading', i18n.global.t('sync.downloadingLearning'), { direction: 'download', completed: 0, total: 2 })
    let progressInitialSettled = false
    let resolveProgressInitial: (() => void) | null = null
    let rejectProgressInitial: ((error: unknown) => void) | null = null
    const progressInitial = new Promise<void>((resolve, reject) => {
      resolveProgressInitial = resolve
      rejectProgressInitial = reject
    })
    const finishProgressInitial = () => {
      if (progressInitialSettled)
        return
      progressInitialSettled = true
      resolveProgressInitial?.()
    }
    const failProgress = (syncError: unknown) => {
      if (!progressInitialSettled) {
        progressInitialSettled = true
        rejectProgressInitial?.(syncError)
      }
      else {
        handleRealtimeError(syncError)
      }
    }
    try {
      progressUnsubscribe = onSnapshot(userDocument(uid, 'progress', 'global'), { includeMetadataChanges: true }, (snapshot) => {
        if (epoch !== realtimeEpoch) {
          finishProgressInitial()
          return
        }
        if (snapshot.metadata.fromCache)
          return
        if (progressBaselineReady) {
          try {
            const nextProgress = snapshot.exists() ? normalizeCloudProgress(snapshot.data(), uid) : emptyCloudProgress()
            markRemoteUpdate('learning', (snapshot.exists() ? canonicalHash(nextProgress) : '') !== knownProgressHash)
          }
          catch (syncError) {
            failProgress(syncError)
          }
          return
        }
        progressBaselineReady = true
        updateProgress({ completed: 1, total: 2 })
        if (snapshot.exists()) {
          try {
            remoteProgress = normalizeCloudProgress(snapshot.data(), uid)
          }
          catch (syncError) {
            failProgress(syncError)
            return
          }
        }
        else {
          remoteProgress = emptyCloudProgress()
        }
        if (remoteProgress && remoteStats)
          reconcileLearningRemote(remoteProgress, remoteStats)
        if (remoteProgress)
          knownProgressHash = snapshot.exists() ? canonicalHash(remoteProgress) : ''
        markRemoteUpdate('learning', false)
        markSynced()
        finishProgressInitial()
      }, failProgress)
    }
    catch (syncError) {
      failProgress(syncError)
    }
    await withSyncTimeout(progressInitial, 'Learning progress server snapshot')

    let statsInitialSettled = false
    let resolveStatsInitial: (() => void) | null = null
    let rejectStatsInitial: ((error: unknown) => void) | null = null
    const statsInitial = new Promise<void>((resolve, reject) => {
      resolveStatsInitial = resolve
      rejectStatsInitial = reject
    })
    const finishStatsInitial = () => {
      if (statsInitialSettled)
        return
      statsInitialSettled = true
      resolveStatsInitial?.()
    }
    const failStats = (syncError: unknown) => {
      if (!statsInitialSettled) {
        statsInitialSettled = true
        rejectStatsInitial?.(syncError)
      }
      else {
        handleRealtimeError(syncError)
      }
    }
    try {
      statsUnsubscribe = onSnapshot(userDocument(uid, 'stats', 'summary'), { includeMetadataChanges: true }, (snapshot) => {
        if (epoch !== realtimeEpoch) {
          finishStatsInitial()
          return
        }
        if (snapshot.metadata.fromCache)
          return
        if (statsBaselineReady) {
          try {
            const nextStats = snapshot.exists() ? normalizeCloudStats(snapshot.data(), uid) : emptyCloudStats()
            markRemoteUpdate('learning', (snapshot.exists() ? canonicalHash(nextStats) : '') !== knownStatsHash)
          }
          catch (syncError) {
            failStats(syncError)
          }
          return
        }
        statsBaselineReady = true
        updateProgress({ completed: 2, total: 2 })
        if (!snapshot.exists()) {
          remoteStats = emptyCloudStats()
          knownStatsHash = ''
          markRemoteUpdate('learning', false)
          if (remoteProgress)
            reconcileLearningRemote(remoteProgress, remoteStats)
          markSynced()
          finishStatsInitial()
          return
        }
        let remoteStatsData: DashboardStats
        try {
          remoteStatsData = normalizeCloudStats(snapshot.data(), uid)
        }
        catch (syncError) {
          failStats(syncError)
          return
        }
        remoteStats = remoteStatsData
        if (remoteProgress)
          reconcileLearningRemote(remoteProgress, remoteStatsData)
        knownStatsHash = canonicalHash(remoteStatsData)
        markRemoteUpdate('learning', false)
        markSynced()
        finishStatsInitial()
      }, failStats)
    }
    catch (syncError) {
      failStats(syncError)
    }
    await withSyncTimeout(statsInitial, 'Learning stats server snapshot')
  }

  async function applyRemoteAiSettingsChanges(uid: string): Promise<void> {
    const epoch = realtimeEpoch
    setProgressPhase('downloading', i18n.global.t('sync.downloadingSettings'), { direction: 'download', completed: 0, total: 1 })
    let initialSettled = false
    let resolveInitial: (() => void) | null = null
    let rejectInitial: ((error: unknown) => void) | null = null
    const initial = new Promise<void>((resolve, reject) => {
      resolveInitial = resolve
      rejectInitial = reject
    })
    const finishInitial = () => {
      if (initialSettled)
        return
      initialSettled = true
      resolveInitial?.()
    }
    const fail = (syncError: unknown) => {
      if (!initialSettled) {
        initialSettled = true
        rejectInitial?.(syncError)
      }
      else {
        handleRealtimeError(syncError)
      }
    }
    try {
      aiSettingsUnsubscribe = onSnapshot(userDocument(uid, 'settings', 'ai'), { includeMetadataChanges: true }, (snapshot) => {
        if (epoch !== realtimeEpoch) {
          finishInitial()
          return
        }
        if (snapshot.metadata.fromCache)
          return
        if (aiSettingsBaselineReady) {
          try {
            const nextSettings = snapshot.exists() ? normalizeCloudAiSettings(snapshot.data(), uid) : null
            markRemoteUpdate('settings', (nextSettings ? canonicalHash(nextSettings) : '') !== knownAiSettingsHash)
          }
          catch (syncError) {
            fail(syncError)
          }
          return
        }
        aiSettingsBaselineReady = true
        updateProgress({ completed: 1, total: 1 })
        if (!snapshot.exists()) {
          reconcileAiSettingsRemote(null)
          markRemoteUpdate('settings', false)
          markSynced()
          finishInitial()
          return
        }
        try {
          const normalized = normalizeCloudAiSettings(snapshot.data(), uid)
          reconcileAiSettingsRemote(normalized)
          knownAiSettingsHash = canonicalHash(normalized)
          markRemoteUpdate('settings', false)
          markSynced()
          finishInitial()
        }
        catch (syncError) {
          fail(syncError)
        }
      }, fail)
    }
    catch (syncError) {
      fail(syncError)
    }
    await withSyncTimeout(initial, 'AI settings server snapshot')
  }

  async function flushLearning() {
    if (!user.value || !isOnline.value || manualOfflineMode || !progressBaselineReady || !statsBaselineReady || (!learningDirty && !hasOutboxDomain(outbox.value, 'learning')))
      return
    if (!hasOutboxDomain(outbox.value, 'learning')) {
      learningDirty = false
      return
    }
    const learningStore = useLearningStore()
    const uid = user.value.uid
    const epoch = realtimeEpoch
    const uploadProgressHash = canonicalHash(learningStore.progress)
    const uploadStatsHash = canonicalHash(learningStore.stats)
    const uploadChangeVersion = learningLocalChangeVersion
    pendingWrites.value = Math.max(pendingWrites.value, 1)
    setStatus('uploading')
    setProgressPhase('uploading', i18n.global.t('sync.uploadingLearning'), { direction: 'upload' })
    try {
      const result = await writeCloudLearningState(
        requireCloudFirestore(),
        uid,
        learningStore.progress,
        learningStore.stats,
        { progress: knownProgressHash, stats: knownStatsHash },
        (completed, total) => updateProgress({ completed, total, currentBatch: 0, totalBatches: 0 }),
      )
      if (!isCurrentSync(uid, epoch))
        return
      const localChangedDuringUpload = learningLocalChangeVersion !== uploadChangeVersion
        || canonicalHash(learningStore.progress) !== uploadProgressHash
        || canonicalHash(learningStore.stats) !== uploadStatsHash
      if (localChangedDuringUpload) {
        applyLocalLearningRecords()
        throw new Error('aborted: learning data changed during upload')
      }
      const { progress: progressResult, stats: statsResult, progressHash, statsHash, progressChanged, statsChanged } = result
      if (!progressResult.written || !statsResult.written) {
        if (!progressResult.written) {
          remoteProgress = progressResult.current === null ? emptyCloudProgress() : normalizeCloudProgress(progressResult.current, uid)
          knownProgressHash = progressResult.current === null ? '' : canonicalHash(remoteProgress)
        }
        else if (progressChanged) {
          remoteProgress = learningStore.progress
          knownProgressHash = progressHash
        }
        if (!statsResult.written) {
          remoteStats = statsResult.current === null ? emptyCloudStats() : normalizeCloudStats(statsResult.current, uid)
          knownStatsHash = statsResult.current === null ? '' : canonicalHash(remoteStats)
        }
        else if (statsChanged) {
          remoteStats = learningStore.stats
          knownStatsHash = statsHash
        }
        if (remoteProgress && remoteStats)
          reconcileLearningRemote(remoteProgress, remoteStats)
        throw new Error('aborted: learning data changed on another device')
      }
      if (progressChanged)
        knownProgressHash = progressHash
      if (statsChanged)
        knownStatsHash = statsHash
      learningDirty = false
      replaceOutbox(removeOutboxDomain(outbox.value, 'learning'))
      markRemoteUpdate('learning', false)
      markSynced()
    }
    catch (syncError) {
      if (!isCurrentSync(uid, epoch))
        return
      replaceOutbox(incrementOutboxAttempts(outbox.value, 'learning'))
      handleSyncError(syncError)
    }
  }

  async function flushLibrary() {
    if (!user.value || !isOnline.value || manualOfflineMode || applyingRemote || !libraryBaselineReady || (!libraryDirty && !libraryNeedsUpgrade && !libraryRepositoryPending))
      return
    if (!libraryNeedsUpgrade && !libraryRepositoryPending && !hasOutboxDomain(outbox.value, 'library')) {
      libraryDirty = false
      return
    }
    const libraryStore = useLibraryStore()
    const uid = user.value.uid
    const epoch = realtimeEpoch
    const repository = getLibraryRepository()
    pendingWrites.value = Math.max(pendingWrites.value, 1)
    setStatus('uploading')
    setProgressPhase('uploading', i18n.global.t('sync.uploadingLibrary'), { direction: 'upload' })
    try {
      await libraryStore.waitForPersistence()
      if (!isCurrentSync(uid, epoch))
        return
      const library = await repository.loadState()
      const uploadLibraryHash = canonicalHash(library)
      const uploadChangeVersion = libraryLocalChangeVersion
      if (!isCurrentSync(uid, epoch))
        return
      const result = await writeCloudLibraryChunksV5(requireCloudFirestore(), uid, library, knownLibraryHashes, knownLibraryRevision, (batch) => {
        if (!isCurrentSync(uid, epoch))
          return
        updateProgress({ phase: 'uploading', message: i18n.global.t('sync.uploadingLibrary'), direction: 'upload', completed: batch.completed, total: batch.total, currentBatch: batch.currentBatch, totalBatches: batch.totalBatches })
      })
      if (!isCurrentSync(uid, epoch))
        return
      await libraryStore.waitForPersistence()
      if (!isCurrentSync(uid, epoch))
        return
      const latestLibrary = await repository.loadState()
      if (!isCurrentSync(uid, epoch))
        return
      const localChangedDuringUpload = libraryLocalChangeVersion !== uploadChangeVersion
        || canonicalHash(latestLibrary) !== uploadLibraryHash
      knownLibraryHashes.clear()
      for (const [chunkId, checksum] of result.hashes)
        knownLibraryHashes.set(chunkId, checksum)
      knownLibraryRevision = result.revision
      if (localChangedDuringUpload) {
        libraryDirty = true
        queueLibraryChangeDetection()
        throw new Error('aborted: Library changed during upload')
      }
      if (result.conflicted) {
        await refreshLibraryRemote(uid, () => isCurrentSync(uid, epoch) && libraryLocalChangeVersion === uploadChangeVersion)
        if (!isCurrentSync(uid, epoch))
          return
        throw new Error('aborted: Library manifest changed on another device')
      }
      await repository.saveRemoteLibraryChunks(result.chunks)
      await repository.commitRemoteLibrarySyncState({
        revision: result.revision,
        updatedAt: library.updatedAt,
        hashes: Object.fromEntries(result.hashes),
      })
      libraryDirty = false
      libraryNeedsUpgrade = false
      libraryRepositoryPending = false
      await saveToStorage(LIBRARY_SYNC_PENDING_STORAGE_KEY, '')
      replaceOutbox(removeOutboxDomain(outbox.value, 'library'))
      markRemoteUpdate('library', false)
      markSynced()
    }
    catch (syncError) {
      if (!isCurrentSync(uid, epoch))
        return
      replaceOutbox(incrementOutboxAttempts(outbox.value, 'library'))
      handleSyncError(syncError)
    }
  }

  async function flushAiSettings() {
    if (!user.value || !isOnline.value || manualOfflineMode || !aiSettingsBaselineReady || (!aiSettingsDirty && !hasOutboxDomain(outbox.value, 'settings')))
      return
    if (!hasOutboxDomain(outbox.value, 'settings')) {
      aiSettingsDirty = false
      return
    }
    const uid = user.value.uid
    const epoch = realtimeEpoch
    const uploadSettingsHash = canonicalHash(getShareableAiSettings(loadAiSettings()))
    const uploadChangeVersion = aiSettingsLocalChangeVersion
    pendingWrites.value = Math.max(pendingWrites.value, 1)
    setStatus('uploading')
    setProgressPhase('uploading', i18n.global.t('sync.uploadingSettings'), { direction: 'upload' })
    try {
      const result = await writeCloudAiSettings(
        requireCloudFirestore(),
        uid,
        loadAiSettings(),
        knownAiSettingsHash,
        (completed, total) => updateProgress({ completed, total, currentBatch: 0, totalBatches: 0 }),
      )
      if (!isCurrentSync(uid, epoch))
        return
      const localChangedDuringUpload = aiSettingsLocalChangeVersion !== uploadChangeVersion
        || canonicalHash(getShareableAiSettings(loadAiSettings())) !== uploadSettingsHash
      if (localChangedDuringUpload) {
        applyLocalAiSettingsRecords()
        throw new Error('aborted: AI settings changed during upload')
      }
      if (!result.result.written) {
        const remote = result.result.current === null ? null : normalizeCloudAiSettings(result.result.current, uid)
        knownAiSettingsHash = remote ? canonicalHash(remote) : ''
        reconcileAiSettingsRemote(remote)
        throw new Error('aborted: AI settings changed on another device')
      }
      if (result.changed)
        knownAiSettingsHash = result.hash
      aiSettingsDirty = false
      baselineAiSettingsRecords = settingsRecords(loadAiSettings())
      observedAiSettingsRecords = baselineAiSettingsRecords
      replaceOutbox(removeOutboxDomain(outbox.value, 'settings'))
      markRemoteUpdate('settings', false)
      markSynced()
    }
    catch (syncError) {
      if (!isCurrentSync(uid, epoch))
        return
      replaceOutbox(incrementOutboxAttempts(outbox.value, 'settings'))
      handleSyncError(syncError)
    }
  }

  async function flushAll() {
    if (!user.value)
      return
    const uid = user.value.uid
    const epoch = realtimeEpoch
    // Domain writes are intentionally ordered. Library first establishes the
    // vocabulary baseline used by learning, then settings are committed last.
    await flushLibrary()
    if (!isCurrentSync(uid, epoch))
      return
    const afterLibraryStatus = status.value
    if (afterLibraryStatus === 'error' || libraryDirty || libraryRepositoryPending || libraryNeedsUpgrade || hasOutboxDomain(outbox.value, 'library'))
      return
    await flushLearning()
    if (!isCurrentSync(uid, epoch))
      return
    const afterLearningStatus = status.value
    if (afterLearningStatus === 'error' || learningDirty || hasOutboxDomain(outbox.value, 'learning'))
      return
    await flushAiSettings()
  }

  function enqueueSync(operation: () => Promise<void>): Promise<void> {
    const uid = user.value?.uid
    const epoch = realtimeEpoch
    const run = syncQueue
      .catch(() => undefined)
      .then(() => {
        if (uid && !isCurrentSync(uid, epoch))
          return
        return operation()
      })
      .catch((syncError) => {
        if (!uid || isCurrentSync(uid, epoch))
          handleSyncError(syncError)
      })
    syncQueue = run
    return run
  }

  function applyLocalLibraryRecords(current: SyncRecords) {
    const next = queueRecordChanges('library', baselineLibraryRecords, observedLibraryRecords, current, outbox.value)
    observedLibraryRecords = current
    replaceOutbox(next)
    libraryDirty = hasOutboxDomain(next, 'library')
  }

  function applyLocalLearningRecords() {
    const learningStore = useLearningStore()
    const current = learningRecords(learningStore.progress, learningStore.stats)
    const next = queueRecordChanges('learning', baselineLearningRecords, observedLearningRecords, current, outbox.value)
    observedLearningRecords = current
    replaceOutbox(next)
    learningDirty = hasOutboxDomain(next, 'learning')
  }

  function applyLocalAiSettingsRecords() {
    const current = settingsRecords(loadAiSettings())
    const next = queueRecordChanges('settings', baselineAiSettingsRecords, observedAiSettingsRecords, current, outbox.value)
    observedAiSettingsRecords = current
    replaceOutbox(next)
    aiSettingsDirty = hasOutboxDomain(next, 'settings')
  }

  function mergePartialLibraryRecords(current: SyncRecords): SyncRecords {
    const merged = { ...observedLibraryRecords, ...current }
    // Index records are always resident and therefore authoritative even when
    // the content records are only partially hydrated. Payload records missing
    // from the current Pinia snapshot are kept until the repository-backed
    // pass below confirms an actual deletion.
    for (const recordKey of Object.keys(observedLibraryRecords)) {
      if ((recordKey.startsWith('set:') || recordKey.startsWith('folder:')) && !(recordKey in current))
        delete merged[recordKey]
    }
    return merged
  }

  function queueLibraryChangeDetection() {
    const uid = user.value?.uid
    if (!uid)
      return
    const epoch = realtimeEpoch
    const libraryStore = useLibraryStore()
    const immediate = libraryStore.fullyHydrated
      ? libraryRecords(libraryStore.state)
      : mergePartialLibraryRecords(libraryRecords(libraryStore.state))
    if (isCurrentSync(uid, epoch))
      applyLocalLibraryRecords(immediate)
    const run = libraryChangeQueue
      .catch(() => undefined)
      .then(async () => {
        if (!isCurrentSync(uid, epoch))
          return
        await libraryStore.waitForPersistence()
        if (!isCurrentSync(uid, epoch))
          return
        const repository = getLibraryRepository()
        const currentState = libraryStore.fullyHydrated
          ? libraryStore.state
          : await repository.loadState()
        if (!isCurrentSync(uid, epoch))
          return
        applyLocalLibraryRecords(libraryRecords(currentState))
      })
    libraryChangeQueue = run
    void run.catch((syncError) => {
      if (isCurrentSync(uid, epoch))
        handleSyncError(syncError)
    })
  }

  async function waitForLocalPersistence(): Promise<boolean> {
    await nextTick()
    try {
      await Promise.all([
        useLibraryStore().waitForPersistence(),
        useLearningStore().waitForPersistence(),
        useSessionStore().waitForPersistence(),
        waitForAiSettingsPersistence(),
        outboxPersistencePromise,
      ])
      return true
    }
    catch (persistenceError) {
      handleSyncError(persistenceError)
      return false
    }
  }

  async function syncNow(): Promise<boolean> {
    if (!user.value)
      return waitForLocalPersistence()
    const syncUid = user.value.uid
    const syncEpoch = realtimeEpoch
    await loadLibraryRepositoryPending(() => isCurrentSync(syncUid, syncEpoch))
    if (!isCurrentSync(syncUid, syncEpoch))
      return false
    if (!isOnline.value || manualOfflineMode) {
      if (!await waitForLocalPersistence())
        return false
      if (!isCurrentSync(syncUid, syncEpoch))
        return false
      setStatus('offline')
      setProgressPhase('offline', i18n.global.t('sync.savedLocally'), { direction: 'idle', retryable: true })
      return true
    }
    // Explicit form submissions mutate Pinia synchronously, while the deep
    // watchers that materialize those mutations into the outbox run on Vue's
    // scheduler. Wait for that queue before checking dirty domains so a form
    // cannot close before its local commit is visible to the ordered flusher.
    await nextTick()
    if (!isCurrentSync(syncUid, syncEpoch))
      return false
    await libraryChangeQueue.catch(() => undefined)
    if (!isCurrentSync(syncUid, syncEpoch))
      return false
    if (!allInitialBaselinesReady())
      return false
    if (!await waitForLocalPersistence())
      return false
    if (!isCurrentSync(syncUid, syncEpoch))
      return false
    setProgressPhase('preparing', i18n.global.t('sync.connecting'), { direction: 'upload', retryable: false })
    await enqueueSync(async () => {
      if (pendingRemoteDomains.has('library')) {
        setProgressPhase('downloading', i18n.global.t('sync.downloadingLibrary'), { direction: 'download' })
        await refreshLibraryRemote(syncUid, () => isCurrentSync(syncUid, syncEpoch))
      }
      if (pendingRemoteDomains.has('learning') || pendingRemoteDomains.has('settings')) {
        setProgressPhase('downloading', i18n.global.t('sync.downloading'), { direction: 'download' })
        await refreshSecondaryRemote(syncUid, () => isCurrentSync(syncUid, syncEpoch))
      }
      await flushAll()
    })
    if (!isCurrentSync(syncUid, syncEpoch))
      return false
    if (status.value === 'error'
      || pendingWrites.value > 0
      || libraryRepositoryPending
      || libraryDirty
      || learningDirty
      || aiSettingsDirty
      || remoteUpdateAvailable.value
      || hasOutboxDomain(outbox.value, 'library')
      || hasOutboxDomain(outbox.value, 'learning')
      || hasOutboxDomain(outbox.value, 'settings')) {
      return false
    }
    setProgressPhase('verifying', i18n.global.t('sync.verifying'), { direction: 'idle', completed: 1, total: 1 })
    setStatus('synced')
    setProgressPhase('synced', i18n.global.t('sync.synced'), { direction: 'idle', completed: 1, total: 1, retryable: false })
    return true
  }

  async function syncCommittedChange(): Promise<boolean> {
    if (!user.value)
      return syncNow()
    operationBlocked.value = true
    const synced = await syncNow()
    if (synced && status.value === 'synced')
      operationBlocked.value = false
    else if (!synced && status.value !== 'error' && status.value !== 'offline')
      setError(new Error('Cloud synchronization did not complete'))
    return synced
  }

  async function startRealtime(uid: string) {
    if (realtimeUid === uid && libraryUnsubscribe && progressUnsubscribe && statsUnsubscribe && aiSettingsUnsubscribe)
      return
    clearListeners()
    libraryBaselineReady = false
    progressBaselineReady = false
    statsBaselineReady = false
    aiSettingsBaselineReady = false
    baselineLibraryRecords = {}
    observedLibraryRecords = {}
    knownLibraryHashes.clear()
    knownLibraryRevision = ''
    pendingRemoteDomains.clear()
    remoteUpdateAvailable.value = false
    libraryNeedsUpgrade = false
    initialSnapshotObserved = false
    knownProgressHash = ''
    knownStatsHash = ''
    baselineLearningRecords = {}
    observedLearningRecords = {}
    remoteProgress = null
    remoteStats = null
    aiSettingsDirty = false
    baselineAiSettingsRecords = {}
    observedAiSettingsRecords = {}
    knownAiSettingsHash = ''
    const libraryStore = useLibraryStore()
    baselineLibraryRecords = libraryRecords(libraryStore.state)
    observedLibraryRecords = baselineLibraryRecords
    observedLibraryHydrationVersion = libraryStore.hydrationVersion
    const learningStore = useLearningStore()
    baselineLearningRecords = learningRecords(learningStore.progress, learningStore.stats)
    observedLearningRecords = baselineLearningRecords
    baselineAiSettingsRecords = settingsRecords(loadAiSettings())
    observedAiSettingsRecords = baselineAiSettingsRecords
    realtimeUid = uid
    initialRealtimeLoading = true
    const epoch = realtimeEpoch
    setStatus('connecting')
    setProgressPhase('downloading', i18n.global.t('sync.fetchingManifest'), { direction: 'download', retryable: false })
    try {
      // Initial reads are deliberately ordered: the Library manifest and
      // chunks establish the vocabulary baseline before learning and settings
      // are reconciled. Each listener remains active for later updates.
      await applyRemoteLibraryChanges(uid)
      if (epoch !== realtimeEpoch)
        return
      await applyRemoteLearningChanges(uid)
      if (epoch !== realtimeEpoch)
        return
      await applyRemoteAiSettingsChanges(uid)
    }
    catch (syncError) {
      if (epoch === realtimeEpoch)
        handleSyncError(syncError)
    }
    finally {
      if (epoch === realtimeEpoch)
        initialRealtimeLoading = false
    }
  }

  function stopRealtime() {
    clearListeners()
    if (user.value)
      setStatus('offline')
  }

  async function retryConnection() {
    if (!user.value)
      return
    manualOfflineMode = false
    error.value = ''
    if (!allInitialBaselinesReady() || realtimeUid !== user.value.uid) {
      await startAccountSync(user.value.uid)
      return
    }
    if (operationBlocked.value) {
      const synced = await syncNow()
      if (synced && status.value === 'synced')
        operationBlocked.value = false
    }
  }

  function continueOffline() {
    manualOfflineMode = true
    stopRealtime()
    appReady.value = true
    operationBlocked.value = false
    error.value = ''
    status.value = 'offline'
    setProgressPhase('offline', i18n.global.t('sync.offline'), { direction: 'idle', retryable: true })
  }

  async function init() {
    if (started)
      return
    started = true
    configured.value = isFirebaseConfigured()
    if (!configured.value) {
      status.value = 'disabled'
      appReady.value = true
      setProgressPhase('synced', i18n.global.t('sync.notConfigured'), { completed: 1, total: 1, percent: 100 })
      return
    }
    let auth: Auth | null
    try {
      auth = await configureFirebaseAuth()
    }
    catch (authError) {
      handleSyncError(authError)
      authReady.value = true
      return
    }
    if (!auth)
      return
    onAuthStateChanged(auth, async nextUser => applyAuthState(nextUser), handleSyncError)
    watch([isOnline, visibility], ([online, pageVisibility]) => {
      if (!user.value)
        return
      if (manualOfflineMode)
        return
      if (!online) {
        stopRealtime()
        appReady.value = true
        return
      }
      if (pageVisibility === 'visible' && realtimeUid !== user.value.uid)
        void startAccountSync(user.value.uid)
    })
    watch([isOnline, appReady], () => scheduleRemoteSync())
  }

  async function applyAuthState(nextUser: User | null) {
    const transitionVersion = ++authTransitionVersion
    const isCurrentTransition = () => transitionVersion === authTransitionVersion
    try {
      const identityChanged = nextUser?.uid !== activeUid
      if (identityChanged) {
        clearListeners()
        syncQueue = Promise.resolve()
        libraryChangeQueue = Promise.resolve()
        initialSyncWork = null
        appReady.value = false
        operationBlocked.value = false
        // Prevent the deep local watchers from treating namespace reset as a
        // user edit while the old account is being detached.
        user.value = null
        libraryBaselineReady = false
        progressBaselineReady = false
        statsBaselineReady = false
        libraryDirty = false
        learningDirty = false
        knownProgressHash = ''
        knownStatsHash = ''
        knownLibraryHashes.clear()
        knownLibraryRevision = ''
        libraryNeedsUpgrade = false
        aiSettingsBaselineReady = false
        aiSettingsDirty = false
        baselineAiSettingsRecords = {}
        observedAiSettingsRecords = {}
        knownAiSettingsHash = ''
        libraryRepositoryPending = false
        if (!await switchLocalNamespace(nextUser?.uid || 'guest', isCurrentTransition) || !isCurrentTransition())
          return
      }
      if (!isCurrentTransition())
        return
      activeUid = nextUser?.uid || ''
      user.value = nextUser
      outbox.value = []
      pendingWrites.value = 0
      if (nextUser)
        accountStore.setProfile(nextUser.displayName || nextUser.email || '', nextUser.photoURL || '')
      else
        accountStore.clearProfile()
      authReady.value = true
      if (nextUser) {
        await startAccountSync(nextUser.uid)
      }
      else {
        clearListeners()
        status.value = 'signed-out'
        appReady.value = true
        setProgressPhase('synced', i18n.global.t('sync.signedOut'), { completed: 1, total: 1, direction: 'idle', retryable: false })
      }
    }
    catch (authStateError) {
      if (!isCurrentTransition())
        return
      authReady.value = true
      handleSyncError(authStateError)
    }
  }

  async function signIn() {
    const auth = getFirebaseAuth()
    if (!auth) {
      setError(new CloudSyncError('cloud/not-configured', 'Firebase 尚未設定'))
      return
    }
    const libraryStore = useLibraryStore()
    const learningStore = useLearningStore()
    const hasGuestAiSettings = canonicalHash(getShareableAiSettings(loadAiSettings())) !== canonicalHash(getShareableAiSettings(defaultAiSettings))
    const hasGuestData = libraryStore.sets.length > 0
      || Object.keys(libraryStore.state.words).length > 0
      || libraryStore.folders.length > 1
      || Object.keys(learningStore.progress.cards).length > 0
      || learningStore.stats.xp > 0
      || learningStore.stats.totalMemoryReviews > 0
      || learningStore.stats.totalQuestionReviews > 0
      || hasGuestAiSettings
    if (hasGuestData) {
      const decision = await useUIStore().showGuestDataWarning()
      if (decision !== 'continue')
        return
    }
    error.value = ''
    try {
      const accessToken = await requestGoogleAccessToken()
      const credential = GoogleAuthProvider.credential(null, accessToken)
      await signInWithCredential(auth, credential)
    }
    catch (authError) {
      setError(authError)
    }
  }

  async function signOutAccount() {
    const auth = getFirebaseAuth()
    if (!auth)
      return
    await signOut(auth)
  }

  const learningStore = useLearningStore()
  watch(() => [learningStore.progress, learningStore.stats], () => {
    if (applyingRemote || !user.value)
      return
    learningLocalChangeVersion += 1
    applyLocalLearningRecords()
  }, { deep: true })
  const libraryStore = useLibraryStore()
  watch(() => libraryStore.state, () => {
    if (applyingRemote || !user.value)
      return
    if (libraryStore.hydrationVersion !== observedLibraryHydrationVersion) {
      observedLibraryHydrationVersion = libraryStore.hydrationVersion
      return
    }
    libraryLocalChangeVersion += 1
    queueLibraryChangeDetection()
  }, { deep: true })

  onAiSettingsChanged(() => {
    if (applyingRemote || !user.value)
      return
    aiSettingsLocalChangeVersion += 1
    applyLocalAiSettingsRecords()
  })

  return {
    configured,
    authReady,
    appReady,
    user,
    status,
    error,
    lastSyncedAt,
    pendingWrites,
    operationBlocked,
    remoteUpdateAvailable,
    progress,
    isOnline,
    isSignedIn,
    accountLabel,
    init,
    signIn,
    signOutAccount,
    flushLearning,
    flushAiSettings,
    flushAll,
    syncNow,
    syncCommittedChange,
    retryConnection,
    continueOffline,
  }
})

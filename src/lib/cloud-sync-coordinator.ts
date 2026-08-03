import type { Auth, User } from 'firebase/auth'
import type { Unsubscribe } from 'firebase/firestore'
import type { CloudSyncRuntime } from '@/lib/cloud-sync-runtime'
import type { LibraryMutationChange } from '@/lib/library-repository'
import type { SyncOutboxEntry, SyncRecords } from '@/lib/sync-outbox'
import type { AiSettings, DashboardStats, FirestoreSyncHeadDoc, LearningProgress, LibraryState, SyncAfterLocalCommitResult, SyncPresentation, SyncProgressState, SyncStatus } from '@/types'
import { useDocumentVisibility, useOnline } from '@vueuse/core'
import { computed, nextTick, ref, watch } from 'vue'
import { CLOUD_SCHEMA_VERSION, LIBRARY_SYNC_PENDING_STORAGE_KEY, SYNC_HEAD_STORAGE_KEY } from '@/constants'
import { defaultAiSettings, getShareableAiSettings, loadAiSettings, loadAiSettingsState, onAiSettingsChanged, saveAiSettings, waitForAiSettingsPersistence } from '@/lib/ai-provider'
import { CloudSyncError, isRetryableSyncError, syncErrorDetails } from '@/lib/cloud-sync-errors'
import { loadCloudOutbox, saveCloudOutbox } from '@/lib/cloud-sync-outbox-storage'
import { transitionSyncProgress, updateSyncProgress } from '@/lib/cloud-sync-progress'
import { reconcileAiSettingsState, reconcileLearningState, reconcileLibraryState } from '@/lib/cloud-sync-reconcile'
import { loadCloudSyncRuntime } from '@/lib/cloud-sync-runtime'
import { libraryStateFromRecords, normalizeCloudAiSettings, normalizeCloudProgress, normalizeCloudStats, validateCloudSyncHead } from '@/lib/cloud-sync-schema'
import { isFirebaseConfigured } from '@/lib/firebase-config'
import { requestGoogleAccessToken } from '@/lib/googleIdentity'
import { canonicalHash } from '@/lib/hash'
import { i18n } from '@/lib/i18n'
import { mergeLibraryStates } from '@/lib/library-merge'
import { getLibraryRepository } from '@/lib/library-repository'
import { stageCloudLibrary } from '@/lib/library-sync-staging'
import { hasLocalWorkspaceData } from '@/lib/local-workspace'
import { loadFromStorage, saveToStorage, setStorageNamespace } from '@/lib/persist'
import { normalizeLibraryState } from '@/lib/share'
import { hasOutboxDomain, incrementOutboxAttempts, learningRecords, libraryRecords, nextOutboxRetryAt, queueRecordChanges, removeOutboxDomain, settingsRecords } from '@/lib/sync-outbox'
import { runSyncWithRetry, SyncRetryPausedError } from '@/lib/sync-retry'
import { withSyncTimeout } from '@/lib/sync-timeout'
import { useAccountStore } from '@/stores/account'
import { useLearningStore } from '@/stores/learning'
import { useLibraryStore } from '@/stores/library'
import { useSessionStore } from '@/stores/session'
import { useSetsStore } from '@/stores/sets'
import { useUIStore } from '@/stores/ui'

export function createCloudSyncCoordinator() {
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
    presentation: configured.value ? 'blocking' : 'background',
    accountId: '',
    epoch: 0,
    operationId: '',
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
    stalled: false,
    retryAttempt: 0,
    maxRetryAttempts: 5,
    activeRequests: 0,
  })
  const appReady = ref(!configured.value)

  let syncHeadUnsubscribe: Unsubscribe | null = null
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
  let baselineLibraryRecords: SyncRecords = {}
  let observedLibraryRecords: SyncRecords = {}
  let baselineLearningRecords: SyncRecords = {}
  let observedLearningRecords: SyncRecords = {}
  let remoteProgress: LearningProgress | null = null
  let remoteStats: DashboardStats | null = null
  let aiSettingsDirty = false
  let aiSettingsLocalChangeVersion = 0
  let baselineAiSettingsRecords: SyncRecords = {}
  let observedAiSettingsRecords: SyncRecords = {}
  let knownAiSettingsHash = ''
  let pendingSyncHead: FirestoreSyncHeadDoc | null = null
  let cloudSyncHeadExists = false
  let acknowledgedSyncHead: FirestoreSyncHeadDoc | null = null
  const isOnline = useOnline()
  const visibility = useDocumentVisibility()
  let initialSyncWork: Promise<void> | null = null
  let baselineSyncWork: Promise<void> | null = null
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
  let libraryMutationVersion = 0
  let authTransitionVersion = 0
  let namespaceSwitchQueue: Promise<void> = Promise.resolve()
  let syncNowFlight: Promise<boolean> | null = null
  let committedChangeFlight: Promise<SyncAfterLocalCommitResult> | null = null
  let syncHeadWriteFlight: Promise<void> | null = null
  let lastSyncFailure: unknown = null
  let operationSequence = 0
  let runtime: CloudSyncRuntime | null = null

  function requireRuntime(): CloudSyncRuntime {
    if (!runtime)
      throw new CloudSyncError('cloud/not-configured', 'Cloud runtime 尚未初始化')
    return runtime
  }

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
    const hasAutomaticRetry = outbox.value.some(entry => entry.attempts < 5 && Boolean(entry.nextAttemptAt || entry.lastErrorCode))
    if ((!remoteUpdateAvailable.value && !hasAutomaticRetry)
      || automaticRemoteSync
      || !user.value
      || !isOnline.value
      || manualOfflineMode
      || visibility.value !== 'visible'
      || !appReady.value
      || !allInitialBaselinesReady()) {
      return
    }

    if (!committedChangeFlight)
      operationBlocked.value = false
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
    progress.value = updateSyncProgress(progress.value, patch, pendingWrites.value)
  }

  function beginOperation(presentation: SyncPresentation, operation: string, uid = user.value?.uid ?? '') {
    operationSequence += 1
    updateProgress({
      presentation,
      accountId: uid,
      epoch: realtimeEpoch,
      operationId: `${uid || 'guest'}:${realtimeEpoch}:${operation}:${operationSequence}`,
    })
  }

  function setProgressPhase(phase: SyncProgressState['phase'], message: string, patch: Partial<SyncProgressState> = {}) {
    progress.value = transitionSyncProgress(progress.value, phase, message, patch, pendingWrites.value)
  }

  function allInitialBaselinesReady(): boolean {
    return libraryBaselineReady && progressBaselineReady && statsBaselineReady && aiSettingsBaselineReady
  }

  function hasPendingLocalChanges(): boolean {
    return pendingWrites.value > 0
      || libraryRepositoryPending
      || libraryDirty
      || learningDirty
      || aiSettingsDirty
      || outbox.value.length > 0
  }

  async function ensureCloudSyncHead(uid: string, epoch: number): Promise<void> {
    const headMatchesKnownState = Boolean(cloudSyncHeadExists && acknowledgedSyncHead
      && acknowledgedSyncHead.libraryRevision === knownLibraryRevision
      && acknowledgedSyncHead.progressHash === knownProgressHash
      && acknowledgedSyncHead.statsHash === knownStatsHash
      && acknowledgedSyncHead.settingsHash === knownAiSettingsHash)
    if (!isCurrentSync(uid, epoch) || headMatchesKnownState || !allInitialBaselinesReady() || hasPendingLocalChanges())
      return
    if (syncHeadWriteFlight) {
      try {
        await syncHeadWriteFlight
      }
      catch {
        // A superseded account/epoch may have failed independently. Recheck
        // the current operation instead of leaking that failure into it.
      }
      return ensureCloudSyncHead(uid, epoch)
    }
    const work = (async () => {
      const { remote } = requireRuntime()
      const head = await remote.updateCloudSyncHead(remote.requireCloudFirestore(), uid, {
        libraryRevision: knownLibraryRevision,
        progressHash: knownProgressHash,
        statsHash: knownStatsHash,
        settingsHash: knownAiSettingsHash,
      })
      if (!isCurrentSync(uid, epoch))
        return
      cloudSyncHeadExists = true
      acknowledgedSyncHead = head
      pendingSyncHead = head
      await persistSyncHead(head)
      pendingSyncHead = null
    })()
    const trackedWork = work.finally(() => {
      if (syncHeadWriteFlight === trackedWork)
        syncHeadWriteFlight = null
    })
    syncHeadWriteFlight = trackedWork
    await trackedWork
  }

  async function maybeCompleteInitialSync() {
    if (!user.value || !isOnline.value || !allInitialBaselinesReady() || initialSyncWork)
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
      if (hasPendingLocalChanges()
        || hasOutboxDomain(outbox.value, 'library')
        || hasOutboxDomain(outbox.value, 'learning')
        || hasOutboxDomain(outbox.value, 'settings')) {
        // Local edits can arrive while the first head pass is still running.
        // They are valid pending work, not an initialization failure; keep the
        // workspace usable and let an explicit commit/retry flush them.
        setStatus('synced')
        setProgressPhase('synced', i18n.global.t('sync.synced'), { completed: 1, total: 1, direction: 'idle', retryable: true })
        appReady.value = true
        operationBlocked.value = false
        return
      }
      await ensureCloudSyncHead(syncUid, syncEpoch)
      if (syncEpoch !== realtimeEpoch || user.value?.uid !== syncUid)
        return
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

  async function loadLocalSyncHead(uid: string, isCurrent?: () => boolean): Promise<FirestoreSyncHeadDoc | null> {
    const stored = await loadFromStorage(SYNC_HEAD_STORAGE_KEY)
    if (isCurrent && !isCurrent())
      return null
    if (!stored.value)
      return null
    try {
      const parsed = JSON.parse(stored.value)
      if (!parsed || parsed.ownerId !== uid)
        return null
      return validateCloudSyncHead(parsed, uid)
    }
    catch {
      return null
    }
  }

  async function persistSyncHead(head: FirestoreSyncHeadDoc): Promise<void> {
    await saveToStorage(SYNC_HEAD_STORAGE_KEY, head)
  }

  function localHeadMatches(remote: FirestoreSyncHeadDoc, local: FirestoreSyncHeadDoc | null, libraryRevision: string): boolean {
    return Boolean(local
      && local.ownerId === remote.ownerId
      && local.libraryRevision === remote.libraryRevision
      && local.libraryRevision === libraryRevision
      && local.progressHash === remote.progressHash
      && local.statsHash === remote.statsHash
      && local.settingsHash === remote.settingsHash)
  }

  async function startAccountSync(uid: string) {
    const transitionVersion = authTransitionVersion
    const isCurrentAccount = () => transitionVersion === authTransitionVersion && activeUid === uid && user.value?.uid === uid
    if (!isCurrentAccount())
      return
    try {
      manualOfflineMode = false
      if (isOnline.value)
        setProgressPhase('preparing', i18n.global.t('sync.connecting'), { direction: 'download', completed: 0, total: 0, retryable: false })
      if (!await loadOutbox(uid, isCurrentAccount) || !await loadLibraryRepositoryPending(isCurrentAccount) || !isCurrentAccount())
        return
      const libraryStore = useLibraryStore()
      const learningStore = useLearningStore()
      appReady.value = hasLocalWorkspaceData(libraryStore.state, learningStore.progress, learningStore.stats)
        || outbox.value.length > 0
        || libraryRepositoryPending
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
    const { remote } = requireRuntime()
    return remote.cloudDocument(remote.requireCloudFirestore(), uid, collectionName, id)
  }

  function clearListeners() {
    realtimeEpoch += 1
    syncHeadUnsubscribe?.()
    syncHeadUnsubscribe = null
    baselineSyncWork = null
    realtimeUid = ''
    pendingSyncHead = null
    acknowledgedSyncHead = null
    cloudSyncHeadExists = false
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
    lastSyncFailure = syncError
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
      context: details.context,
      operationId: progress.value.operationId,
    })
    setError(syncError)
    // Firestore listeners reconnect by themselves after transient failures.
    // Keep the head listener alive so a later server snapshot can recover the
    // background sync without making the whole app cold-start again.
    if (!isRetryableSyncError(syncError) && !(syncError instanceof SyncRetryPausedError))
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
    let repositoryConflict = false
    if (libraryRepositoryPending) {
      const local = await getLibraryRepository().loadState()
      if (isCurrent && !isCurrent())
        return
      const localRecords = libraryRecords(local)
      const remoteRecords = libraryRecords(reconciled.merged)
      const localOnlyRecords: SyncRecords = {}
      for (const [recordKey, payload] of Object.entries(localRecords)) {
        if (!(recordKey in remoteRecords))
          localOnlyRecords[recordKey] = payload
        else if (canonicalHash(payload) !== canonicalHash(remoteRecords[recordKey]))
          repositoryConflict = true
      }
      if (Object.keys(remoteRecords).some(recordKey => !(recordKey in localRecords)))
        repositoryConflict = true
      const rootFolderKey = 'folder:__uncategorized__'
      if (remoteRecords[rootFolderKey])
        localOnlyRecords[rootFolderKey] = remoteRecords[rootFolderKey]
      // Repository imports do not materialize one outbox row per record. Keep
      // genuinely new local records, but let Cloud win every same-key conflict
      // (including a local deletion) before the pending generation is flushed.
      const localOnlyState = libraryStateFromRecords(reconciled.merged, localOnlyRecords)
      merged = mergeLibraryStates(reconciled.merged, localOnlyState).state
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
    baselineLibraryRecords = result.baselineRecords
    observedLibraryRecords = result.observedRecords
    if (result.conflicted.length > 0 || repositoryConflict)
      useUIStore().showToast(i18n.global.t('sync.conflictCloudWins'))
    replaceOutbox([...removeOutboxDomain(outbox.value, 'library'), ...result.accepted])
    libraryDirty = result.dirty
  }

  async function refreshLibraryRemote(uid: string, isCurrent?: () => boolean, onProgress?: (batch: { currentBatch: number, totalBatches: number, completed: number, total: number, activeRequests?: number }) => void) {
    const { remote: cloudRemote } = requireRuntime()
    const remote = await stageCloudLibrary({
      db: cloudRemote.requireCloudFirestore(),
      uid,
      onProgress: (batch) => {
        if (isCurrent && !isCurrent())
          return
        updateProgress({ phase: 'downloading', message: i18n.global.t('sync.downloadingLibrary'), direction: 'download', completed: batch.completed, total: batch.total, currentBatch: batch.currentBatch, totalBatches: batch.totalBatches, activeRequests: batch.activeRequests ?? 0 })
        onProgress?.(batch)
      },
    })
    if (isCurrent && !isCurrent())
      return
    await reconcileLibraryRemote(remote.library, remote.stagingGeneration, isCurrent)
    if (isCurrent && !isCurrent())
      return
    knownLibraryHashes.clear()
    for (const [chunkId, checksum] of remote.hashes)
      knownLibraryHashes.set(chunkId, checksum)
    knownLibraryRevision = remote.revision
    markRemoteUpdate('library', false)
  }

  async function refreshSecondaryRemote(uid: string, domains: { learning: boolean, settings: boolean } = { learning: true, settings: true }, isCurrent?: () => boolean) {
    const { firestore, remote } = requireRuntime()
    const db = remote.requireCloudFirestore()
    const [progressSnapshot, statsSnapshot, settingsSnapshot] = await Promise.all([
      domains.learning ? withSyncTimeout(firestore.getDocFromServer(remote.cloudDocument(db, uid, 'progress', 'global')), 'Learning progress refresh') : Promise.resolve(null),
      domains.learning ? withSyncTimeout(firestore.getDocFromServer(remote.cloudDocument(db, uid, 'stats', 'summary')), 'Learning stats refresh') : Promise.resolve(null),
      domains.settings ? withSyncTimeout(firestore.getDocFromServer(remote.cloudDocument(db, uid, 'settings', 'ai')), 'AI settings refresh') : Promise.resolve(null),
    ])
    if (isCurrent && !isCurrent())
      return
    const learningStore = useLearningStore()
    if (domains.learning) {
      progressBaselineReady = true
      statsBaselineReady = true
      remoteProgress = progressSnapshot?.exists() ? normalizeCloudProgress(progressSnapshot.data(), uid) : remote.emptyCloudProgress()
      remoteStats = statsSnapshot?.exists() ? normalizeCloudStats(statsSnapshot.data(), uid) : remote.emptyCloudStats()
      reconcileLearningRemote(remoteProgress, remoteStats)
      knownProgressHash = progressSnapshot?.exists() ? canonicalHash(remoteProgress) : ''
      knownStatsHash = statsSnapshot?.exists() ? canonicalHash(remoteStats) : ''
    }
    else {
      remoteProgress = learningStore.progress
      remoteStats = learningStore.stats
      baselineLearningRecords = learningRecords(remoteProgress, remoteStats)
      observedLearningRecords = baselineLearningRecords
      progressBaselineReady = true
      statsBaselineReady = true
    }

    if (domains.settings) {
      aiSettingsBaselineReady = true
      const remoteSettings = settingsSnapshot?.exists() ? normalizeCloudAiSettings(settingsSnapshot.data(), uid) : null
      reconcileAiSettingsRemote(remoteSettings)
      knownAiSettingsHash = remoteSettings ? canonicalHash(remoteSettings) : ''
    }
    else {
      const localSettings = loadAiSettings()
      baselineAiSettingsRecords = settingsRecords(localSettings)
      observedAiSettingsRecords = baselineAiSettingsRecords
      aiSettingsBaselineReady = true
    }
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
    if (result.conflicted.length > 0)
      useUIStore().showToast(i18n.global.t('sync.conflictCloudWins'))
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
    if (result.conflicted.length > 0)
      useUIStore().showToast(i18n.global.t('sync.conflictCloudWins'))
    knownAiSettingsHash = canonicalHash(remote ?? null)
    replaceOutbox([...removeOutboxDomain(outbox.value, 'settings'), ...result.accepted])
    aiSettingsDirty = result.dirty
  }
  function currentSyncHead(uid: string, updatedAt = new Date().toISOString()): FirestoreSyncHeadDoc {
    return {
      ownerId: uid,
      schemaVersion: CLOUD_SCHEMA_VERSION,
      updatedAt,
      libraryRevision: knownLibraryRevision,
      progressHash: knownProgressHash,
      statsHash: knownStatsHash,
      settingsHash: knownAiSettingsHash,
    }
  }

  async function activateCachedBaseline(remoteHead: FirestoreSyncHeadDoc, localHead: FirestoreSyncHeadDoc | null): Promise<boolean> {
    if (outbox.value.length > 0 || libraryRepositoryPending || libraryDirty || learningDirty || aiSettingsDirty)
      return false
    const cachedRemote = await getLibraryRepository().loadRemoteLibrarySyncState()
    if (!cachedRemote || !localHeadMatches(remoteHead, localHead, cachedRemote.revision))
      return false
    const libraryStore = useLibraryStore()
    const learningStore = useLearningStore()
    const localSettings = loadAiSettings()
    knownLibraryHashes.clear()
    for (const [chunkId, checksum] of Object.entries(cachedRemote.hashes))
      knownLibraryHashes.set(chunkId, checksum)
    knownLibraryRevision = cachedRemote.revision
    knownProgressHash = remoteHead.progressHash
    knownStatsHash = remoteHead.statsHash
    knownAiSettingsHash = remoteHead.settingsHash
    remoteProgress = learningStore.progress
    remoteStats = learningStore.stats
    libraryBaselineReady = true
    progressBaselineReady = true
    statsBaselineReady = true
    aiSettingsBaselineReady = true
    baselineLibraryRecords = libraryRecords(libraryStore.state)
    observedLibraryRecords = baselineLibraryRecords
    baselineLearningRecords = learningRecords(learningStore.progress, learningStore.stats)
    observedLearningRecords = baselineLearningRecords
    baselineAiSettingsRecords = settingsRecords(localSettings)
    observedAiSettingsRecords = baselineAiSettingsRecords
    await persistSyncHead(remoteHead)
    pendingSyncHead = null
    acknowledgedSyncHead = remoteHead
    pendingRemoteDomains.clear()
    remoteUpdateAvailable.value = false
    updateProgress({ completed: 1, total: 1, currentBatch: 0, totalBatches: 0, direction: 'idle', stalled: false })
    markSynced()
    return true
  }

  async function hydrateFromSyncHead(uid: string, remoteHead: FirestoreSyncHeadDoc | null, epoch: number): Promise<void> {
    const isCurrent = () => isCurrentSync(uid, epoch)
    const localHead = await loadLocalSyncHead(uid, isCurrent)
    if (!isCurrent())
      return
    if (remoteHead && await activateCachedBaseline(remoteHead, localHead))
      return

    setProgressPhase('downloading', i18n.global.t('sync.fetchingManifest'), { direction: 'download', retryable: false })
    await refreshLibraryRemote(uid, isCurrent)
    if (!isCurrent())
      return
    libraryBaselineReady = true
    updateProgress({ completed: 1, total: 1, currentBatch: 0, totalBatches: 0, stalled: false })

    const canReuseLearning = Boolean(remoteHead && localHead
      && localHead.progressHash === remoteHead.progressHash
      && localHead.statsHash === remoteHead.statsHash
      && !outbox.value.some(entry => entry.domain === 'learning'))
    const canReuseSettings = Boolean(remoteHead && localHead
      && localHead.settingsHash === remoteHead.settingsHash
      && !outbox.value.some(entry => entry.domain === 'settings'))
    await refreshSecondaryRemote(uid, { learning: !canReuseLearning, settings: !canReuseSettings }, isCurrent)
    if (!isCurrent())
      return
    if (remoteHead) {
      if (canReuseLearning) {
        knownProgressHash = remoteHead.progressHash
        knownStatsHash = remoteHead.statsHash
      }
      if (canReuseSettings)
        knownAiSettingsHash = remoteHead.settingsHash
      await persistSyncHead(remoteHead)
      pendingSyncHead = null
      acknowledgedSyncHead = remoteHead
    }
    markRemoteUpdate('library', false)
    markRemoteUpdate('learning', false)
    markRemoteUpdate('settings', false)
    markSynced()
  }

  async function startSyncHead(uid: string): Promise<void> {
    const epoch = realtimeEpoch
    setProgressPhase('preparing', i18n.global.t('sync.connecting'), { direction: 'download', retryable: false })
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
    syncHeadUnsubscribe = requireRuntime().firestore.onSnapshot(userDocument(uid, 'sync', 'head'), { includeMetadataChanges: true }, (snapshot) => {
      if (epoch !== realtimeEpoch)
        return finishInitial()
      if (snapshot.metadata.fromCache)
        return
      initialSnapshotObserved = true
      snapshotQueue = snapshotQueue.catch(() => undefined).then(async () => {
        if (epoch !== realtimeEpoch)
          return finishInitial()
        const nextHead = snapshot.exists() ? validateCloudSyncHead(snapshot.data(), uid) : null
        pendingSyncHead = nextHead
        cloudSyncHeadExists = Boolean(nextHead)
        acknowledgedSyncHead = nextHead
        if (!libraryBaselineReady) {
          await hydrateFromSyncHead(uid, nextHead, epoch)
          finishInitial()
          return
        }
        markRemoteUpdate('library', (nextHead?.libraryRevision ?? '') !== knownLibraryRevision)
        markRemoteUpdate('learning', (nextHead?.progressHash ?? '') !== knownProgressHash || (nextHead?.statsHash ?? '') !== knownStatsHash)
        markRemoteUpdate('settings', (nextHead?.settingsHash ?? '') !== knownAiSettingsHash)
      }).catch(fail)
    }, fail)
    await withSyncTimeout(initial, 'Sync head server snapshot')
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
      const { remote } = requireRuntime()
      const result = await remote.writeCloudLearningState(
        remote.requireCloudFirestore(),
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
          remoteProgress = progressResult.current === null ? remote.emptyCloudProgress() : normalizeCloudProgress(progressResult.current, uid)
          knownProgressHash = progressResult.current === null ? '' : canonicalHash(remoteProgress)
        }
        else if (progressChanged) {
          remoteProgress = learningStore.progress
          knownProgressHash = progressHash
        }
        if (!statsResult.written) {
          remoteStats = statsResult.current === null ? remote.emptyCloudStats() : normalizeCloudStats(statsResult.current, uid)
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
      const committedHead = currentSyncHead(uid)
      await persistSyncHead(committedHead)
      cloudSyncHeadExists = true
      acknowledgedSyncHead = committedHead
      pendingSyncHead = null
      learningDirty = false
      replaceOutbox(removeOutboxDomain(outbox.value, 'learning'))
      markRemoteUpdate('learning', false)
      markSynced()
    }
    catch (syncError) {
      if (!isCurrentSync(uid, epoch))
        return
      replaceOutbox(incrementOutboxAttempts(outbox.value, 'learning', new Date().toISOString(), syncErrorDetails(syncError).code))
      handleSyncError(syncError)
    }
  }

  async function flushLibrary() {
    if (!user.value || !isOnline.value || manualOfflineMode || applyingRemote || !libraryBaselineReady || (!libraryDirty && !libraryRepositoryPending))
      return
    if (!libraryRepositoryPending && !hasOutboxDomain(outbox.value, 'library')) {
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
      const { remote } = requireRuntime()
      const result = await remote.writeCloudLibraryChunksV5(remote.requireCloudFirestore(), uid, library, knownLibraryHashes, knownLibraryRevision, (batch) => {
        if (!isCurrentSync(uid, epoch))
          return
        updateProgress({ phase: 'uploading', message: i18n.global.t('sync.uploadingLibrary'), direction: 'upload', completed: batch.completed, total: batch.total, currentBatch: batch.currentBatch, totalBatches: batch.totalBatches, activeRequests: batch.activeRequests ?? 0 })
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
      const committedHead = currentSyncHead(uid)
      await persistSyncHead(committedHead)
      cloudSyncHeadExists = true
      acknowledgedSyncHead = committedHead
      pendingSyncHead = null
      libraryDirty = false
      libraryRepositoryPending = false
      await saveToStorage(LIBRARY_SYNC_PENDING_STORAGE_KEY, '')
      replaceOutbox(removeOutboxDomain(outbox.value, 'library'))
      markRemoteUpdate('library', false)
      markSynced()
    }
    catch (syncError) {
      if (!isCurrentSync(uid, epoch))
        return
      replaceOutbox(incrementOutboxAttempts(outbox.value, 'library', new Date().toISOString(), syncErrorDetails(syncError).code))
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
      const { remote } = requireRuntime()
      const result = await remote.writeCloudAiSettings(
        remote.requireCloudFirestore(),
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
      const committedHead = currentSyncHead(uid)
      await persistSyncHead(committedHead)
      cloudSyncHeadExists = true
      acknowledgedSyncHead = committedHead
      pendingSyncHead = null
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
      replaceOutbox(incrementOutboxAttempts(outbox.value, 'settings', new Date().toISOString(), syncErrorDetails(syncError).code))
      handleSyncError(syncError)
    }
  }

  async function flushAll() {
    if (!user.value)
      return
    const uid = user.value.uid
    const epoch = realtimeEpoch
    const retryAt = nextOutboxRetryAt(outbox.value)
    if (retryAt !== null) {
      const delay = Math.max(0, retryAt - Date.now())
      setStatus('retrying')
      setProgressPhase('retrying', i18n.global.t('sync.retryingWithDelay', { delay }), { direction: 'upload', retryAttempt: 0, maxRetryAttempts: 5, activeRequests: 0, stalled: false, retryable: true })
      while (Date.now() < retryAt) {
        if (!isCurrentSync(uid, epoch) || !isOnline.value || manualOfflineMode || visibility.value !== 'visible')
          return
        await new Promise(resolve => setTimeout(resolve, Math.min(100, retryAt - Date.now())))
      }
    }
    // Library first establishes the vocabulary baseline. Learning and settings
    // are independent v5 documents and can commit in parallel.
    await flushLibrary()
    if (!isCurrentSync(uid, epoch))
      return
    const afterLibraryStatus = status.value
    if (afterLibraryStatus === 'error' || libraryDirty || libraryRepositoryPending || hasOutboxDomain(outbox.value, 'library'))
      return
    await Promise.all([flushLearning(), flushAiSettings()])
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

  function libraryMutationRecordKey(change: LibraryMutationChange): string {
    return `${change.kind}:${change.id}`
  }

  function applyLocalLibraryMutationChanges(changes: readonly LibraryMutationChange[]) {
    const next = { ...observedLibraryRecords }
    for (const change of changes) {
      const recordKey = libraryMutationRecordKey(change)
      if (change.value === null)
        delete next[recordKey]
      else
        next[recordKey] = change.value
    }
    applyLocalLibraryRecords(next)
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
        const journal = repository.consumeMutationJournal(libraryMutationVersion)
        if (journal.complete && journal.changes.length > 0) {
          applyLocalLibraryMutationChanges(journal.changes)
        }
        else if (!journal.complete) {
          const currentState = libraryStore.fullyHydrated
            ? libraryStore.state
            : await repository.loadState()
          if (!isCurrentSync(uid, epoch))
            return
          applyLocalLibraryRecords(libraryRecords(currentState))
        }
        libraryMutationVersion = journal.version
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

  async function syncNowOnce(): Promise<boolean> {
    if (!user.value)
      return waitForLocalPersistence()
    lastSyncFailure = null
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
    if (!allInitialBaselinesReady()) {
      if (baselineSyncWork)
        await baselineSyncWork
      else if (realtimeUid !== syncUid || !syncHeadUnsubscribe)
        await startRealtime(syncUid)
      if (!isCurrentSync(syncUid, syncEpoch) || !allInitialBaselinesReady())
        return false
    }
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
        await refreshSecondaryRemote(syncUid, {
          learning: pendingRemoteDomains.has('learning'),
          settings: pendingRemoteDomains.has('settings'),
        }, () => isCurrentSync(syncUid, syncEpoch))
      }
      await flushAll()
    })
    if (!isCurrentSync(syncUid, syncEpoch))
      return false
    if (pendingSyncHead && pendingWrites.value === 0 && !libraryRepositoryPending && !libraryDirty && !learningDirty && !aiSettingsDirty && outbox.value.length === 0) {
      const settledHead = pendingSyncHead
      await persistSyncHead(settledHead)
      acknowledgedSyncHead = settledHead
      pendingSyncHead = null
    }
    await ensureCloudSyncHead(syncUid, syncEpoch)
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

  async function syncNow(): Promise<boolean> {
    if (!user.value || !isOnline.value || manualOfflineMode)
      return syncNowOnce()
    if (syncNowFlight)
      return syncNowFlight
    const syncUid = user.value.uid
    const syncEpoch = realtimeEpoch
    const work = runSyncWithRetry(`cloud-sync:${syncUid}:${syncEpoch}`, async (attempt) => {
      if (attempt > 1) {
        setStatus('retrying')
        setProgressPhase('retrying', i18n.global.t('sync.retrying'), { direction: 'upload', retryAttempt: attempt - 1, maxRetryAttempts: 5, stalled: false, activeRequests: 1, retryable: true })
      }
      const synced = await syncNowOnce()
      if (!synced && lastSyncFailure && isRetryableSyncError(lastSyncFailure))
        throw lastSyncFailure
      return synced
    }, {
      maxAttempts: 6,
      shouldContinue: () => {
        const canContinue = isCurrentSync(syncUid, syncEpoch) && isOnline.value && !manualOfflineMode && visibility.value === 'visible'
        return canContinue
      },
      onAttemptStart: attempt => updateProgress({ retryAttempt: Math.max(0, attempt - 1), maxRetryAttempts: 5, activeRequests: 1, stalled: false }),
      onStalled: (attempt) => {
        setStatus('retrying')
        updateProgress({ phase: 'retrying', message: i18n.global.t('sync.stalled'), retryAttempt: Math.max(0, attempt - 1), maxRetryAttempts: 5, stalled: true, activeRequests: 1, retryable: true })
      },
      onRetry: (attempt, delayMs) => {
        setStatus('retrying')
        setProgressPhase('retrying', i18n.global.t('sync.retryingWithDelay', { delay: delayMs }), { direction: 'upload', retryAttempt: attempt, maxRetryAttempts: 5, stalled: false, activeRequests: 0, retryable: true })
      },
    }).catch((syncError) => {
      if (syncError instanceof SyncRetryPausedError)
        return false
      throw syncError
    })
    syncNowFlight = work
    void work.finally(() => {
      if (syncNowFlight === work)
        syncNowFlight = null
    }).catch(() => undefined)
    return work
  }

  function syncCommittedChange(): Promise<SyncAfterLocalCommitResult> {
    if (committedChangeFlight)
      return committedChangeFlight
    const work = (async () => {
      await nextTick()
      await libraryChangeQueue
      if (!await waitForLocalPersistence())
        throw new CloudSyncError('cloud/outbox-invalid', 'Local commit persistence failed', { context: { domain: 'persistence', operation: 'local-commit' } })
      pendingWrites.value = pendingWriteCount()
      operationBlocked.value = false
      if (!user.value || pendingWrites.value === 0) {
        return { status: 'cloud-synced', localPersisted: true, cloudSynced: true, pendingWrites: 0 } as const
      }
      beginOperation('background', 'committed-change')
      if (!isOnline.value || manualOfflineMode) {
        setStatus('offline')
        setProgressPhase('offline', i18n.global.t('sync.savedLocally'), { direction: 'idle', retryable: true, presentation: 'background' })
      }
      else {
        void syncNow().catch(handleSyncError)
      }
      return { status: 'queued', localPersisted: true, cloudSynced: false, pendingWrites: pendingWrites.value } as const
    })()
    committedChangeFlight = work
    void work.finally(() => {
      if (committedChangeFlight === work)
        committedChangeFlight = null
    }).catch(() => undefined)
    return work
  }

  async function startRealtime(uid: string) {
    if (realtimeUid === uid && syncHeadUnsubscribe && allInitialBaselinesReady())
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
    libraryMutationVersion = getLibraryRepository().currentMutationVersion()
    baselineLibraryRecords = libraryRecords(libraryStore.state)
    observedLibraryRecords = baselineLibraryRecords
    const learningStore = useLearningStore()
    const presentation: SyncPresentation = hasLocalWorkspaceData(libraryStore.state, learningStore.progress, learningStore.stats) ? 'background' : 'blocking'
    beginOperation(presentation, 'initial-sync', uid)
    baselineLearningRecords = learningRecords(learningStore.progress, learningStore.stats)
    observedLearningRecords = baselineLearningRecords
    baselineAiSettingsRecords = settingsRecords(loadAiSettings())
    observedAiSettingsRecords = baselineAiSettingsRecords
    realtimeUid = uid
    initialRealtimeLoading = true
    const epoch = realtimeEpoch
    setStatus('connecting')
    setProgressPhase('preparing', i18n.global.t('sync.connecting'), { direction: 'download', retryable: false, presentation })
    const baselineWork = startSyncHead(uid)
    baselineSyncWork = baselineWork
    try {
      // The head is the only realtime listener. Domain documents are fetched
      // once when a head revision changes, so opening the app never re-reads
      // an unchanged library.
      await baselineWork
    }
    catch (syncError) {
      if (epoch === realtimeEpoch)
        handleSyncError(syncError)
    }
    finally {
      if (baselineSyncWork === baselineWork)
        baselineSyncWork = null
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
    if (operationBlocked.value || status.value === 'error' || remoteUpdateAvailable.value || hasPendingLocalChanges()) {
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
      runtime = await loadCloudSyncRuntime()
      auth = await runtime.firebase.configureFirebaseAuth()
    }
    catch (authError) {
      handleSyncError(authError)
      authReady.value = true
      return
    }
    if (!auth)
      return
    runtime.auth.onAuthStateChanged(auth, async nextUser => applyAuthState(nextUser), handleSyncError)
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
    watch([isOnline, appReady, visibility], () => scheduleRemoteSync())
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
    runtime ??= await loadCloudSyncRuntime()
    const auth = runtime.firebase.getFirebaseAuth()
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
      const credential = runtime.auth.GoogleAuthProvider.credential(null, accessToken)
      await runtime.auth.signInWithCredential(auth, credential)
    }
    catch (authError) {
      setError(authError)
    }
  }

  async function signOutAccount() {
    runtime ??= await loadCloudSyncRuntime()
    const auth = runtime.firebase.getFirebaseAuth()
    if (!auth)
      return
    await runtime.auth.signOut(auth)
  }

  const learningStore = useLearningStore()
  learningStore.onMutation(() => {
    if (applyingRemote || !user.value)
      return
    learningLocalChangeVersion += 1
    applyLocalLearningRecords()
  })
  const libraryStore = useLibraryStore()
  libraryStore.onMutation(() => {
    if (applyingRemote || !user.value)
      return
    libraryLocalChangeVersion += 1
    queueLibraryChangeDetection()
  })

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
}

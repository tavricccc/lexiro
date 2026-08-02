import type { Auth, User } from 'firebase/auth'
import type { Unsubscribe } from 'firebase/firestore'
import type { SyncOutboxEntry, SyncRecords } from '@/lib/sync-outbox'
import type { AiSettings, DashboardStats, LearningProgress, LibraryState, SyncStatus } from '@/types'
import { useDocumentVisibility, useOnline } from '@vueuse/core'
import { GoogleAuthProvider, onAuthStateChanged, signInWithCredential, signOut } from 'firebase/auth'
import { onSnapshot } from 'firebase/firestore'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { defaultAiSettings, getShareableAiSettings, loadAiSettings, loadAiSettingsState, onAiSettingsChanged, saveAiSettings } from '@/lib/ai-provider'
import { CloudSyncError, isRetryableSyncError, syncErrorDetails } from '@/lib/cloud-sync-errors'
import { loadCloudOutbox, saveCloudOutbox } from '@/lib/cloud-sync-outbox-storage'
import { reconcileAiSettingsState, reconcileLearningState, reconcileLibraryState } from '@/lib/cloud-sync-reconcile'
import { cloudCollection, cloudDocument, emptyCloudProgress, emptyCloudStats, parseCloudLibrarySnapshot, readCloudLibrary, requireCloudFirestore, writeCloudAiSettings, writeCloudLearningState, writeCloudLibraryChunks } from '@/lib/cloud-sync-remote'
import { normalizeCloudAiSettings, normalizeCloudProgress, normalizeCloudStats } from '@/lib/cloud-sync-schema'
import { configureFirebaseAuth, getFirebaseAuth, isFirebaseConfigured } from '@/lib/firebase'
import { requestGoogleAccessToken } from '@/lib/googleIdentity'
import { stableHash } from '@/lib/hash'
import { i18n } from '@/lib/i18n'
import { setStorageNamespace } from '@/lib/persist'
import { normalizeLibraryState } from '@/lib/share'
import { hasOutboxDomain, incrementOutboxAttempts, learningRecords, libraryRecords, queueRecordChanges, removeOutboxDomain, settingsRecords } from '@/lib/sync-outbox'
import { useAccountStore } from './account'
import { useLearningStore } from './learning'
import { useLibraryStore } from './library'
import { useSessionStore } from './session'
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
  const outbox = ref<SyncOutboxEntry[]>([])

  let libraryUnsubscribe: Unsubscribe | null = null
  let progressUnsubscribe: Unsubscribe | null = null
  let statsUnsubscribe: Unsubscribe | null = null
  let aiSettingsUnsubscribe: Unsubscribe | null = null
  let learningSyncTimer: ReturnType<typeof setTimeout> | null = null
  let librarySyncTimer: ReturnType<typeof setTimeout> | null = null
  let aiSettingsSyncTimer: ReturnType<typeof setTimeout> | null = null
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let retryAttempt = 0
  let started = false
  let activeUid = ''
  let realtimeUid = ''
  let applyingRemote = false
  let libraryBaselineReady = false
  let progressBaselineReady = false
  let statsBaselineReady = false
  let aiSettingsBaselineReady = false
  let libraryDirty = false
  let learningDirty = false
  let knownProgressHash = ''
  let knownStatsHash = ''
  const knownLibraryHashes = new Map<string, string>()
  let baselineLibraryRecords: SyncRecords = {}
  let observedLibraryRecords: SyncRecords = {}
  let baselineLearningRecords: SyncRecords = {}
  let observedLearningRecords: SyncRecords = {}
  let remoteProgress: LearningProgress | null = null
  let remoteStats: DashboardStats | null = null
  let aiSettingsDirty = false
  let baselineAiSettingsRecords: SyncRecords = {}
  let observedAiSettingsRecords: SyncRecords = {}
  let knownAiSettingsHash = ''
  const isOnline = useOnline()
  const visibility = useDocumentVisibility()

  const isSignedIn = computed(() => Boolean(user.value))
  const accountLabel = computed(() => user.value?.displayName || user.value?.email || '')

  async function loadOutbox(uid: string) {
    outbox.value = await loadCloudOutbox(uid)
    pendingWrites.value = outbox.value.length
  }

  async function startAccountSync(uid: string) {
    try {
      await loadOutbox(uid)
      await startRealtime(uid)
    }
    catch (syncError) {
      handleSyncError(syncError)
    }
  }

  function persistOutbox() {
    pendingWrites.value = outbox.value.length
    void saveCloudOutbox(activeUid, outbox.value)
  }

  function replaceOutbox(next: SyncOutboxEntry[]) {
    outbox.value = next
    persistOutbox()
  }

  async function switchLocalNamespace(namespace: string) {
    setStorageNamespace(namespace)
    const libraryStore = useLibraryStore()
    const learningStore = useLearningStore()
    const sessionStore = useSessionStore()
    libraryStore.resetForNamespace()
    learningStore.resetForNamespace()
    sessionStore.resetForNamespace()
    await libraryStore.loadState()
    await learningStore.loadState()
    await sessionStore.loadState()
    await loadAiSettingsState()
  }

  function userCollection(uid: string, name: string) {
    return cloudCollection(requireCloudFirestore(), uid, name)
  }

  function userDocument(uid: string, collectionName: string, id: string) {
    return cloudDocument(requireCloudFirestore(), uid, collectionName, id)
  }

  function clearListeners() {
    libraryUnsubscribe?.()
    progressUnsubscribe?.()
    statsUnsubscribe?.()
    aiSettingsUnsubscribe?.()
    libraryUnsubscribe = null
    progressUnsubscribe = null
    statsUnsubscribe = null
    aiSettingsUnsubscribe = null
    realtimeUid = ''
  }

  function clearSyncTimers() {
    if (learningSyncTimer) {
      clearTimeout(learningSyncTimer)
      learningSyncTimer = null
    }
    if (librarySyncTimer) {
      clearTimeout(librarySyncTimer)
      librarySyncTimer = null
    }
    if (aiSettingsSyncTimer) {
      clearTimeout(aiSettingsSyncTimer)
      aiSettingsSyncTimer = null
    }
  }

  function clearRetryTimer() {
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
  }

  function setStatus(next: SyncStatus) {
    status.value = next
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
    clearSyncTimers()
    if (user.value && isOnline.value && isRetryableSyncError(syncError) && !retryTimer) {
      const delay = Math.min(30000, 2000 * (2 ** Math.min(retryAttempt, 4)))
      retryAttempt += 1
      retryTimer = setTimeout(() => {
        retryTimer = null
        if (user.value && isOnline.value) {
          void startAccountSync(user.value.uid)
        }
      }, delay)
    }
  }

  const handleRealtimeError = handleSyncError

  function markSynced() {
    lastSyncedAt.value = new Date().toISOString()
    pendingWrites.value = outbox.value.length
    if (isOnline.value)
      status.value = 'synced'
    retryAttempt = 0
    clearRetryTimer()
  }

  function reconcileLibraryRemote(remote: LibraryState) {
    const result = reconcileLibraryState(remote, outbox.value)
    const libraryStore = useLibraryStore()
    if (stableHash(result.merged) !== stableHash(libraryStore.state)) {
      withRemoteApplication(() => {
        libraryStore.replaceState(result.merged)
      })
    }
    baselineLibraryRecords = result.baselineRecords
    observedLibraryRecords = result.observedRecords
    replaceOutbox([...removeOutboxDomain(outbox.value, 'library'), ...result.accepted])
    libraryDirty = result.dirty
    if (libraryDirty)
      scheduleLibrarySync()
  }

  async function refreshLibraryRemote(uid: string) {
    const remote = await readCloudLibrary(requireCloudFirestore(), uid)
    reconcileLibraryRemote(normalizeLibraryState(remote.library))
    knownLibraryHashes.clear()
    for (const [chunkId, checksum] of remote.hashes)
      knownLibraryHashes.set(chunkId, checksum)
  }

  function reconcileLearningRemote(progress: LearningProgress, stats: DashboardStats) {
    if (!progressBaselineReady || !statsBaselineReady)
      return
    const result = reconcileLearningState(progress, stats, outbox.value)
    const learningStore = useLearningStore()
    if (stableHash(result.merged.progress) !== stableHash(learningStore.progress)) {
      withRemoteApplication(() => {
        learningStore.replaceProgress(result.merged.progress)
      })
    }
    if (stableHash(result.merged.stats) !== stableHash(learningStore.stats)) {
      withRemoteApplication(() => {
        learningStore.replaceStats(result.merged.stats)
      })
    }
    baselineLearningRecords = result.baselineRecords
    observedLearningRecords = result.observedRecords
    replaceOutbox([...removeOutboxDomain(outbox.value, 'learning'), ...result.accepted])
    learningDirty = result.dirty
    if (learningDirty)
      scheduleLearningSync()
  }

  function reconcileAiSettingsRemote(remote: Omit<AiSettings, 'apiKey'> | null) {
    if (!aiSettingsBaselineReady)
      return
    const localSettings = loadAiSettings()
    const result = reconcileAiSettingsState(remote, localSettings, outbox.value)
    if (stableHash(getShareableAiSettings(result.merged)) !== stableHash(getShareableAiSettings(localSettings))) {
      withRemoteApplication(() => {
        saveAiSettings(result.merged)
      })
    }
    baselineAiSettingsRecords = result.baselineRecords
    observedAiSettingsRecords = result.observedRecords
    knownAiSettingsHash = stableHash(remote ?? null)
    replaceOutbox([...removeOutboxDomain(outbox.value, 'settings'), ...result.accepted])
    aiSettingsDirty = result.dirty
    if (aiSettingsDirty)
      scheduleAiSettingsSync()
  }

  function applyRemoteLibraryChanges(uid: string) {
    libraryUnsubscribe = onSnapshot(userCollection(uid, 'library'), (snapshot) => {
      libraryBaselineReady = true
      try {
        const remote = parseCloudLibrarySnapshot(snapshot, uid)
        reconcileLibraryRemote(normalizeLibraryState(remote.library))
        knownLibraryHashes.clear()
        for (const [chunkId, checksum] of remote.hashes)
          knownLibraryHashes.set(chunkId, checksum)
        markSynced()
      }
      catch (syncError) {
        handleSyncError(syncError)
      }
    }, handleRealtimeError)
  }

  function applyRemoteLearningChanges(uid: string) {
    progressUnsubscribe = onSnapshot(userDocument(uid, 'progress', 'global'), (snapshot) => {
      progressBaselineReady = true
      if (snapshot.exists()) {
        try {
          remoteProgress = normalizeCloudProgress(snapshot.data(), uid)
        }
        catch (syncError) {
          handleSyncError(syncError)
          return
        }
      }
      else {
        remoteProgress = emptyCloudProgress()
      }
      if (remoteProgress && remoteStats)
        reconcileLearningRemote(remoteProgress, remoteStats)
      if (remoteProgress)
        knownProgressHash = snapshot.exists() ? stableHash(remoteProgress) : ''
      markSynced()
    }, handleRealtimeError)
    statsUnsubscribe = onSnapshot(userDocument(uid, 'stats', 'summary'), (snapshot) => {
      statsBaselineReady = true
      if (!snapshot.exists()) {
        remoteStats = emptyCloudStats()
        if (remoteProgress)
          reconcileLearningRemote(remoteProgress, remoteStats)
        markSynced()
        return
      }
      let remoteStatsData: DashboardStats
      try {
        remoteStatsData = normalizeCloudStats(snapshot.data(), uid)
      }
      catch (syncError) {
        handleSyncError(syncError)
        return
      }
      remoteStats = remoteStatsData
      if (remoteProgress)
        reconcileLearningRemote(remoteProgress, remoteStatsData)
      knownStatsHash = stableHash(remoteStatsData)
      markSynced()
    }, handleRealtimeError)
  }

  function applyRemoteAiSettingsChanges(uid: string) {
    aiSettingsUnsubscribe = onSnapshot(userDocument(uid, 'settings', 'ai'), (snapshot) => {
      aiSettingsBaselineReady = true
      if (!snapshot.exists()) {
        reconcileAiSettingsRemote(null)
        markSynced()
        return
      }
      try {
        const normalized = normalizeCloudAiSettings(snapshot.data(), uid)
        reconcileAiSettingsRemote(normalized)
        knownAiSettingsHash = stableHash(normalized)
        markSynced()
      }
      catch (syncError) {
        handleSyncError(syncError)
      }
    }, handleRealtimeError)
  }

  async function flushLearning() {
    if (!user.value || !progressBaselineReady || !statsBaselineReady || !learningDirty)
      return
    const learningStore = useLearningStore()
    const uid = user.value.uid
    pendingWrites.value = Math.max(pendingWrites.value, 1)
    setStatus('syncing')
    try {
      const result = await writeCloudLearningState(
        requireCloudFirestore(),
        uid,
        learningStore.progress,
        learningStore.stats,
        { progress: knownProgressHash, stats: knownStatsHash },
      )
      const { progress: progressResult, stats: statsResult, progressHash, statsHash, progressChanged, statsChanged } = result
      if (!progressResult.written || !statsResult.written) {
        if (!progressResult.written) {
          remoteProgress = progressResult.current === null ? emptyCloudProgress() : normalizeCloudProgress(progressResult.current, uid)
          knownProgressHash = progressResult.current === null ? '' : stableHash(remoteProgress)
        }
        else if (progressChanged) {
          remoteProgress = learningStore.progress
          knownProgressHash = progressHash
        }
        if (!statsResult.written) {
          remoteStats = statsResult.current === null ? emptyCloudStats() : normalizeCloudStats(statsResult.current, uid)
          knownStatsHash = statsResult.current === null ? '' : stableHash(remoteStats)
        }
        else if (statsChanged) {
          remoteStats = learningStore.stats
          knownStatsHash = statsHash
        }
        if (remoteProgress && remoteStats)
          reconcileLearningRemote(remoteProgress, remoteStats)
        scheduleLearningSync()
        markSynced()
        return
      }
      if (progressChanged)
        knownProgressHash = progressHash
      if (statsChanged)
        knownStatsHash = statsHash
      learningDirty = false
      replaceOutbox(removeOutboxDomain(outbox.value, 'learning'))
      markSynced()
    }
    catch (syncError) {
      replaceOutbox(incrementOutboxAttempts(outbox.value, 'learning'))
      handleSyncError(syncError)
    }
  }

  async function flushLibrary() {
    if (!user.value || applyingRemote || !libraryBaselineReady || !libraryDirty)
      return
    const libraryStore = useLibraryStore()
    pendingWrites.value = Math.max(pendingWrites.value, 1)
    setStatus('syncing')
    try {
      const uid = user.value.uid
      const result = await writeCloudLibraryChunks(requireCloudFirestore(), uid, libraryStore.state, knownLibraryHashes)
      knownLibraryHashes.clear()
      for (const [chunkId, checksum] of result.hashes)
        knownLibraryHashes.set(chunkId, checksum)
      if (result.conflicted) {
        await refreshLibraryRemote(uid)
        scheduleLibrarySync()
        markSynced()
        return
      }
      libraryDirty = false
      replaceOutbox(removeOutboxDomain(outbox.value, 'library'))
      markSynced()
    }
    catch (syncError) {
      replaceOutbox(incrementOutboxAttempts(outbox.value, 'library'))
      handleSyncError(syncError)
    }
  }

  async function flushAiSettings() {
    if (!user.value || !aiSettingsBaselineReady || !aiSettingsDirty)
      return
    pendingWrites.value = Math.max(pendingWrites.value, 1)
    setStatus('syncing')
    try {
      const uid = user.value.uid
      const result = await writeCloudAiSettings(requireCloudFirestore(), uid, loadAiSettings(), knownAiSettingsHash)
      if (!result.result.written) {
        const remote = result.result.current === null ? null : normalizeCloudAiSettings(result.result.current, uid)
        knownAiSettingsHash = remote ? stableHash(remote) : ''
        reconcileAiSettingsRemote(remote)
        scheduleAiSettingsSync()
        markSynced()
        return
      }
      if (result.changed)
        knownAiSettingsHash = result.hash
      aiSettingsDirty = false
      baselineAiSettingsRecords = settingsRecords(loadAiSettings())
      observedAiSettingsRecords = baselineAiSettingsRecords
      replaceOutbox(removeOutboxDomain(outbox.value, 'settings'))
      markSynced()
    }
    catch (syncError) {
      replaceOutbox(incrementOutboxAttempts(outbox.value, 'settings'))
      handleSyncError(syncError)
    }
  }

  async function flushAll() {
    if (!user.value)
      return
    await Promise.all([flushLearning(), flushLibrary(), flushAiSettings()])
  }

  function scheduleLearningSync() {
    if (!user.value)
      return
    if (learningSyncTimer)
      clearTimeout(learningSyncTimer)
    learningSyncTimer = setTimeout(() => void flushLearning(), 1200)
  }

  function scheduleLibrarySync() {
    if (!user.value || applyingRemote)
      return
    if (librarySyncTimer)
      clearTimeout(librarySyncTimer)
    librarySyncTimer = setTimeout(() => void flushLibrary(), 1200)
  }

  function scheduleAiSettingsSync() {
    if (!user.value || applyingRemote)
      return
    if (aiSettingsSyncTimer)
      clearTimeout(aiSettingsSyncTimer)
    aiSettingsSyncTimer = setTimeout(() => void flushAiSettings(), 1200)
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
    realtimeUid = uid
    setStatus('connecting')
    try {
      applyRemoteLibraryChanges(uid)
      applyRemoteLearningChanges(uid)
      applyRemoteAiSettingsChanges(uid)
    }
    catch (syncError) {
      handleSyncError(syncError)
    }
  }

  function stopRealtime() {
    clearListeners()
    if (user.value)
      setStatus('offline')
  }

  function retryConnection() {
    if (user.value) {
      clearRetryTimer()
      retryAttempt = 0
      error.value = ''
      void startAccountSync(user.value.uid)
    }
  }

  async function init() {
    if (started)
      return
    started = true
    configured.value = isFirebaseConfigured()
    if (!configured.value) {
      status.value = 'disabled'
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
      if (!online) {
        stopRealtime()
        return
      }
      if (pageVisibility === 'visible' && realtimeUid !== user.value.uid)
        void startAccountSync(user.value.uid)
    })
  }

  async function applyAuthState(nextUser: User | null) {
    try {
      const identityChanged = nextUser?.uid !== activeUid
      if (identityChanged) {
        libraryBaselineReady = false
        progressBaselineReady = false
        statsBaselineReady = false
        libraryDirty = false
        learningDirty = false
        knownProgressHash = ''
        knownStatsHash = ''
        knownLibraryHashes.clear()
        aiSettingsBaselineReady = false
        aiSettingsDirty = false
        baselineAiSettingsRecords = {}
        observedAiSettingsRecords = {}
        knownAiSettingsHash = ''
        await switchLocalNamespace(nextUser?.uid || 'guest')
      }
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
      }
    }
    catch (authStateError) {
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
    const hasGuestAiSettings = stableHash(getShareableAiSettings(loadAiSettings())) !== stableHash(getShareableAiSettings(defaultAiSettings))
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
    if (applyingRemote || !progressBaselineReady || !statsBaselineReady)
      return
    const current = learningRecords(learningStore.progress, learningStore.stats)
    const next = queueRecordChanges('learning', baselineLearningRecords, observedLearningRecords, current, outbox.value)
    observedLearningRecords = current
    replaceOutbox(next)
    learningDirty = hasOutboxDomain(next, 'learning')
    scheduleLearningSync()
  }, { deep: true })
  const libraryStore = useLibraryStore()
  watch(() => libraryStore.state, () => {
    if (applyingRemote || !libraryBaselineReady)
      return
    const current = libraryRecords(libraryStore.state)
    const next = queueRecordChanges('library', baselineLibraryRecords, observedLibraryRecords, current, outbox.value)
    observedLibraryRecords = current
    replaceOutbox(next)
    libraryDirty = hasOutboxDomain(next, 'library')
    scheduleLibrarySync()
  }, { deep: true })

  onAiSettingsChanged(() => {
    if (applyingRemote || !aiSettingsBaselineReady)
      return
    const current = settingsRecords(loadAiSettings())
    const next = queueRecordChanges('settings', baselineAiSettingsRecords, observedAiSettingsRecords, current, outbox.value)
    observedAiSettingsRecords = current
    replaceOutbox(next)
    aiSettingsDirty = hasOutboxDomain(next, 'settings')
    scheduleAiSettingsSync()
  })

  return {
    configured,
    authReady,
    user,
    status,
    error,
    lastSyncedAt,
    pendingWrites,
    isSignedIn,
    accountLabel,
    init,
    signIn,
    signOutAccount,
    flushLearning,
    flushAiSettings,
    flushAll,
    retryConnection,
  }
})

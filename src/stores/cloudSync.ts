import type { User } from 'firebase/auth'
import type { Unsubscribe } from 'firebase/firestore'
import type { FirestoreDailyStatsDoc, FirestoreLibraryChunk, FirestoreProgressDoc, FirestoreSetDoc, FirestoreStatsDoc, LibraryState, SetSyncConflict, SyncStatus, VocabFolder, VocabSetMember, WordEntry } from '@/types'
import { useDocumentVisibility, useOnline } from '@vueuse/core'
import { GoogleAuthProvider, onAuthStateChanged, signInWithCredential, signOut } from 'firebase/auth'
import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore'
import { defineStore, storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { configureFirebaseAuth, getFirebaseAuth, getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase'
import { requestGoogleAccessToken } from '@/lib/googleIdentity'
import { estimateJsonBytes, stableHash } from '@/lib/hash'
import { deduplicateSetsByName, isRemoteSetNewer } from '@/lib/set-utils'
import { useAccountStore } from './account'
import { useLearningStore } from './learning'
import { useLibraryStore } from './library'
import { useSetsStore } from './sets'

const SCHEMA_VERSION = 2
const MAX_SET_BYTES = 700 * 1024
const MAX_LIBRARY_CHUNK_BYTES = 420 * 1024

export const useCloudSyncStore = defineStore('cloudSync', () => {
  const configured = ref(isFirebaseConfigured())
  const accountStore = useAccountStore()
  const authReady = ref(false)
  const user = ref<User | null>(null)
  const status = ref<SyncStatus>(configured.value ? 'signed-out' : 'disabled')
  const error = ref('')
  const lastSyncedAt = ref('')
  const pendingWrites = ref(0)
  const conflicts = ref<SetSyncConflict[]>([])

  let setsUnsubscribe: Unsubscribe | null = null
  let libraryUnsubscribe: Unsubscribe | null = null
  let progressUnsubscribe: Unsubscribe | null = null
  let statsUnsubscribe: Unsubscribe | null = null
  let setSyncTimer: ReturnType<typeof setTimeout> | null = null
  let learningSyncTimer: ReturnType<typeof setTimeout> | null = null
  let librarySyncTimer: ReturnType<typeof setTimeout> | null = null
  let started = false
  let activeUid = ''
  let realtimeUid = ''
  let syncPaused = false
  let applyingRemote = false
  let previousSetIds = new Set<string>()
  const knownSetHashes = new Map<string, string>()
  const knownProgressHashes = new Map<string, string>()
  let knownStatsHash = ''
  let knownDailyHash = ''
  const knownLibraryHashes = new Map<string, string>()
  const isOnline = useOnline()
  const visibility = useDocumentVisibility()

  const isSignedIn = computed(() => Boolean(user.value))
  const accountLabel = computed(() => user.value?.displayName || user.value?.email || '')

  function userCollection(uid: string, name: string) {
    const db = getFirebaseFirestore()
    if (!db)
      throw new Error('Firebase 尚未設定')
    return collection(db, 'users', uid, name)
  }

  function userDocument(uid: string, collectionName: string, id: string) {
    const db = getFirebaseFirestore()
    if (!db)
      throw new Error('Firebase 尚未設定')
    return doc(db, 'users', uid, collectionName, id)
  }

  function dailyStatsDocument(uid: string, day: string) {
    const db = getFirebaseFirestore()
    if (!db)
      throw new Error('Firebase 尚未設定')
    return doc(db, 'users', uid, 'stats', 'daily', day)
  }

  function clearListeners() {
    setsUnsubscribe?.()
    libraryUnsubscribe?.()
    progressUnsubscribe?.()
    statsUnsubscribe?.()
    setsUnsubscribe = null
    libraryUnsubscribe = null
    progressUnsubscribe = null
    statsUnsubscribe = null
    realtimeUid = ''
  }

  function clearSyncTimers() {
    if (setSyncTimer) {
      clearTimeout(setSyncTimer)
      setSyncTimer = null
    }
    if (learningSyncTimer) {
      clearTimeout(learningSyncTimer)
      learningSyncTimer = null
    }
    if (librarySyncTimer) {
      clearTimeout(librarySyncTimer)
      librarySyncTimer = null
    }
  }

  function pauseSync() {
    syncPaused = true
    clearListeners()
    clearSyncTimers()
  }

  function setStatus(next: SyncStatus) {
    status.value = next
  }

  function explainSyncError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error)
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
    const normalized = `${code} ${message}`.toLowerCase()
    if (normalized.includes('err_blocked_by_client') || normalized.includes('blocked by client'))
      return '雲端同步已暫停：Firestore 請求被瀏覽器擴充功能或網路攔截。請停用攔截後再按「重新連線」。'
    if (normalized.includes('app check') || normalized.includes('recaptcha') || normalized.includes('token is invalid'))
      return '雲端同步已暫停：Firebase App Check／reCAPTCHA 驗證失敗。請確認是 Enterprise Website score-based site key（不是 checkbox key）；若在 localhost，請改用已註冊的 App Check debug token。'
    if (normalized.includes('permission-denied') || normalized.includes('missing or insufficient permissions'))
      return '雲端同步已暫停：Firestore Rules 或 App Check 拒絕這次存取。請確認登入帳號、Rules、site key 與部署網域。'
    if (normalized.includes('unauthenticated') || normalized.includes('auth'))
      return '登入狀態已失效，請重新登入 Google。'
    if (normalized.includes('unavailable') || normalized.includes('network'))
      return '網路或 Firebase 暫時無法連線，稍後可重新連線。'
    return message || 'Firebase 回傳未命名的同步錯誤。'
  }

  function setError(syncError: unknown) {
    error.value = explainSyncError(syncError)
    status.value = 'error'
  }

  function handleSyncError(syncError: unknown) {
    pauseSync()
    setError(syncError)
  }

  const handleRealtimeError = handleSyncError

  function markSynced() {
    lastSyncedAt.value = new Date().toISOString()
    pendingWrites.value = 0
    if (isOnline.value)
      status.value = 'synced'
  }

  function toSetDoc(uid: string, set: FirestoreSetDoc): FirestoreSetDoc {
    const plain = JSON.parse(JSON.stringify(set)) as FirestoreSetDoc
    const now = new Date().toISOString()
    return {
      ...plain,
      ownerId: uid,
      schemaVersion: SCHEMA_VERSION,
      checksum: stableHash({ id: plain.id, setName: plain.setName, difficulty: plain.difficulty, items: plain.items }),
      updatedAt: plain.updatedAt || now,
    }
  }

  type LibrarySection = FirestoreLibraryChunk['section']

  function buildLibraryChunks(uid: string, library: LibraryState): FirestoreLibraryChunk[] {
    const sections: { section: LibrarySection, items: unknown[] }[] = [
      { section: 'words', items: Object.values(library.words) },
      { section: 'memberships', items: Object.entries(library.memberships).map(([setId, members]) => ({ setId, members })) },
      { section: 'folders', items: library.folders },
      { section: 'questions', items: library.questions },
    ]
    const chunks: FirestoreLibraryChunk[] = []
    for (const { section, items } of sections) {
      let current: unknown[] = []
      let sectionIndex = 0
      for (const item of items) {
        const candidate = { ownerId: uid, schemaVersion: SCHEMA_VERSION, chunkId: '', updatedAt: library.updatedAt, checksum: '', section, items: [...current, item] } as FirestoreLibraryChunk
        if (current.length && estimateJsonBytes(candidate) > MAX_LIBRARY_CHUNK_BYTES) {
          chunks.push(candidateForSection(uid, library, section, current, sectionIndex))
          sectionIndex += 1
          current = []
        }
        current.push(item)
      }
      if (current.length || !items.length)
        chunks.push(candidateForSection(uid, library, section, current, sectionIndex))
    }
    return chunks
  }

  function candidateForSection(uid: string, library: LibraryState, section: LibrarySection, items: unknown[], index: number): FirestoreLibraryChunk {
    const base = { ownerId: uid, schemaVersion: SCHEMA_VERSION, chunkId: `${section}-${String(index + 1).padStart(3, '0')}`, updatedAt: library.updatedAt, section, items } as FirestoreLibraryChunk
    return { ...base, checksum: stableHash(base) }
  }

  function combineLibraryChunks(chunks: FirestoreLibraryChunk[]): LibraryState {
    const words: Record<string, WordEntry> = {}
    const memberships: Record<string, VocabSetMember[]> = {}
    const folders: VocabFolder[] = []
    const questions: LibraryState['questions'] = []
    let updatedAt = ''
    for (const chunk of chunks) {
      updatedAt = chunk.updatedAt > updatedAt ? chunk.updatedAt : updatedAt
      if (chunk.section === 'words') {
        for (const word of chunk.items)
          words[word.wordKey] = word
      }
      else if (chunk.section === 'memberships') {
        for (const entry of chunk.items)
          memberships[entry.setId] = entry.members
      }
      else if (chunk.section === 'folders') {
        folders.push(...chunk.items)
      }
      else {
        questions.push(...chunk.items)
      }
    }
    return { version: SCHEMA_VERSION, words, memberships, folders, questions, updatedAt: updatedAt || new Date().toISOString() }
  }

  async function writeSet(uid: string, set: FirestoreSetDoc) {
    const payload = toSetDoc(uid, set)
    if (estimateJsonBytes(payload) > MAX_SET_BYTES)
      throw new Error(`「${payload.setName}」資料過大，請拆成較小的單字集。`)
    await setDoc(userDocument(uid, 'sets', payload.id), payload)
    knownSetHashes.set(payload.id, payload.checksum)
  }

  async function writeLibraryChunks(uid: string, library: LibraryState) {
    const chunks = buildLibraryChunks(uid, library)
    const liveIds = new Set(chunks.map(chunk => chunk.chunkId))
    const writes: Promise<void>[] = chunks
      .filter(chunk => knownLibraryHashes.get(chunk.chunkId) !== chunk.checksum)
      .map(chunk => setDoc(userDocument(uid, 'library', chunk.chunkId), chunk).then(() => {
        knownLibraryHashes.set(chunk.chunkId, chunk.checksum)
      }))
    for (const oldId of Array.from(knownLibraryHashes.keys())) {
      if (!liveIds.has(oldId)) {
        writes.push(deleteDoc(userDocument(uid, 'library', oldId)).then(() => {
          knownLibraryHashes.delete(oldId)
        }))
      }
    }
    if (writes.length)
      await Promise.all(writes)
  }

  function applyRemoteSetChanges(uid: string) {
    setsUnsubscribe = onSnapshot(userCollection(uid, 'sets'), (snapshot) => {
      const setsStore = useSetsStore()
      const remoteSets = deduplicateSetsByName(snapshot.docs.map(item => item.data() as FirestoreSetDoc))
      const remoteMap = new Map(remoteSets.map(set => [set.id, set]))
      const nextSets = setsStore.sets.filter(set => remoteMap.has(set.id) || !knownSetHashes.has(set.id))
      const writes: Promise<void>[] = []
      for (const remote of remoteSets) {
        const local = setsStore.sets.find(set => set.id === remote.id)
        if (!local) {
          nextSets.push(remote)
          knownSetHashes.set(remote.id, remote.checksum)
          continue
        }
        const localHash = stableHash({ id: local.id, setName: local.setName, difficulty: local.difficulty, items: local.items })
        if (localHash === remote.checksum || knownSetHashes.get(remote.id) === remote.checksum) {
          knownSetHashes.set(remote.id, remote.checksum)
        }
        else if (isRemoteSetNewer(local, remote)) {
          const index = nextSets.findIndex(set => set.id === remote.id)
          if (index >= 0)
            nextSets[index] = remote
          knownSetHashes.set(remote.id, remote.checksum)
        }
        else if (!applyingRemote) {
          writes.push(writeSet(uid, local as FirestoreSetDoc))
        }
      }
      const canonicalNextSets = deduplicateSetsByName(nextSets)
      const canonicalNextIds = new Set(canonicalNextSets.map(set => set.id))
      for (const remote of remoteSets) {
        if (!canonicalNextIds.has(remote.id))
          writes.push(deleteDoc(userDocument(uid, 'sets', remote.id)).then(() => undefined))
      }
      for (const local of setsStore.sets) {
        const canonical = canonicalNextSets.find(set => set.setName.trim().toLocaleLowerCase() === local.setName.trim().toLocaleLowerCase())
        if (canonical?.id === local.id && !remoteMap.has(local.id))
          writes.push(writeSet(uid, local as FirestoreSetDoc))
      }
      const setsChanged = canonicalNextSets.length !== setsStore.sets.length || canonicalNextSets.some((set, index) => {
        const current = setsStore.sets[index]
        if (!current || current.id !== set.id)
          return true
        return stableHash({ id: current.id, setName: current.setName, difficulty: current.difficulty, items: current.items }) !== stableHash({ id: set.id, setName: set.setName, difficulty: set.difficulty, items: set.items })
      })
      if (!applyingRemote && setsChanged) {
        applyingRemote = true
        try {
          setsStore.applyRemoteSets(canonicalNextSets)
        }
        finally {
          applyingRemote = false
        }
      }
      previousSetIds = new Set(canonicalNextSets.map(set => set.id))
      if (writes.length)
        void Promise.all(writes).catch(handleSyncError)
      markSynced()
    }, handleRealtimeError)
  }

  function applyRemoteLibraryChanges(uid: string) {
    libraryUnsubscribe = onSnapshot(userCollection(uid, 'library'), (snapshot) => {
      if (!snapshot.docs.length)
        return
      const chunks = snapshot.docs
        .map(item => item.data() as FirestoreLibraryChunk)
        .filter(item => item.section && Array.isArray(item.items))
      if (!chunks.length)
        return
      const libraryStore = useLibraryStore()
      const remote = combineLibraryChunks(chunks)
      const remoteHash = stableHash(remote)
      const localHash = stableHash(libraryStore.state)
      if (remoteHash === localHash)
        return
      applyingRemote = true
      try {
        libraryStore.replaceState(remote)
        for (const chunk of chunks)
          knownLibraryHashes.set(chunk.chunkId, chunk.checksum)
      }
      finally {
        applyingRemote = false
      }
      markSynced()
    }, handleRealtimeError)
  }

  function applyRemoteLearningChanges(uid: string) {
    progressUnsubscribe = onSnapshot(userCollection(uid, 'progress'), (snapshot) => {
      const learningStore = useLearningStore()
      const remoteProgressIds = new Set<string>()
      for (const item of snapshot.docs) {
        const remote = item.data() as FirestoreProgressDoc
        remoteProgressIds.add(remote.setId)
        const local = learningStore.progressBySet[remote.setId]
        if (!local || new Date(remote.updatedAt).getTime() > new Date(local.updatedAt).getTime()) {
          learningStore.progressBySet[remote.setId] = remote
          knownProgressHashes.set(remote.setId, stableHash(remote))
        }
      }
      const writes = Object.values(learningStore.progressBySet)
        .filter(progress => !remoteProgressIds.has(progress.setId))
        .filter(progress => knownProgressHashes.get(progress.setId) !== stableHash(progress))
        .map((progress) => {
          knownProgressHashes.set(progress.setId, stableHash(progress))
          return setDoc(userDocument(uid, 'progress', progress.setId), {
            ...progress,
            ownerId: uid,
            schemaVersion: SCHEMA_VERSION,
          })
        })
      learningStore.saveState()
      if (writes.length)
        void Promise.all(writes).catch(handleSyncError)
      markSynced()
    }, handleRealtimeError)
    statsUnsubscribe = onSnapshot(userDocument(uid, 'stats', 'summary'), (snapshot) => {
      const learningStore = useLearningStore()
      if (!snapshot.exists()) {
        const localHash = stableHash(learningStore.stats)
        if (knownStatsHash !== localHash) {
          knownStatsHash = localHash
          void setDoc(userDocument(uid, 'stats', 'summary'), {
            ...learningStore.stats,
            ownerId: uid,
            schemaVersion: SCHEMA_VERSION,
          }).catch(handleSyncError)
        }
        return
      }
      const remote = snapshot.data() as FirestoreStatsDoc
      if (new Date(remote.updatedAt).getTime() > new Date(learningStore.stats.updatedAt).getTime()) {
        learningStore.stats = {
          ...learningStore.stats,
          ...remote,
          todayLearningReviews: remote.todayLearningReviews ?? remote.todayReviews,
          todayLearningCorrectReviews: remote.todayLearningCorrectReviews ?? remote.todayCorrectReviews,
        }
        learningStore.setDailyWordGoal(remote.dailyWordGoal ?? remote.dailyGoal)
        learningStore.setDailyQuestionGoal(remote.dailyQuestionGoal ?? learningStore.stats.dailyQuestionGoal)
        knownStatsHash = stableHash(remote)
        learningStore.saveState()
      }
    }, handleRealtimeError)
  }

  async function flushLearning() {
    if (!user.value || syncPaused)
      return
    const learningStore = useLearningStore()
    pendingWrites.value += 1
    setStatus('syncing')
    try {
      const writes = Object.values(learningStore.progressBySet)
        .filter(progress => knownProgressHashes.get(progress.setId) !== stableHash(progress))
        .map((progress) => {
          const progressHash = stableHash(progress)
          return setDoc(
            userDocument(user.value!.uid, 'progress', progress.setId),
            { ...progress, ownerId: user.value!.uid, schemaVersion: SCHEMA_VERSION },
          ).then(() => {
            knownProgressHashes.set(progress.setId, progressHash)
          })
        })
      const statsHash = stableHash(learningStore.stats)
      if (knownStatsHash !== statsHash) {
        writes.push(setDoc(userDocument(user.value.uid, 'stats', 'summary'), {
          ...learningStore.stats,
          ownerId: user.value.uid,
          schemaVersion: SCHEMA_VERSION,
        }).then(() => {
          knownStatsHash = statsHash
        }))
      }
      if (learningStore.stats.todayReviews > 0 || learningStore.stats.todayQuestionReviews > 0) {
        const daily: FirestoreDailyStatsDoc = {
          date: learningStore.stats.lastStudyDate,
          reviews: learningStore.stats.todayReviews,
          correctReviews: learningStore.stats.todayCorrectReviews,
          questionReviews: learningStore.stats.todayQuestionReviews,
          correctQuestionReviews: learningStore.stats.todayQuestionCorrectReviews,
          xpEarned: learningStore.stats.xp,
          updatedAt: learningStore.stats.updatedAt,
          ownerId: user.value.uid,
          schemaVersion: SCHEMA_VERSION,
        }
        const dailyHash = stableHash(daily)
        if (dailyHash !== knownDailyHash) {
          writes.push(setDoc(dailyStatsDocument(user.value.uid, daily.date), daily).then(() => {
            knownDailyHash = dailyHash
          }))
        }
      }
      if (!writes.length) {
        markSynced()
        return
      }
      await Promise.all(writes)
      markSynced()
    }
    catch (syncError) {
      handleSyncError(syncError)
    }
  }

  async function flushLibrary() {
    if (!user.value || syncPaused || applyingRemote)
      return
    const libraryStore = useLibraryStore()
    pendingWrites.value += 1
    setStatus('syncing')
    try {
      await writeLibraryChunks(user.value.uid, libraryStore.state)
      markSynced()
    }
    catch (syncError) {
      handleSyncError(syncError)
    }
  }

  async function flushAll() {
    if (!user.value || syncPaused)
      return
    await Promise.all([flushLearning(), flushLibrary()])
  }

  function scheduleLearningSync() {
    if (!user.value || syncPaused)
      return
    if (learningSyncTimer)
      clearTimeout(learningSyncTimer)
    learningSyncTimer = setTimeout(() => void flushLearning(), 1200)
  }

  function scheduleLibrarySync() {
    if (!user.value || syncPaused || applyingRemote)
      return
    if (librarySyncTimer)
      clearTimeout(librarySyncTimer)
    librarySyncTimer = setTimeout(() => void flushLibrary(), 1200)
  }

  function scheduleSetSync(nextSets: FirestoreSetDoc[]) {
    if (!user.value || syncPaused || applyingRemote)
      return
    if (setSyncTimer)
      clearTimeout(setSyncTimer)
    pendingWrites.value = Math.max(1, pendingWrites.value)
    setStatus('syncing')
    setSyncTimer = setTimeout(async () => {
      const currentIds = new Set(nextSets.map(set => set.id))
      try {
        const writes = nextSets
          .filter(set => knownSetHashes.get(set.id) !== stableHash({ id: set.id, setName: set.setName, difficulty: set.difficulty, items: set.items }))
          .map(set => writeSet(user.value!.uid, set))
        for (const oldId of previousSetIds) {
          if (!currentIds.has(oldId))
            writes.push(deleteDoc(userDocument(user.value!.uid, 'sets', oldId)).then(() => undefined))
        }
        await Promise.all(writes)
        previousSetIds = currentIds
        markSynced()
      }
      catch (syncError) {
        handleSyncError(syncError)
      }
    }, 900)
  }

  async function startRealtime(uid: string) {
    if (syncPaused)
      return
    if (realtimeUid === uid && setsUnsubscribe && libraryUnsubscribe && progressUnsubscribe && statsUnsubscribe)
      return
    clearListeners()
    realtimeUid = uid
    setStatus('connecting')
    try {
      applyRemoteSetChanges(uid)
      applyRemoteLibraryChanges(uid)
      applyRemoteLearningChanges(uid)
    }
    catch (syncError) {
      handleSyncError(syncError)
    }
  }

  function stopRealtime() {
    clearListeners()
    if (user.value)
      setStatus(navigator.onLine ? 'offline' : 'offline')
  }

  function retryConnection() {
    if (user.value) {
      syncPaused = false
      error.value = ''
      void startRealtime(user.value.uid)
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
    const auth = await configureFirebaseAuth()
    if (!auth)
      return
    onAuthStateChanged(auth, async (nextUser) => {
      if (nextUser?.uid !== activeUid) {
        knownSetHashes.clear()
        knownProgressHashes.clear()
        knownStatsHash = ''
        knownDailyHash = ''
        knownLibraryHashes.clear()
        previousSetIds = new Set()
        syncPaused = false
      }
      activeUid = nextUser?.uid || ''
      user.value = nextUser
      if (nextUser)
        accountStore.setProfile(nextUser.displayName || nextUser.email || '', nextUser.photoURL || '')
      else
        accountStore.clearProfile()
      authReady.value = true
      if (nextUser) {
        void startRealtime(nextUser.uid)
      }
      else {
        clearListeners()
        status.value = 'signed-out'
      }
    })
    watch([isOnline, visibility], ([online, pageVisibility]) => {
      if (!user.value)
        return
      if (!online) {
        stopRealtime()
        return
      }
      if (pageVisibility === 'visible' && realtimeUid !== user.value.uid)
        void startRealtime(user.value.uid)
    })
  }

  async function signIn() {
    const auth = getFirebaseAuth()
    if (!auth) {
      setError('尚未設定 Firebase，請先完成環境變數設定。')
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

  async function resolveConflict(setId: string, choice: 'local' | 'remote') {
    const conflict = conflicts.value.find(item => item.setId === setId)
    if (!conflict || !user.value)
      return
    try {
      const setsStore = useSetsStore()
      if (choice === 'remote') {
        applyingRemote = true
        try {
          setsStore.applyRemoteSets(setsStore.sets.map(set => set.id === setId ? conflict.remote : set))
          knownSetHashes.set(setId, conflict.remote.checksum)
        }
        finally {
          applyingRemote = false
        }
      }
      else {
        await writeSet(user.value.uid, conflict.local as FirestoreSetDoc)
      }
      conflicts.value = conflicts.value.filter(item => item.setId !== setId)
    }
    catch (syncError) {
      handleSyncError(syncError)
    }
  }

  const setsStore = useSetsStore()
  const learningStore = useLearningStore()
  const { sets } = storeToRefs(setsStore)
  watch(sets, (nextSets) => {
    if (user.value)
      scheduleSetSync(nextSets as FirestoreSetDoc[])
  }, { deep: true })
  watch(() => [learningStore.progressBySet, learningStore.stats], () => scheduleLearningSync(), { deep: true })
  const libraryStore = useLibraryStore()
  watch(() => libraryStore.state, () => scheduleLibrarySync(), { deep: true })

  return {
    configured,
    authReady,
    user,
    status,
    error,
    lastSyncedAt,
    pendingWrites,
    conflicts,
    isSignedIn,
    accountLabel,
    init,
    signIn,
    signOutAccount,
    flushLearning,
    flushAll,
    retryConnection,
    resolveConflict,
  }
})

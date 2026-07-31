import type { User } from 'firebase/auth'
import type { Unsubscribe } from 'firebase/firestore'
import type { FirestoreDailyStatsDoc, FirestoreProgressDoc, FirestoreSetDoc, FirestoreStatsDoc, SetSyncConflict, SyncStatus } from '@/types'
import { useDocumentVisibility, useOnline } from '@vueuse/core'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, setDoc } from 'firebase/firestore'
import { defineStore, storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { configureFirebaseAuth, createGoogleProvider, getFirebaseAuth, getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase'
import { estimateJsonBytes, stableHash } from '@/lib/hash'
import { useLearningStore } from './learning'
import { useSetsStore } from './sets'

const SCHEMA_VERSION = 1
const MAX_SET_BYTES = 700 * 1024

export const useCloudSyncStore = defineStore('cloudSync', () => {
  const configured = ref(isFirebaseConfigured())
  const authReady = ref(false)
  const user = ref<User | null>(null)
  const status = ref<SyncStatus>(configured.value ? 'signed-out' : 'disabled')
  const error = ref('')
  const lastSyncedAt = ref('')
  const pendingWrites = ref(0)
  const conflicts = ref<SetSyncConflict[]>([])

  let setsUnsubscribe: Unsubscribe | null = null
  let progressUnsubscribe: Unsubscribe | null = null
  let statsUnsubscribe: Unsubscribe | null = null
  let setSyncTimer: ReturnType<typeof setTimeout> | null = null
  let learningSyncTimer: ReturnType<typeof setTimeout> | null = null
  let started = false
  let activeUid = ''
  let applyingRemote = false
  let previousSetIds = new Set<string>()
  const knownSetHashes = new Map<string, string>()
  const knownProgressHashes = new Map<string, string>()
  let knownStatsHash = ''
  let knownDailyHash = ''
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
    progressUnsubscribe?.()
    statsUnsubscribe?.()
    setsUnsubscribe = null
    progressUnsubscribe = null
    statsUnsubscribe = null
  }

  function setStatus(next: SyncStatus) {
    status.value = next
  }

  function setError(message: string) {
    error.value = message
    status.value = 'error'
  }

  function addConflict(local: FirestoreSetDoc, remote: FirestoreSetDoc) {
    if (conflicts.value.some(conflict => conflict.setId === local.id))
      return
    conflicts.value.push({ setId: local.id, setName: local.setName, local, remote })
  }

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

  async function writeSet(uid: string, set: FirestoreSetDoc) {
    const payload = toSetDoc(uid, set)
    if (estimateJsonBytes(payload) > MAX_SET_BYTES)
      throw new Error(`「${payload.setName}」資料過大，請拆成較小的單字集。`)
    await setDoc(userDocument(uid, 'sets', payload.id), payload)
    knownSetHashes.set(payload.id, payload.checksum)
  }

  async function syncLocalSets(uid: string) {
    const setsStore = useSetsStore()
    const remoteSnapshot = await getDocs(userCollection(uid, 'sets'))
    const remoteSets = remoteSnapshot.docs.map(snapshot => snapshot.data() as FirestoreSetDoc)
    const remoteById = new Map(remoteSets.map(set => [set.id, set]))
    const localSets = setsStore.sets
    const merged = [...localSets]
    const writes: Promise<void>[] = []

    for (const remote of remoteSets) {
      const local = localSets.find(set => set.id === remote.id)
      if (!local) {
        merged.push(remote)
        knownSetHashes.set(remote.id, remote.checksum)
        continue
      }
      const localHash = stableHash({ id: local.id, setName: local.setName, difficulty: local.difficulty, items: local.items })
      if (localHash !== remote.checksum) {
        addConflict(local as FirestoreSetDoc, remote)
        continue
      }
      knownSetHashes.set(remote.id, remote.checksum)
    }

    for (const local of localSets) {
      if (!remoteById.has(local.id))
        writes.push(writeSet(uid, local as FirestoreSetDoc))
    }

    applyingRemote = true
    try {
      if (merged.length !== localSets.length || merged.some((set, index) => set.id !== localSets[index]?.id))
        setsStore.applyRemoteSets(merged)
    }
    finally {
      applyingRemote = false
    }
    await Promise.all(writes)
    previousSetIds = new Set(setsStore.sets.map(set => set.id))
  }

  async function syncLocalLearning(uid: string) {
    const learningStore = useLearningStore()
    const progressSnapshot = await getDocs(userCollection(uid, 'progress'))
    const remoteProgress = progressSnapshot.docs.map(snapshot => snapshot.data() as FirestoreProgressDoc)
    const remoteProgressBySet = new Map(remoteProgress.map(progress => [progress.setId, progress]))
    const localProgress = learningStore.progressBySet
    for (const remote of remoteProgress) {
      const local = localProgress[remote.setId]
      if (!local || new Date(remote.updatedAt).getTime() > new Date(local.updatedAt).getTime()) {
        localProgress[remote.setId] = remote
        knownProgressHashes.set(remote.setId, stableHash(remote))
      }
      else {
        knownProgressHashes.set(remote.setId, stableHash(local))
      }
    }
    const statsSnapshot = await getDocs(userCollection(uid, 'stats'))
    const summary = statsSnapshot.docs.find(snapshot => snapshot.id === 'summary')
    if (summary) {
      const remoteStats = summary.data() as FirestoreStatsDoc
      if (new Date(remoteStats.updatedAt).getTime() > new Date(learningStore.stats.updatedAt).getTime())
        learningStore.stats = remoteStats
      knownStatsHash = stableHash(learningStore.stats)
    }
    learningStore.saveState()

    const writes = Object.values(localProgress)
      .filter((progress) => {
        const remote = remoteProgressBySet.get(progress.setId)
        return !remote || new Date(progress.updatedAt).getTime() >= new Date(remote.updatedAt).getTime()
      })
      .filter(progress => knownProgressHashes.get(progress.setId) !== stableHash(progress))
      .map((progress) => {
        const hash = stableHash(progress)
        knownProgressHashes.set(progress.setId, hash)
        return setDoc(
          userDocument(uid, 'progress', progress.setId),
          { ...progress, ownerId: uid, schemaVersion: SCHEMA_VERSION },
        )
      })
    const statsHash = stableHash(learningStore.stats)
    if (knownStatsHash !== statsHash) {
      knownStatsHash = statsHash
      writes.push(setDoc(userDocument(uid, 'stats', 'summary'), {
        ...learningStore.stats,
        ownerId: uid,
        schemaVersion: SCHEMA_VERSION,
      }))
    }
    if (learningStore.stats.todayReviews > 0) {
      const daily: FirestoreDailyStatsDoc = {
        date: learningStore.stats.lastStudyDate,
        reviews: learningStore.stats.todayReviews,
        correctReviews: learningStore.stats.todayCorrectReviews,
        xpEarned: learningStore.stats.xp,
        updatedAt: learningStore.stats.updatedAt,
        ownerId: uid,
        schemaVersion: SCHEMA_VERSION,
      }
      const remoteDaily = await getDoc(dailyStatsDocument(uid, daily.date))
      const remoteDailyData = remoteDaily.exists() ? remoteDaily.data() as FirestoreDailyStatsDoc : null
      knownDailyHash = remoteDailyData ? stableHash(remoteDailyData) : ''
      if (knownDailyHash !== stableHash(daily)) {
        knownDailyHash = stableHash(daily)
        writes.push(setDoc(dailyStatsDocument(uid, daily.date), daily))
      }
    }
    await Promise.all(writes)
  }

  function applyRemoteSetChanges(uid: string) {
    setsUnsubscribe = onSnapshot(userCollection(uid, 'sets'), (snapshot) => {
      const setsStore = useSetsStore()
      const remoteSets = snapshot.docs.map(item => item.data() as FirestoreSetDoc)
      const remoteMap = new Map(remoteSets.map(set => [set.id, set]))
      const nextSets = setsStore.sets.filter(set => remoteMap.has(set.id) || !knownSetHashes.has(set.id))
      for (const remote of remoteSets) {
        const local = setsStore.sets.find(set => set.id === remote.id)
        if (!local) {
          nextSets.push(remote)
          knownSetHashes.set(remote.id, remote.checksum)
          continue
        }
        const localHash = stableHash({ id: local.id, setName: local.setName, difficulty: local.difficulty, items: local.items })
        if (localHash === remote.checksum || knownSetHashes.get(remote.id) === remote.checksum)
          knownSetHashes.set(remote.id, remote.checksum)
        else if (!applyingRemote)
          addConflict(local as FirestoreSetDoc, remote)
      }
      if (!applyingRemote && nextSets.length !== setsStore.sets.length)
        setsStore.applyRemoteSets(nextSets)
      markSynced()
    }, snapshotError => setError(snapshotError.message))
  }

  function applyRemoteLearningChanges(uid: string) {
    progressUnsubscribe = onSnapshot(userCollection(uid, 'progress'), (snapshot) => {
      const learningStore = useLearningStore()
      for (const item of snapshot.docs) {
        const remote = item.data() as FirestoreProgressDoc
        const local = learningStore.progressBySet[remote.setId]
        if (!local || new Date(remote.updatedAt).getTime() > new Date(local.updatedAt).getTime()) {
          learningStore.progressBySet[remote.setId] = remote
          knownProgressHashes.set(remote.setId, stableHash(remote))
        }
      }
      learningStore.saveState()
      markSynced()
    }, snapshotError => setError(snapshotError.message))
    statsUnsubscribe = onSnapshot(userDocument(uid, 'stats', 'summary'), (snapshot) => {
      if (!snapshot.exists())
        return
      const learningStore = useLearningStore()
      const remote = snapshot.data() as FirestoreStatsDoc
      if (new Date(remote.updatedAt).getTime() > new Date(learningStore.stats.updatedAt).getTime()) {
        learningStore.stats = remote
        knownStatsHash = stableHash(remote)
        learningStore.saveState()
      }
    }, () => {
      // A missing stats document is normal for a new account.
    })
  }

  async function flushLearning() {
    if (!user.value)
      return
    const learningStore = useLearningStore()
    pendingWrites.value += 1
    setStatus('syncing')
    try {
      const writes = Object.values(learningStore.progressBySet)
        .filter(progress => knownProgressHashes.get(progress.setId) !== stableHash(progress))
        .map((progress) => {
          knownProgressHashes.set(progress.setId, stableHash(progress))
          return setDoc(
            userDocument(user.value!.uid, 'progress', progress.setId),
            { ...progress, ownerId: user.value!.uid, schemaVersion: SCHEMA_VERSION },
          )
        })
      const statsHash = stableHash(learningStore.stats)
      if (knownStatsHash !== statsHash) {
        knownStatsHash = statsHash
        writes.push(setDoc(userDocument(user.value.uid, 'stats', 'summary'), {
          ...learningStore.stats,
          ownerId: user.value.uid,
          schemaVersion: SCHEMA_VERSION,
        }))
      }
      if (learningStore.stats.todayReviews > 0) {
        const daily: FirestoreDailyStatsDoc = {
          date: learningStore.stats.lastStudyDate,
          reviews: learningStore.stats.todayReviews,
          correctReviews: learningStore.stats.todayCorrectReviews,
          xpEarned: learningStore.stats.xp,
          updatedAt: learningStore.stats.updatedAt,
          ownerId: user.value.uid,
          schemaVersion: SCHEMA_VERSION,
        }
        const dailyHash = stableHash(daily)
        if (dailyHash !== knownDailyHash) {
          knownDailyHash = dailyHash
          writes.push(setDoc(dailyStatsDocument(user.value.uid, daily.date), daily))
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
      setError((syncError as Error).message)
    }
  }

  function scheduleLearningSync() {
    if (!user.value)
      return
    if (learningSyncTimer)
      clearTimeout(learningSyncTimer)
    learningSyncTimer = setTimeout(() => void flushLearning(), 1200)
  }

  function scheduleSetSync(nextSets: FirestoreSetDoc[]) {
    if (!user.value || applyingRemote)
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
        setError((syncError as Error).message)
      }
    }, 900)
  }

  async function startRealtime(uid: string) {
    clearListeners()
    setStatus('connecting')
    try {
      await syncLocalSets(uid)
      await syncLocalLearning(uid)
      applyRemoteSetChanges(uid)
      applyRemoteLearningChanges(uid)
      markSynced()
    }
    catch (syncError) {
      setError((syncError as Error).message)
    }
  }

  function stopRealtime() {
    clearListeners()
    if (user.value)
      setStatus(navigator.onLine ? 'offline' : 'offline')
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
        previousSetIds = new Set()
      }
      activeUid = nextUser?.uid || ''
      user.value = nextUser
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
      if (!online || pageVisibility === 'hidden') {
        stopRealtime()
        return
      }
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
      await signInWithPopup(auth, createGoogleProvider())
    }
    catch (authError) {
      setError((authError as Error).message)
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
      setError((syncError as Error).message)
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
    resolveConflict,
  }
})

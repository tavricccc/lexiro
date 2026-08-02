import type { DocumentData, Firestore, QuerySnapshot } from 'firebase/firestore'
import type { ConditionalWriteResult } from './firestore-cas'
import type { AiSettings, DashboardStats, FirestoreAiSettingsDoc, FirestoreProgressDoc, FirestoreStatsDoc, LearningProgress, LibraryState } from '@/types'
import { collection, doc, getDocs } from 'firebase/firestore'
import { CLOUD_SCHEMA_VERSION } from '@/constants'
import { getShareableAiSettings } from './ai-provider'
import { CloudSyncError } from './cloud-sync-errors'
import { buildLibraryChunks, cloudChunkHash, combineLibraryChunks, normalizeCloudAiSettings, normalizeCloudProgress, normalizeCloudStats, validateLibraryChunk } from './cloud-sync-schema'
import { getFirebaseFirestore } from './firebase'
import { deleteDocIfUnchanged, setDocIfUnchanged } from './firestore-cas'
import { createUncategorizedFolder } from './folders'
import { stableHash } from './hash'
import { createDefaultStats } from './learning-defaults'

export function requireCloudFirestore(): Firestore {
  const db = getFirebaseFirestore()
  if (!db)
    throw new CloudSyncError('cloud/not-configured', 'Firebase 尚未設定')
  return db
}

export function cloudCollection(db: Firestore, uid: string, name: string) {
  return collection(db, 'users', uid, name)
}

export function cloudDocument(db: Firestore, uid: string, collectionName: string, id: string) {
  return doc(db, 'users', uid, collectionName, id)
}

export function emptyCloudLibrary(now = new Date().toISOString()): LibraryState {
  return { version: 1, words: {}, sets: [], memberships: {}, folders: [createUncategorizedFolder()], questions: [], updatedAt: now }
}

export function emptyCloudProgress(now = new Date().toISOString()): LearningProgress {
  return { cards: {}, updatedAt: now }
}

export function emptyCloudStats(): DashboardStats {
  return createDefaultStats()
}

export function parseCloudLibrarySnapshot(snapshot: QuerySnapshot<DocumentData>, uid: string): { library: LibraryState, hashes: Map<string, string> } {
  if (!snapshot.docs.length)
    return { library: emptyCloudLibrary(), hashes: new Map() }
  const chunks = snapshot.docs.map(item => validateLibraryChunk(item.data(), uid, item.id))
  const hashes = new Map(chunks.map(chunk => [chunk.chunkId, chunk.checksum]))
  return { library: combineLibraryChunks(chunks), hashes }
}

export async function readCloudLibrary(db: Firestore, uid: string): Promise<{ library: LibraryState, hashes: Map<string, string> }> {
  return parseCloudLibrarySnapshot(await getDocs(cloudCollection(db, uid, 'library')), uid)
}

export async function writeCloudLibraryChunks(db: Firestore, uid: string, library: LibraryState, knownHashes: ReadonlyMap<string, string>): Promise<{ conflicted: boolean, hashes: Map<string, string> }> {
  const chunks = buildLibraryChunks(uid, library)
  const nextHashes = new Map(knownHashes)
  const liveIds = new Set(chunks.map(chunk => chunk.chunkId))
  const writes: Promise<ConditionalWriteResult>[] = chunks
    .filter(chunk => knownHashes.get(chunk.chunkId) !== chunk.checksum)
    .map(async (chunk) => {
      const result = await setDocIfUnchanged(db, cloudDocument(db, uid, 'library', chunk.chunkId), knownHashes.get(chunk.chunkId) ?? '', chunk, cloudChunkHash)
      if (result.written)
        nextHashes.set(chunk.chunkId, chunk.checksum)
      return result
    })
  for (const staleId of Array.from(knownHashes.keys())) {
    if (!liveIds.has(staleId)) {
      writes.push(deleteDocIfUnchanged(db, cloudDocument(db, uid, 'library', staleId), knownHashes.get(staleId) ?? '', cloudChunkHash).then((result) => {
        if (result.written)
          nextHashes.delete(staleId)
        return result
      }))
    }
  }
  if (!writes.length)
    return { conflicted: false, hashes: nextHashes }
  const results = await Promise.all(writes)
  return { conflicted: results.some(result => !result.written), hashes: nextHashes }
}

export interface CloudLearningWriteResult {
  progress: ConditionalWriteResult
  stats: ConditionalWriteResult
  progressHash: string
  statsHash: string
  progressChanged: boolean
  statsChanged: boolean
}

export async function writeCloudLearningState(
  db: Firestore,
  uid: string,
  progress: LearningProgress,
  stats: DashboardStats,
  knownHashes: { progress: string, stats: string },
): Promise<CloudLearningWriteResult> {
  const progressHash = stableHash(progress)
  const statsHash = stableHash(stats)
  const progressChanged = knownHashes.progress !== progressHash
  const statsChanged = knownHashes.stats !== statsHash
  const progressWrite = progressChanged
    ? setDocIfUnchanged(
        db,
        cloudDocument(db, uid, 'progress', 'global'),
        knownHashes.progress,
        { ...progress, ownerId: uid, schemaVersion: CLOUD_SCHEMA_VERSION } satisfies FirestoreProgressDoc,
        value => value === null ? '' : stableHash(normalizeCloudProgress(value, uid)),
      )
    : Promise.resolve<ConditionalWriteResult>({ written: true })
  const statsWrite = statsChanged
    ? setDocIfUnchanged(
        db,
        cloudDocument(db, uid, 'stats', 'summary'),
        knownHashes.stats,
        { ...stats, ownerId: uid, schemaVersion: CLOUD_SCHEMA_VERSION } satisfies FirestoreStatsDoc,
        value => value === null ? '' : stableHash(normalizeCloudStats(value, uid)),
      )
    : Promise.resolve<ConditionalWriteResult>({ written: true })
  const [progressResult, statsResult] = await Promise.all([progressWrite, statsWrite])
  return { progress: progressResult, stats: statsResult, progressHash, statsHash, progressChanged, statsChanged }
}

export interface CloudAiSettingsWriteResult {
  result: ConditionalWriteResult
  hash: string
  changed: boolean
}

export async function writeCloudAiSettings(db: Firestore, uid: string, settings: AiSettings, knownHash: string): Promise<CloudAiSettingsWriteResult> {
  const shareable = getShareableAiSettings(settings)
  const hash = stableHash(shareable)
  if (knownHash === hash)
    return { result: { written: true }, hash, changed: false }

  const payload: FirestoreAiSettingsDoc = {
    ...shareable,
    ownerId: uid,
    schemaVersion: CLOUD_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
  }
  const result = await setDocIfUnchanged(
    db,
    cloudDocument(db, uid, 'settings', 'ai'),
    knownHash,
    payload,
    value => value === null ? '' : stableHash(normalizeCloudAiSettings(value, uid)),
  )
  return { result, hash, changed: true }
}

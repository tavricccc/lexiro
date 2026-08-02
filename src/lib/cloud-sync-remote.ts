import type { DocumentData, Firestore, QuerySnapshot } from 'firebase/firestore'
import type { AtomicDocumentWrite, ConditionalWriteResult } from './firestore-cas'
import type { AiSettings, DashboardStats, FirestoreAiSettingsDoc, FirestoreProgressDoc, FirestoreStatsDoc, LearningProgress, LibraryState } from '@/types'
import { collection, doc, getDocsFromServer } from 'firebase/firestore'
import { CLOUD_SCHEMA_VERSION } from '@/constants'
import { getShareableAiSettings } from './ai-provider'
import { CloudSyncError } from './cloud-sync-errors'
import { buildLibraryChunks, buildLibraryManifest, combineLibraryChunks, normalizeCloudAiSettings, normalizeCloudProgress, normalizeCloudStats, validateLibraryChunk, validateLibraryManifest } from './cloud-sync-schema'
import { getFirebaseFirestore } from './firebase'
import { setDocIfUnchanged, writeDocumentsIfUnchanged } from './firestore-cas'
import { createUncategorizedFolder } from './folders'
import { canonicalHash } from './hash'
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

export function parseCloudLibrarySnapshot(snapshot: QuerySnapshot<DocumentData>, uid: string): { library: LibraryState, hashes: Map<string, string>, revision: string } {
  if (!snapshot.docs.length)
    return { library: emptyCloudLibrary(), hashes: new Map(), revision: '' }
  const manifestDocument = snapshot.docs.find(item => item.id === 'manifest')
  if (!manifestDocument)
    throw new CloudSyncError('cloud/data-invalid', 'Cloud library 缺少 manifest')
  const manifest = validateLibraryManifest(manifestDocument.data(), uid)
  const chunkDocuments = snapshot.docs.filter(item => item.id !== 'manifest')
  if (chunkDocuments.length !== Object.keys(manifest.chunks).length || chunkDocuments.some(item => !(item.id in manifest.chunks)))
    throw new CloudSyncError('cloud/data-invalid', 'Cloud library manifest 與 chunks 不一致')
  const chunks = chunkDocuments.map(item => validateLibraryChunk(item.data(), uid, item.id))
  if (chunks.some(chunk => manifest.chunks[chunk.chunkId] !== chunk.checksum || chunk.updatedAt !== manifest.updatedAt))
    throw new CloudSyncError('cloud/checksum-mismatch', 'Cloud library chunk 不屬於目前 manifest')
  const hashes = new Map(chunks.map(chunk => [chunk.chunkId, chunk.checksum]))
  return { library: combineLibraryChunks(chunks), hashes, revision: manifest.revision }
}

export async function readCloudLibrary(db: Firestore, uid: string): Promise<{ library: LibraryState, hashes: Map<string, string>, revision: string }> {
  return parseCloudLibrarySnapshot(await getDocsFromServer(cloudCollection(db, uid, 'library')), uid)
}

export async function writeCloudLibraryChunks(db: Firestore, uid: string, library: LibraryState, knownHashes: ReadonlyMap<string, string>, knownRevision = ''): Promise<{ conflicted: boolean, hashes: Map<string, string>, revision: string }> {
  const chunks = buildLibraryChunks(uid, library)
  const manifest = buildLibraryManifest(uid, chunks, library.updatedAt)
  const nextHashes = new Map(knownHashes)
  const liveIds = new Set(chunks.map(chunk => chunk.chunkId))
  const writes: AtomicDocumentWrite[] = chunks.map(chunk => ({
    reference: cloudDocument(db, uid, 'library', chunk.chunkId),
    payload: chunk,
  }))
  for (const staleId of Array.from(knownHashes.keys())) {
    if (!liveIds.has(staleId))
      writes.push({ reference: cloudDocument(db, uid, 'library', staleId), payload: null })
  }
  writes.push({
    reference: cloudDocument(db, uid, 'library', 'manifest'),
    expectedHash: knownRevision,
    payload: manifest,
    hash: value => value === null ? '' : validateLibraryManifest(value, uid).revision,
  })
  const written = await writeDocumentsIfUnchanged(db, writes)
  if (!written)
    return { conflicted: true, hashes: nextHashes, revision: knownRevision }
  for (const chunk of chunks)
    nextHashes.set(chunk.chunkId, chunk.checksum)
  for (const staleId of Array.from(knownHashes.keys())) {
    if (!liveIds.has(staleId))
      nextHashes.delete(staleId)
  }
  return { conflicted: false, hashes: nextHashes, revision: manifest.revision }
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
  const progressHash = canonicalHash(progress)
  const statsHash = canonicalHash(stats)
  const progressChanged = knownHashes.progress !== progressHash
  const statsChanged = knownHashes.stats !== statsHash
  const progressWrite = progressChanged
    ? setDocIfUnchanged(
        db,
        cloudDocument(db, uid, 'progress', 'global'),
        knownHashes.progress,
        { ...progress, ownerId: uid, schemaVersion: CLOUD_SCHEMA_VERSION } satisfies FirestoreProgressDoc,
        value => value === null ? '' : canonicalHash(normalizeCloudProgress(value, uid)),
      )
    : Promise.resolve<ConditionalWriteResult>({ written: true })
  const statsWrite = statsChanged
    ? setDocIfUnchanged(
        db,
        cloudDocument(db, uid, 'stats', 'summary'),
        knownHashes.stats,
        { ...stats, ownerId: uid, schemaVersion: CLOUD_SCHEMA_VERSION } satisfies FirestoreStatsDoc,
        value => value === null ? '' : canonicalHash(normalizeCloudStats(value, uid)),
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
  const hash = canonicalHash(shareable)
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
    value => value === null ? '' : canonicalHash(normalizeCloudAiSettings(value, uid)),
  )
  return { result, hash, changed: true }
}

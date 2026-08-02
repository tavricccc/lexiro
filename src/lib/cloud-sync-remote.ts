import type { DocumentData, Firestore, QueryDocumentSnapshot, QuerySnapshot } from 'firebase/firestore'
import type { AtomicDocumentWrite, ConditionalWriteResult } from './firestore-cas'
import type { AiSettings, DashboardStats, FirestoreAiSettingsDoc, FirestoreLibraryChunk, FirestoreLibraryV5Chunk, FirestoreProgressDoc, FirestoreStatsDoc, LearningProgress, LibraryState } from '@/types'
import { collection, doc, documentId, getDocFromServer, getDocsFromServer, limit, orderBy, query, runTransaction, startAfter, writeBatch } from 'firebase/firestore'
import { CLOUD_LIBRARY_BATCH_SIZE, CLOUD_SCHEMA_VERSION, LIBRARY_CLOUD_SCHEMA_VERSION } from '@/constants'
import { getShareableAiSettings } from './ai-provider'
import { CloudSyncError } from './cloud-sync-errors'
import { buildLibraryChunks, buildLibraryManifest, buildV5LibraryChunks, buildV5LibraryManifest, combineLibraryChunks, combineV5LibraryChunks, normalizeCloudAiSettings, normalizeCloudProgress, normalizeCloudStats, validateLibraryChunk, validateLibraryManifest, validateV5LibraryChunk, validateV5LibraryManifest } from './cloud-sync-schema'
import { getFirebaseFirestore } from './firebase'
import { setDocIfUnchanged, writeDocumentsIfUnchanged } from './firestore-cas'
import { prepareFirestoreData } from './firestore-data'
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
  const manifestData = manifestDocument.data()
  if (manifestData.schemaVersion === LIBRARY_CLOUD_SCHEMA_VERSION)
    return parseCloudV5Documents(snapshot.docs, uid)
  const manifest = validateLibraryManifest(manifestData, uid)
  const chunkDocuments = snapshot.docs.filter(item => item.id !== 'manifest')
  if (chunkDocuments.length !== Object.keys(manifest.chunks).length || chunkDocuments.some(item => !(item.id in manifest.chunks)))
    throw new CloudSyncError('cloud/data-invalid', 'Cloud library manifest 與 chunks 不一致')
  const chunks = chunkDocuments.map(item => validateLibraryChunk(item.data(), uid, item.id))
  if (chunks.some(chunk => manifest.chunks[chunk.chunkId] !== chunk.checksum || chunk.updatedAt !== manifest.updatedAt))
    throw new CloudSyncError('cloud/checksum-mismatch', 'Cloud library chunk 不屬於目前 manifest')
  const hashes = new Map(chunks.map(chunk => [chunk.chunkId, chunk.checksum]))
  return { library: combineLibraryChunks(chunks), hashes, revision: manifest.revision }
}

function parseCloudV5Documents(documents: Array<{ id: string, data: () => DocumentData }>, uid: string): { library: LibraryState, hashes: Map<string, string>, revision: string } {
  const manifestDocument = documents.find(item => item.id === 'manifest')
  if (!manifestDocument)
    throw new CloudSyncError('cloud/data-invalid', 'Cloud library 缺少 manifest')
  const manifest = validateV5LibraryManifest(manifestDocument.data(), uid)
  // Old generations may still be present while post-publication cleanup is
  // running. Only manifest-referenced v5 chunks belong to this read.
  const chunkDocuments = documents.filter(item => item.id !== 'manifest' && item.id in manifest.chunks)
  if (chunkDocuments.length !== Object.keys(manifest.chunks).length || chunkDocuments.some(item => !(item.id in manifest.chunks)))
    throw new CloudSyncError('cloud/data-invalid', 'Cloud library manifest 與 chunks 不一致')
  const chunks = chunkDocuments.map(item => validateV5LibraryChunk(item.data(), uid, item.id))
  if (chunks.some(chunk => manifest.chunks[chunk.chunkId] !== chunk.checksum || chunk.updatedAt !== manifest.updatedAt))
    throw new CloudSyncError('cloud/checksum-mismatch', 'Cloud library v5 chunk 不屬於目前 manifest')
  return { library: combineV5LibraryChunks(chunks), hashes: new Map(chunks.map(chunk => [chunk.chunkId, chunk.checksum])), revision: manifest.revision }
}

export async function readCloudLibrary(db: Firestore, uid: string): Promise<{ library: LibraryState, hashes: Map<string, string>, revision: string }> {
  const result = await readCloudLibraryV5(db, uid)
  return { library: result.library, hashes: result.hashes, revision: result.revision }
}

export interface CloudLibraryBatchProgress {
  currentBatch: number
  totalBatches: number
  completed: number
  total: number
}

export interface CloudLibraryReadResult {
  library: LibraryState
  hashes: Map<string, string>
  revision: string
  legacy: boolean
}

export interface CloudLibraryBatch {
  chunks: Array<FirestoreLibraryChunk | FirestoreLibraryV5Chunk>
  /** Chunks fetched from Firestore in this batch; reused chunks are omitted. */
  newChunks: Array<FirestoreLibraryChunk | FirestoreLibraryV5Chunk>
  revision: string
  progress: CloudLibraryBatchProgress
}

export interface CloudLibraryReadOptions {
  existingChunks?: ReadonlyMap<string, FirestoreLibraryChunk | FirestoreLibraryV5Chunk>
}

const LIBRARY_WRITE_LOCK_ID = 'v5-write'
const LIBRARY_WRITE_LOCK_TTL_MS = 5 * 60 * 1000

interface LibraryWriteLease {
  refresh: () => Promise<void>
  release: () => Promise<void>
}

async function acquireLibraryWriteLease(db: Firestore, uid: string): Promise<LibraryWriteLease> {
  const token = crypto.randomUUID()
  const reference = cloudDocument(db, uid, 'libraryLocks', LIBRARY_WRITE_LOCK_ID)

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference)
    const current = snapshot.exists() ? snapshot.data() : null
    const expiresAt = current && typeof current.expiresAt === 'number' ? current.expiresAt : 0
    if (expiresAt > Date.now())
      throw new Error('Cloud Library is being published by another device')
    transaction.set(reference, prepareFirestoreData({
      ownerId: uid,
      schemaVersion: LIBRARY_CLOUD_SCHEMA_VERSION,
      token,
      expiresAt: Date.now() + LIBRARY_WRITE_LOCK_TTL_MS,
    }))
  })

  async function refresh() {
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(reference)
      const current = snapshot.exists() ? snapshot.data() : null
      if (!current || current.ownerId !== uid || current.token !== token || typeof current.expiresAt !== 'number' || current.expiresAt <= Date.now())
        throw new Error('Cloud Library publish lease expired')
      transaction.set(reference, prepareFirestoreData({
        ownerId: uid,
        schemaVersion: LIBRARY_CLOUD_SCHEMA_VERSION,
        token,
        expiresAt: Date.now() + LIBRARY_WRITE_LOCK_TTL_MS,
      }))
    })
  }

  async function release() {
    try {
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(reference)
        const current = snapshot.exists() ? snapshot.data() : null
        if (current?.ownerId === uid && current.token === token)
          transaction.delete(reference)
      })
    }
    catch {
      // The lease will expire. Release must never turn a successfully published
      // manifest into a failed sync result.
    }
  }

  return { refresh, release }
}

/** Reads v5 by manifest first and fetches no more than eight chunks per step. */
export async function readCloudLibraryV5(
  db: Firestore,
  uid: string,
  onProgress?: (progress: CloudLibraryBatchProgress) => void,
  onBatch?: (batch: CloudLibraryBatch) => void | Promise<void>,
  options: CloudLibraryReadOptions = {},
): Promise<CloudLibraryReadResult> {
  const manifestSnapshot = await getDocFromServer(cloudDocument(db, uid, 'library', 'manifest'))
  if (!manifestSnapshot.exists())
    return { library: emptyCloudLibrary(), hashes: new Map(), revision: '', legacy: false }
  const data = manifestSnapshot.data()
  if (data.schemaVersion !== LIBRARY_CLOUD_SCHEMA_VERSION) {
    const manifest = validateLibraryManifest(data, uid)
    return readLegacyCloudLibraryInBatches(db, uid, manifest, onProgress, onBatch, options)
  }
  const manifest = validateV5LibraryManifest(data, uid)
  const ids = Object.keys(manifest.chunks)
  const totalBatches = Math.max(1, Math.ceil(ids.length / CLOUD_LIBRARY_BATCH_SIZE))
  const chunks: FirestoreLibraryV5Chunk[] = []
  for (let offset = 0; offset < ids.length; offset += CLOUD_LIBRARY_BATCH_SIZE) {
    const currentBatch = Math.floor(offset / CLOUD_LIBRARY_BATCH_SIZE) + 1
    const batchIds = ids.slice(offset, offset + CLOUD_LIBRARY_BATCH_SIZE)
    const batchChunks: FirestoreLibraryV5Chunk[] = []
    const newChunks: FirestoreLibraryV5Chunk[] = []
    for (const id of batchIds) {
      const existing = options.existingChunks?.get(id)
      let chunk: FirestoreLibraryV5Chunk
      if (existing) {
        try {
          const cached = validateV5LibraryChunk(existing, uid, id)
          if (manifest.chunks[id] !== cached.checksum || cached.updatedAt !== manifest.updatedAt)
            throw new Error('staged chunk belongs to another manifest')
          chunk = cached
        }
        catch {
          chunk = await readV5Chunk(db, uid, id)
          newChunks.push(chunk)
        }
      }
      else {
        chunk = await readV5Chunk(db, uid, id)
        newChunks.push(chunk)
      }
      if (manifest.chunks[id] !== chunk.checksum || chunk.updatedAt !== manifest.updatedAt)
        throw new CloudSyncError('cloud/checksum-mismatch', 'Cloud library v5 chunk 不屬於目前 manifest')
      batchChunks.push(chunk)
      chunks.push(chunk)
    }
    const progress = { currentBatch, totalBatches, completed: Math.min(offset + batchIds.length, ids.length), total: ids.length }
    // A caller may persist this verified batch before the next network read.
    // This keeps a failed download resumable without ever changing the active
    // generation.
    await onBatch?.({ chunks: batchChunks, newChunks, revision: manifest.revision, progress })
    onProgress?.(progress)
  }
  return { library: combineV5LibraryChunks(chunks), hashes: new Map(chunks.map(chunk => [chunk.chunkId, chunk.checksum])), revision: manifest.revision, legacy: false }
}

async function readLegacyCloudLibraryInBatches(
  db: Firestore,
  uid: string,
  manifest: ReturnType<typeof validateLibraryManifest>,
  onProgress?: (progress: CloudLibraryBatchProgress) => void,
  onBatch?: (batch: CloudLibraryBatch) => void | Promise<void>,
  options: CloudLibraryReadOptions = {},
): Promise<CloudLibraryReadResult> {
  const ids = Object.keys(manifest.chunks)
  if (!ids.length)
    throw new CloudSyncError('cloud/data-invalid', 'Cloud library manifest 缺少 chunks')
  const totalBatches = Math.ceil(ids.length / CLOUD_LIBRARY_BATCH_SIZE)
  const chunks: FirestoreLibraryChunk[] = []
  for (let offset = 0; offset < ids.length; offset += CLOUD_LIBRARY_BATCH_SIZE) {
    const currentBatch = Math.floor(offset / CLOUD_LIBRARY_BATCH_SIZE) + 1
    const batchIds = ids.slice(offset, offset + CLOUD_LIBRARY_BATCH_SIZE)
    const batchChunks: FirestoreLibraryChunk[] = []
    const newChunks: FirestoreLibraryChunk[] = []
    for (const id of batchIds) {
      const existing = options.existingChunks?.get(id)
      let chunk: FirestoreLibraryChunk
      if (existing) {
        try {
          chunk = validateLibraryChunk(existing, uid, id)
          if (manifest.chunks[id] !== chunk.checksum || chunk.updatedAt !== manifest.updatedAt)
            throw new Error('staged chunk belongs to another manifest')
        }
        catch {
          const snapshot = await getDocFromServer(cloudDocument(db, uid, 'library', id))
          if (!snapshot.exists())
            throw new CloudSyncError('cloud/data-invalid', 'Cloud library manifest 與 chunks 不一致')
          chunk = validateLibraryChunk(snapshot.data(), uid, id)
          newChunks.push(chunk)
        }
      }
      else {
        const snapshot = await getDocFromServer(cloudDocument(db, uid, 'library', id))
        if (!snapshot.exists())
          throw new CloudSyncError('cloud/data-invalid', 'Cloud library manifest 與 chunks 不一致')
        chunk = validateLibraryChunk(snapshot.data(), uid, id)
        newChunks.push(chunk)
      }
      if (manifest.chunks[id] !== chunk.checksum || chunk.updatedAt !== manifest.updatedAt)
        throw new CloudSyncError('cloud/checksum-mismatch', 'Cloud library chunk 不屬於目前 manifest')
      batchChunks.push(chunk)
      chunks.push(chunk)
    }
    const progress = { currentBatch, totalBatches, completed: Math.min(offset + batchIds.length, ids.length), total: ids.length }
    await onBatch?.({ chunks: batchChunks, newChunks, revision: manifest.revision, progress })
    onProgress?.(progress)
  }
  return { library: combineLibraryChunks(chunks), hashes: new Map(chunks.map(chunk => [chunk.chunkId, chunk.checksum])), revision: manifest.revision, legacy: true }
}

async function readV5Chunk(db: Firestore, uid: string, id: string): Promise<FirestoreLibraryV5Chunk> {
  const snapshot = await getDocFromServer(cloudDocument(db, uid, 'library', id))
  if (!snapshot.exists())
    throw new CloudSyncError('cloud/data-invalid', 'Cloud library manifest 與 chunks 不一致')
  return validateV5LibraryChunk(snapshot.data(), uid, id)
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

/**
 * v5 writer: immutable chunks are written in strict groups of eight and the
 * manifest is published only after every chunk has been accepted.
 */
export async function writeCloudLibraryChunksV5(
  db: Firestore,
  uid: string,
  library: LibraryState,
  knownHashes: ReadonlyMap<string, string>,
  knownRevision = '',
  onProgress?: (progress: CloudLibraryBatchProgress) => void,
): Promise<{ conflicted: boolean, hashes: Map<string, string>, revision: string }> {
  const chunks = buildV5LibraryChunks(uid, library)
  const manifest = buildV5LibraryManifest(uid, chunks, library.updatedAt)
  const totalBatches = Math.max(1, Math.ceil(chunks.length / CLOUD_LIBRARY_BATCH_SIZE))
  const lease = await acquireLibraryWriteLease(db, uid)
  try {
    for (let offset = 0; offset < chunks.length; offset += CLOUD_LIBRARY_BATCH_SIZE) {
      await lease.refresh()
      const currentBatch = Math.floor(offset / CLOUD_LIBRARY_BATCH_SIZE) + 1
      const batch = chunks.slice(offset, offset + CLOUD_LIBRARY_BATCH_SIZE)
      const writeBatchOperation = writeBatch(db)
      for (const chunk of batch)
        writeBatchOperation.set(cloudDocument(db, uid, 'library', chunk.chunkId), prepareFirestoreData(chunk))
      await writeBatchOperation.commit()
      onProgress?.({ currentBatch, totalBatches, completed: Math.min(offset + batch.length, chunks.length), total: chunks.length })
    }
    await lease.refresh()
    const result = await setDocIfUnchanged(
      db,
      cloudDocument(db, uid, 'library', 'manifest'),
      knownRevision,
      prepareFirestoreData(manifest),
      (value) => {
        if (value === null)
          return ''
        if (!value || typeof value !== 'object')
          return '#invalid'
        const source = value as Record<string, unknown>
        if (source.schemaVersion === LIBRARY_CLOUD_SCHEMA_VERSION)
          return validateV5LibraryManifest(value, uid).revision
        return typeof source.revision === 'string' ? source.revision : '#invalid'
      },
    )
    if (!result.written)
      return { conflicted: true, hashes: new Map(knownHashes), revision: knownRevision }
    const liveIds = new Set(chunks.map(chunk => chunk.chunkId))
    await cleanupUnreferencedV5Chunks(db, uid, liveIds, knownHashes, lease.refresh)
    onProgress?.({ currentBatch: totalBatches, totalBatches, completed: chunks.length, total: chunks.length })
    return { conflicted: false, hashes: new Map(chunks.map(chunk => [chunk.chunkId, chunk.checksum])), revision: manifest.revision }
  }
  finally {
    await lease.release()
  }
}

async function cleanupUnreferencedV5Chunks(
  db: Firestore,
  uid: string,
  liveIds: ReadonlySet<string>,
  knownHashes: ReadonlyMap<string, string>,
  refreshLease: () => Promise<void>,
): Promise<void> {
  try {
    const knownStaleIds = Array.from(knownHashes.keys()).filter(id => !liveIds.has(id))
    const scannedStaleIds: string[] = []
    const libraryReference = cloudCollection(db, uid, 'library')
    let cursor: QueryDocumentSnapshot<DocumentData> | null = null
    do {
      const pageQuery = cursor
        ? query(libraryReference, orderBy(documentId()), startAfter(cursor), limit(CLOUD_LIBRARY_BATCH_SIZE))
        : query(libraryReference, orderBy(documentId()), limit(CLOUD_LIBRARY_BATCH_SIZE))
      const snapshot: QuerySnapshot<DocumentData> = await getDocsFromServer(pageQuery)
      for (const document of snapshot.docs) {
        if (document.id !== 'manifest' && !liveIds.has(document.id))
          scannedStaleIds.push(document.id)
      }
      cursor = snapshot.docs.length === CLOUD_LIBRARY_BATCH_SIZE
        ? snapshot.docs.at(-1) ?? null
        : null
    } while (cursor)
    const staleIds = Array.from(new Set([...knownStaleIds, ...scannedStaleIds]))
    for (let offset = 0; offset < staleIds.length; offset += CLOUD_LIBRARY_BATCH_SIZE) {
      await refreshLease()
      const batch = writeBatch(db)
      for (const staleId of staleIds.slice(offset, offset + CLOUD_LIBRARY_BATCH_SIZE))
        batch.delete(cloudDocument(db, uid, 'library', staleId))
      await batch.commit()
    }
  }
  catch {
    // Cleanup is intentionally best effort. The manifest is already live and
    // a later successful publication can retry removing orphaned chunks.
  }
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
  const progressResult = progressChanged
    ? await setDocIfUnchanged(
        db,
        cloudDocument(db, uid, 'progress', 'global'),
        knownHashes.progress,
        { ...progress, ownerId: uid, schemaVersion: CLOUD_SCHEMA_VERSION } satisfies FirestoreProgressDoc,
        value => value === null ? '' : canonicalHash(normalizeCloudProgress(value, uid)),
      )
    : { written: true } satisfies ConditionalWriteResult
  const statsResult = statsChanged
    ? await setDocIfUnchanged(
        db,
        cloudDocument(db, uid, 'stats', 'summary'),
        knownHashes.stats,
        { ...stats, ownerId: uid, schemaVersion: CLOUD_SCHEMA_VERSION } satisfies FirestoreStatsDoc,
        value => value === null ? '' : canonicalHash(normalizeCloudStats(value, uid)),
      )
    : { written: true } satisfies ConditionalWriteResult
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

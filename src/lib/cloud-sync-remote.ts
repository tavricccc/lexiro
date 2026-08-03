import type { DocumentData, Firestore, QueryDocumentSnapshot, QuerySnapshot } from 'firebase/firestore'
import type { ConditionalWriteResult } from './firestore-cas'
import type { AiSettings, DashboardStats, FirestoreAiSettingsDoc, FirestoreLibraryManifestPart, FirestoreLibraryV5Chunk, FirestoreLibraryV5Manifest, FirestoreProgressDoc, FirestoreStatsDoc, FirestoreSyncHeadDoc, LearningProgress, LibraryState } from '@/types'
import { collection, doc, documentId, getDocFromServer, getDocsFromServer, limit, orderBy, query, runTransaction, startAfter, writeBatch } from 'firebase/firestore'
import { CLOUD_LIBRARY_BATCH_SIZE, CLOUD_LIBRARY_DOWNLOAD_CONCURRENCY, CLOUD_LIBRARY_UPLOAD_CONCURRENCY, CLOUD_SCHEMA_VERSION } from '@/constants'
import { getShareableAiSettings } from './ai-provider'
import { mapWithConcurrency } from './async-pool'
import { CloudSyncError } from './cloud-sync-errors'
import { buildV5LibraryChunks, buildV5LibraryManifestDocuments, combineV5LibraryChunks, normalizeCloudAiSettings, normalizeCloudProgress, normalizeCloudStats, validateCloudSyncHead, validateV5LibraryChunk, validateV5LibraryManifest, validateV5LibraryManifestPart } from './cloud-sync-schema'
import { getFirebaseFirestore } from './firebase'
import { setDocIfUnchanged } from './firestore-cas'
import { prepareFirestoreData } from './firestore-data'
import { createUncategorizedFolder } from './folders'
import { canonicalHash } from './hash'
import { createDefaultStats } from './learning-defaults'
import { withSyncTimeout } from './sync-timeout'

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

export function emptyCloudSyncHead(now = new Date().toISOString()): FirestoreSyncHeadDoc {
  return {
    ownerId: '',
    schemaVersion: CLOUD_SCHEMA_VERSION,
    updatedAt: now,
    libraryRevision: '',
    progressHash: '',
    statsHash: '',
    settingsHash: '',
  }
}

export async function readCloudSyncHead(db: Firestore, uid: string): Promise<FirestoreSyncHeadDoc | null> {
  const snapshot = await withSyncTimeout(
    getDocFromServer(cloudDocument(db, uid, 'sync', 'head')),
    'Sync head download',
  )
  if (!snapshot.exists())
    return null
  return validateCloudSyncHead(snapshot.data(), uid)
}

export async function updateCloudSyncHead(
  db: Firestore,
  uid: string,
  patch: Partial<Pick<FirestoreSyncHeadDoc, 'libraryRevision' | 'progressHash' | 'statsHash' | 'settingsHash'>>,
): Promise<FirestoreSyncHeadDoc> {
  const reference = cloudDocument(db, uid, 'sync', 'head')
  return withSyncTimeout(runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference)
    const current = snapshot.exists() ? validateCloudSyncHead(snapshot.data(), uid) : { ...emptyCloudSyncHead(), ownerId: uid }
    const next: FirestoreSyncHeadDoc = {
      ...current,
      ...patch,
      ownerId: uid,
      schemaVersion: CLOUD_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
    }
    transaction.set(reference, prepareFirestoreData(next))
    return next
  }), 'Sync head update')
}

export function parseCloudLibrarySnapshot(snapshot: QuerySnapshot<DocumentData>, uid: string): { library: LibraryState, hashes: Map<string, string>, revision: string } {
  if (!snapshot.docs.length)
    return { library: emptyCloudLibrary(), hashes: new Map(), revision: '' }
  const manifestDocument = snapshot.docs.find(item => item.id === 'manifest')
  if (!manifestDocument)
    throw new CloudSyncError('cloud/data-invalid', 'Cloud library 缺少 manifest')
  return parseCloudV5Documents(snapshot.docs, uid)
}

function parseCloudV5Documents(documents: Array<{ id: string, data: () => DocumentData }>, uid: string): { library: LibraryState, hashes: Map<string, string>, revision: string } {
  const manifestDocument = documents.find(item => item.id === 'manifest')
  if (!manifestDocument)
    throw new CloudSyncError('cloud/data-invalid', 'Cloud library 缺少 manifest')
  const manifest = validateV5LibraryManifest(manifestDocument.data(), uid)
  const manifestParts = new Map<string, FirestoreLibraryManifestPart>()
  for (const partId of Object.keys(manifest.manifestParts ?? {})) {
    const partDocument = documents.find(item => item.id === partId)
    if (!partDocument)
      throw new CloudSyncError('cloud/data-invalid', 'Cloud library manifest 缺少 manifest part')
    const part = validateV5LibraryManifestPart(partDocument.data(), uid, partId)
    if (manifest.manifestParts?.[partId] !== part.checksum || part.updatedAt !== manifest.updatedAt)
      throw new CloudSyncError('cloud/checksum-mismatch', 'Cloud library manifest part 不屬於目前 manifest')
    manifestParts.set(partId, part)
  }
  const resolvedChunks: Record<string, string> = {}
  for (const part of manifestParts.values()) {
    for (const [chunkId, checksum] of Object.entries(part.chunks)) {
      if (resolvedChunks[chunkId] !== undefined)
        throw new CloudSyncError('cloud/data-invalid', 'Cloud library manifest part 包含重複 chunk')
      resolvedChunks[chunkId] = checksum
    }
  }
  const chunkChecksums = Object.keys(manifest.manifestParts ?? {}).length ? resolvedChunks : manifest.chunks
  // Old generations may still be present while post-publication cleanup is
  // running. Only manifest-referenced v5 chunks belong to this read.
  const chunkDocuments = documents.filter(item => item.id !== 'manifest' && !manifestParts.has(item.id) && item.id in chunkChecksums)
  if (chunkDocuments.length !== Object.keys(chunkChecksums).length || chunkDocuments.some(item => !(item.id in chunkChecksums)))
    throw new CloudSyncError('cloud/data-invalid', 'Cloud library manifest 與 chunks 不一致')
  const chunks = chunkDocuments.map(item => validateV5LibraryChunk(item.data(), uid, item.id))
  if (chunks.some(chunk => chunkChecksums[chunk.chunkId] !== chunk.checksum))
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
  activeRequests?: number
}

export interface CloudLibraryReadResult {
  library: LibraryState
  hashes: Map<string, string>
  revision: string
}

export interface CloudLibraryBatch {
  chunks: FirestoreLibraryV5Chunk[]
  /** Chunks fetched from Firestore in this batch; reused chunks are omitted. */
  newChunks: FirestoreLibraryV5Chunk[]
  revision: string
  progress: CloudLibraryBatchProgress
}

export interface CloudLibraryReadOptions {
  existingChunks?: ReadonlyMap<string, FirestoreLibraryV5Chunk>
  loadExistingChunks?: (chunkIds: readonly string[], checksums: ReadonlyMap<string, string>) => Promise<ReadonlyMap<string, FirestoreLibraryV5Chunk>>
  cachedRevision?: string
  cachedHashes?: ReadonlyMap<string, string>
  manifestData?: unknown
}

async function resolveV5Manifest(db: Firestore, uid: string, manifest: FirestoreLibraryV5Manifest): Promise<{ manifest: FirestoreLibraryV5Manifest, checksums: Record<string, string> }> {
  if (!manifest.manifestParts || !Object.keys(manifest.manifestParts).length)
    return { manifest, checksums: manifest.chunks }
  const parts = await mapWithConcurrency(Object.keys(manifest.manifestParts), CLOUD_LIBRARY_DOWNLOAD_CONCURRENCY, async (partId) => {
    const snapshot = await withSyncTimeout(
      getDocFromServer(cloudDocument(db, uid, 'library', partId)),
      `Library manifest part ${partId} download`,
    )
    if (!snapshot.exists())
      throw new CloudSyncError('cloud/data-invalid', 'Cloud library manifest 缺少 manifest part')
    const part = validateV5LibraryManifestPart(snapshot.data(), uid, partId)
    if (manifest.manifestParts?.[partId] !== part.checksum || part.updatedAt !== manifest.updatedAt)
      throw new CloudSyncError('cloud/checksum-mismatch', 'Cloud library manifest part 不屬於目前 manifest')
    return part
  })
  const checksums: Record<string, string> = {}
  for (const part of parts) {
    for (const [chunkId, checksum] of Object.entries(part.chunks)) {
      if (checksums[chunkId] !== undefined)
        throw new CloudSyncError('cloud/data-invalid', 'Cloud library manifest part 包含重複 chunk')
      checksums[chunkId] = checksum
    }
  }
  return { manifest: { ...manifest, chunks: checksums }, checksums }
}

async function loadExistingChunksForManifest(options: CloudLibraryReadOptions, checksums: Record<string, string>): Promise<ReadonlyMap<string, FirestoreLibraryV5Chunk>> {
  const loaded = options.loadExistingChunks
    ? await options.loadExistingChunks(Object.keys(checksums), new Map(Object.entries(checksums)))
    : new Map<string, FirestoreLibraryV5Chunk>()
  return new Map([
    ...loaded.entries(),
    ...(options.existingChunks ? options.existingChunks.entries() : []),
  ])
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

  await withSyncTimeout(runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference)
    const current = snapshot.exists() ? snapshot.data() : null
    const expiresAt = current && typeof current.expiresAt === 'number' ? current.expiresAt : 0
    if (expiresAt > Date.now())
      throw new Error('Cloud Library is being published by another device')
    transaction.set(reference, prepareFirestoreData({
      ownerId: uid,
      schemaVersion: CLOUD_SCHEMA_VERSION,
      token,
      expiresAt: Date.now() + LIBRARY_WRITE_LOCK_TTL_MS,
    }))
  }), 'Library publish lease')

  async function refresh() {
    await withSyncTimeout(runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(reference)
      const current = snapshot.exists() ? snapshot.data() : null
      if (!current || current.ownerId !== uid || current.token !== token || typeof current.expiresAt !== 'number' || current.expiresAt <= Date.now())
        throw new Error('Cloud Library publish lease expired')
      transaction.set(reference, prepareFirestoreData({
        ownerId: uid,
        schemaVersion: CLOUD_SCHEMA_VERSION,
        token,
        expiresAt: Date.now() + LIBRARY_WRITE_LOCK_TTL_MS,
      }))
    }), 'Library publish lease refresh')
  }

  async function release() {
    try {
      await withSyncTimeout(runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(reference)
        const current = snapshot.exists() ? snapshot.data() : null
        if (current?.ownerId === uid && current.token === token)
          transaction.delete(reference)
      }), 'Library publish lease release')
    }
    catch {
      // The lease will expire. Release must never turn a successfully published
      // manifest into a failed sync result.
    }
  }

  return { refresh, release }
}

/** Reads v5 by manifest first and fetches immutable chunks with bounded parallelism. */
export async function readCloudLibraryV5(
  db: Firestore,
  uid: string,
  onProgress?: (progress: CloudLibraryBatchProgress) => void,
  onBatch?: (batch: CloudLibraryBatch) => void | Promise<void>,
  options: CloudLibraryReadOptions = {},
): Promise<CloudLibraryReadResult> {
  let data = options.manifestData
  if (data === undefined) {
    const manifestSnapshot = await withSyncTimeout(
      getDocFromServer(cloudDocument(db, uid, 'library', 'manifest')),
      'Library manifest download',
    )
    if (!manifestSnapshot.exists())
      return { library: emptyCloudLibrary(), hashes: new Map(), revision: '' }
    data = manifestSnapshot.data()
  }
  if (!data || typeof data !== 'object')
    throw new CloudSyncError('cloud/data-invalid', 'Cloud library manifest 格式錯誤')
  if (!('schemaVersion' in data) || data.schemaVersion !== CLOUD_SCHEMA_VERSION)
    throw new CloudSyncError('cloud/schema-unsupported', 'Cloud library 只支援 v5 schema')
  const rootManifest = validateV5LibraryManifest(data, uid)
  const cachedHashes = options.cachedRevision === rootManifest.revision && options.cachedHashes?.size
    ? Object.fromEntries(options.cachedHashes)
    : null
  const { manifest, checksums } = cachedHashes
    ? { manifest: { ...rootManifest, chunks: cachedHashes }, checksums: cachedHashes }
    : await resolveV5Manifest(db, uid, rootManifest)
  const ids = Object.keys(checksums)
  const existingChunks = await loadExistingChunksForManifest(options, checksums)
  const totalBatches = Math.max(1, Math.ceil(ids.length / CLOUD_LIBRARY_BATCH_SIZE))
  onProgress?.({ currentBatch: 0, totalBatches, completed: 0, total: ids.length, activeRequests: 0 })
  const chunks: FirestoreLibraryV5Chunk[] = []
  for (let offset = 0; offset < ids.length; offset += CLOUD_LIBRARY_BATCH_SIZE) {
    const currentBatch = Math.floor(offset / CLOUD_LIBRARY_BATCH_SIZE) + 1
    const batchIds = ids.slice(offset, offset + CLOUD_LIBRARY_BATCH_SIZE)
    const resolvedBatch = await mapWithConcurrency(batchIds, CLOUD_LIBRARY_DOWNLOAD_CONCURRENCY, async (id) => {
      const existing = existingChunks.get(id)
      let chunk: FirestoreLibraryV5Chunk
      let isNew = false
      if (existing) {
        try {
          const cached = validateV5LibraryChunk(existing, uid, id)
          if (checksums[id] !== cached.checksum)
            throw new Error('staged chunk belongs to another manifest')
          chunk = cached
        }
        catch {
          chunk = await readV5Chunk(db, uid, id)
          isNew = true
        }
      }
      else {
        chunk = await readV5Chunk(db, uid, id)
        isNew = true
      }
      if (checksums[id] !== chunk.checksum)
        throw new CloudSyncError('cloud/checksum-mismatch', 'Cloud library v5 chunk 不屬於目前 manifest')
      return { chunk, isNew }
    })
    const batchChunks = resolvedBatch.map(({ chunk }) => chunk)
    const newChunks = resolvedBatch.filter(({ isNew }) => isNew).map(({ chunk }) => chunk)
    const activeRequests = Math.min(CLOUD_LIBRARY_DOWNLOAD_CONCURRENCY, newChunks.length)
    chunks.push(...batchChunks)
    resolvedBatch.forEach((_, index) => {
      onProgress?.({ currentBatch, totalBatches, completed: offset + index + 1, total: ids.length, activeRequests })
    })
    const progress = { currentBatch, totalBatches, completed: Math.min(offset + batchIds.length, ids.length), total: ids.length, activeRequests: 0 }
    // A caller may persist this verified batch before the next network read.
    // This keeps a failed download resumable without ever changing the active
    // generation.
    await onBatch?.({ chunks: batchChunks, newChunks, revision: manifest.revision, progress })
  }
  return { library: combineV5LibraryChunks(chunks), hashes: new Map(chunks.map(chunk => [chunk.chunkId, chunk.checksum])), revision: manifest.revision }
}

async function readV5Chunk(db: Firestore, uid: string, id: string): Promise<FirestoreLibraryV5Chunk> {
  const snapshot = await withSyncTimeout(
    getDocFromServer(cloudDocument(db, uid, 'library', id)),
    `Library chunk ${id} download`,
  )
  if (!snapshot.exists())
    throw new CloudSyncError('cloud/data-invalid', 'Cloud library manifest 與 chunks 不一致')
  return validateV5LibraryChunk(snapshot.data(), uid, id)
}

/**
 * v5 writer: immutable chunks are written in parallel groups and the
 * manifest is published only after every chunk has been accepted.
 */
export async function writeCloudLibraryChunksV5(
  db: Firestore,
  uid: string,
  library: LibraryState,
  knownHashes: ReadonlyMap<string, string>,
  knownRevision = '',
  onProgress?: (progress: CloudLibraryBatchProgress) => void,
): Promise<{ conflicted: boolean, hashes: Map<string, string>, revision: string, chunks: FirestoreLibraryV5Chunk[] }> {
  const chunks = buildV5LibraryChunks(uid, library)
  const manifestDocuments = buildV5LibraryManifestDocuments(uid, chunks, library.updatedAt)
  const manifest = manifestDocuments.manifest
  const changedChunks = chunks.filter(chunk => knownHashes.get(chunk.chunkId) !== chunk.checksum)
  const totalBatches = Math.max(1, Math.ceil(chunks.length / CLOUD_LIBRARY_BATCH_SIZE))
  onProgress?.({ currentBatch: 0, totalBatches, completed: 0, total: chunks.length, activeRequests: 0 })
  const lease = await acquireLibraryWriteLease(db, uid)
  try {
    const changedBatches = Array.from({ length: Math.ceil(changedChunks.length / CLOUD_LIBRARY_BATCH_SIZE) }, (_, index) => changedChunks.slice(index * CLOUD_LIBRARY_BATCH_SIZE, (index + 1) * CLOUD_LIBRARY_BATCH_SIZE))
    let completedChunks = 0
    for (let offset = 0; offset < changedBatches.length; offset += CLOUD_LIBRARY_UPLOAD_CONCURRENCY) {
      await lease.refresh()
      const wave = changedBatches.slice(offset, offset + CLOUD_LIBRARY_UPLOAD_CONCURRENCY)
      onProgress?.({ currentBatch: Math.ceil(completedChunks / CLOUD_LIBRARY_BATCH_SIZE), totalBatches, completed: completedChunks, total: chunks.length, activeRequests: wave.length })
      await Promise.all(wave.map(async (batch, waveIndex) => {
        const currentBatch = offset + waveIndex + 1
        const writeBatchOperation = writeBatch(db)
        for (const chunk of batch)
          writeBatchOperation.set(cloudDocument(db, uid, 'library', chunk.chunkId), prepareFirestoreData(chunk))
        await withSyncTimeout(writeBatchOperation.commit(), `Library upload batch ${currentBatch}`)
      }))
      completedChunks += wave.reduce((total, batch) => total + batch.length, 0)
      onProgress?.({ currentBatch: Math.ceil(completedChunks / CLOUD_LIBRARY_BATCH_SIZE), totalBatches, completed: completedChunks, total: chunks.length })
    }
    const partBatches = Array.from({ length: Math.ceil(manifestDocuments.parts.length / CLOUD_LIBRARY_BATCH_SIZE) }, (_, index) => manifestDocuments.parts.slice(index * CLOUD_LIBRARY_BATCH_SIZE, (index + 1) * CLOUD_LIBRARY_BATCH_SIZE))
    for (let offset = 0; offset < partBatches.length; offset += CLOUD_LIBRARY_UPLOAD_CONCURRENCY) {
      await lease.refresh()
      const wave = partBatches.slice(offset, offset + CLOUD_LIBRARY_UPLOAD_CONCURRENCY)
      await Promise.all(wave.map(async (batch, waveIndex) => {
        const writeBatchOperation = writeBatch(db)
        for (const part of batch)
          writeBatchOperation.set(cloudDocument(db, uid, 'library', part.partId), prepareFirestoreData(part))
        await withSyncTimeout(writeBatchOperation.commit(), `Library manifest part publish batch ${offset + waveIndex + 1}`)
      }))
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
        if (source.schemaVersion !== CLOUD_SCHEMA_VERSION)
          return '#invalid'
        return validateV5LibraryManifest(value, uid).revision
      },
    )
    if (!result.written)
      return { conflicted: true, hashes: new Map(knownHashes), revision: knownRevision, chunks }
    await updateCloudSyncHead(db, uid, { libraryRevision: manifest.revision })
    const liveIds = new Set(chunks.map(chunk => chunk.chunkId))
    const knownStaleChunkIds = Array.from(knownHashes.keys()).filter(id => id.startsWith('chunk-') && !liveIds.has(id))
    if (!knownHashes.size || knownStaleChunkIds.length) {
      // The manifest/head is the user-visible ACK boundary. Cleanup is a
      // best-effort maintenance task and must never delay that ACK.
      void scheduleCloudLibraryCleanup(
        db,
        uid,
        liveIds,
        new Set(manifestDocuments.parts.map(part => part.partId)),
        knownHashes,
      )
    }
    onProgress?.({ currentBatch: totalBatches, totalBatches, completed: chunks.length, total: chunks.length, activeRequests: 0 })
    return { conflicted: false, hashes: new Map(chunks.map(chunk => [chunk.chunkId, chunk.checksum])), revision: manifest.revision, chunks }
  }
  finally {
    await lease.release()
  }
}

async function scheduleCloudLibraryCleanup(
  db: Firestore,
  uid: string,
  liveIds: ReadonlySet<string>,
  liveManifestPartIds: ReadonlySet<string>,
  knownHashes: ReadonlyMap<string, string>,
): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 0))
  let lease: LibraryWriteLease | null = null
  try {
    lease = await acquireLibraryWriteLease(db, uid)
    await cleanupUnreferencedV5Chunks(db, uid, liveIds, liveManifestPartIds, knownHashes, lease.refresh)
  }
  catch {
    // Cleanup is intentionally best effort. A later publication can retry it.
  }
  finally {
    await lease?.release()
  }
}

async function cleanupUnreferencedV5Chunks(
  db: Firestore,
  uid: string,
  liveIds: ReadonlySet<string>,
  liveManifestPartIds: ReadonlySet<string>,
  knownHashes: ReadonlyMap<string, string>,
  refreshLease: () => Promise<void>,
): Promise<void> {
  try {
    const knownStaleIds = Array.from(knownHashes.keys()).filter(id => id.startsWith('chunk-') && !liveIds.has(id))
    // The previous manifest gives us the exact stale content-addressed chunk
    // ids after a normal edit. A full collection scan is only needed for the
    // first v5 publication, when there is no local manifest index yet.
    if (knownHashes.size) {
      for (let offset = 0; offset < knownStaleIds.length; offset += CLOUD_LIBRARY_BATCH_SIZE) {
        await refreshLease()
        const batch = writeBatch(db)
        for (const staleId of knownStaleIds.slice(offset, offset + CLOUD_LIBRARY_BATCH_SIZE))
          batch.delete(cloudDocument(db, uid, 'library', staleId))
        await withSyncTimeout(batch.commit(), 'Library cleanup batch')
      }
      return
    }
    const scannedStaleIds: string[] = []
    const libraryReference = cloudCollection(db, uid, 'library')
    let cursor: QueryDocumentSnapshot<DocumentData> | null = null
    do {
      const pageQuery = cursor
        ? query(libraryReference, orderBy(documentId()), startAfter(cursor), limit(CLOUD_LIBRARY_BATCH_SIZE))
        : query(libraryReference, orderBy(documentId()), limit(CLOUD_LIBRARY_BATCH_SIZE))
      const snapshot: QuerySnapshot<DocumentData> = await withSyncTimeout(
        getDocsFromServer(pageQuery),
        'Library cleanup scan',
      )
      for (const document of snapshot.docs) {
        if ((document.id.startsWith('chunk-') && !liveIds.has(document.id))
          || (document.id.startsWith('manifest-part-') && !liveManifestPartIds.has(document.id))) {
          scannedStaleIds.push(document.id)
        }
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
      await withSyncTimeout(batch.commit(), 'Library cleanup batch')
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
  onProgress?: (completed: number, total: number) => void,
): Promise<CloudLearningWriteResult> {
  const progressHash = canonicalHash(progress)
  const statsHash = canonicalHash(stats)
  const progressChanged = knownHashes.progress !== progressHash
  const statsChanged = knownHashes.stats !== statsHash
  const total = Number(progressChanged) + Number(statsChanged)
  let completed = 0
  onProgress?.(completed, total)
  const [progressResult, statsResult] = await Promise.all([
    progressChanged
      ? setDocIfUnchanged(
          db,
          cloudDocument(db, uid, 'progress', 'global'),
          knownHashes.progress,
          { ...progress, ownerId: uid, schemaVersion: CLOUD_SCHEMA_VERSION } satisfies FirestoreProgressDoc,
          value => value === null ? '' : canonicalHash(normalizeCloudProgress(value, uid)),
        )
      : Promise.resolve({ written: true } satisfies ConditionalWriteResult),
    statsChanged
      ? setDocIfUnchanged(
          db,
          cloudDocument(db, uid, 'stats', 'summary'),
          knownHashes.stats,
          { ...stats, ownerId: uid, schemaVersion: CLOUD_SCHEMA_VERSION } satisfies FirestoreStatsDoc,
          value => value === null ? '' : canonicalHash(normalizeCloudStats(value, uid)),
        )
      : Promise.resolve({ written: true } satisfies ConditionalWriteResult),
  ])
  completed = Number(progressChanged) + Number(statsChanged)
  if (total > 0)
    onProgress?.(completed, total)
  if (progressResult.written && statsResult.written && (progressChanged || statsChanged))
    await updateCloudSyncHead(db, uid, { progressHash, statsHash })
  return { progress: progressResult, stats: statsResult, progressHash, statsHash, progressChanged, statsChanged }
}

export interface CloudAiSettingsWriteResult {
  result: ConditionalWriteResult
  hash: string
  changed: boolean
}

export async function writeCloudAiSettings(
  db: Firestore,
  uid: string,
  settings: AiSettings,
  knownHash: string,
  onProgress?: (completed: number, total: number) => void,
): Promise<CloudAiSettingsWriteResult> {
  const shareable = getShareableAiSettings(settings)
  const hash = canonicalHash(shareable)
  if (knownHash === hash)
    return { result: { written: true }, hash, changed: false }
  onProgress?.(0, 1)

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
  onProgress?.(1, 1)
  if (result.written)
    await updateCloudSyncHead(db, uid, { settingsHash: hash })
  return { result, hash, changed: true }
}

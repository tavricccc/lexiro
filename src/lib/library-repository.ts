import type { FirestoreLibraryChunk, FirestoreLibraryV5Chunk, LibraryIndex, LibraryQuestion, LibrarySearchEntry, LibrarySet, LibrarySetSummary, LibraryState, SetMembership, VocabFolder, WordEntry } from '@/types'
import { del, get, keys, set, setMany } from 'idb-keyval'
import { LIBRARY_STORAGE_KEY } from '@/constants'
import { cloneJson } from './clone'
import { ALL_FOLDER_ID, createUncategorizedFolder, sortFolders, UNCATEGORIZED_FOLDER_ID } from './folders'
import { canonicalHash } from './hash'
import { normalizeWordKey } from './library'
import { getStorageNamespace, loadFromStorage } from './persist'
import { normalizeLibraryState } from './share'

/** IndexedDB schema for the large library. The active marker is the only pointer readers use. */
export const LIBRARY_REPOSITORY_SCHEMA_VERSION = 1 as const
export const LIBRARY_PAGE_SIZE = 24
export const LIBRARY_CONTENT_CACHE_LIMIT = 48

type LibraryRecordKind = 'folder' | 'set' | 'membership' | 'word' | 'question'

export interface LibraryRepositoryRecord {
  kind: LibraryRecordKind
  id: string
  value: VocabFolder | LibrarySet | SetMembership[] | WordEntry | LibraryQuestion
}

export interface LibrarySetPayload {
  set: LibrarySet
  memberships: SetMembership[]
  words: WordEntry[]
  questions: LibraryQuestion[]
}

export interface LibraryFolderPage {
  folderId: string
  folders: VocabFolder[]
  sets: LibrarySetSummary[]
  page: number
  pageSize: number
  hasMore: boolean
  totalSets: number
}

/** Lightweight set memberships used by aggregate views without loading words. */
export interface LibraryMembershipBatchEntry {
  setId: string
  memberships: SetMembership[]
}

export interface LibrarySearchPage {
  query: string
  items: LibrarySetSummary[]
  page: number
  pageSize: number
  hasMore: boolean
  total: number
}

export interface LibraryCommitResult extends LibraryIndex {
  migrated: boolean
}

type LibraryCommitInput = LibraryState | PartialLibraryCollections | LibraryRepositoryRecord[]

interface ActiveGeneration {
  schemaVersion: typeof LIBRARY_REPOSITORY_SCHEMA_VERSION
  generation: string
  updatedAt: string
  indexChecksum?: string
}

interface StagingManifest {
  schemaVersion: typeof LIBRARY_REPOSITORY_SCHEMA_VERSION
  generation: string
  updatedAt?: string
  stagedAt?: string
  complete?: boolean
  remoteRevision?: string
  remoteChunkIds?: string[]
  ids: Record<LibraryRecordKind, string[]>
  questionIdsBySet?: Record<string, string[]>
}

interface StagedIndexBatch {
  kind: 'index'
  index: LibraryIndex
}

export interface LibraryRemoteStagingBatch {
  kind: 'remote'
  revision: string
  chunks: Array<FirestoreLibraryChunk | FirestoreLibraryV5Chunk>
  records: LibraryRepositoryRecord[]
}

export interface ResumableRemoteGeneration {
  generation: string
  revision: string
  chunkIds: string[]
}

export interface RemoteLibrarySyncState {
  schemaVersion: 1
  revision: string
  updatedAt: string
  hashes: Record<string, string>
}

interface StoredRemoteLibraryChunk {
  schemaVersion: 1
  checksum: string
  chunk: FirestoreLibraryChunk | FirestoreLibraryV5Chunk
}

interface StoredRecord {
  schemaVersion: typeof LIBRARY_REPOSITORY_SCHEMA_VERSION
  generation: string
  kind: LibraryRecordKind
  id: string
  checksum: string
  value: LibraryRepositoryRecord['value']
}

interface LibraryCollections {
  folders: VocabFolder[]
  sets: LibrarySet[]
  memberships: Record<string, SetMembership[]>
  words: Record<string, WordEntry>
  questions: LibraryQuestion[]
  updatedAt: string
}

interface PartialLibraryCollections {
  folders?: VocabFolder[]
  sets?: LibrarySet[]
  memberships?: Record<string, SetMembership[]>
  words?: Record<string, WordEntry>
  questions?: LibraryQuestion[]
  updatedAt?: string
}

const RECORD_KINDS: LibraryRecordKind[] = ['folder', 'set', 'membership', 'word', 'question']

function emptyCollections(now = new Date().toISOString()): LibraryCollections {
  return {
    folders: [createUncategorizedFolder()],
    sets: [],
    memberships: {},
    words: {},
    questions: [],
    updatedAt: now,
  }
}

function isLibraryState(value: LibraryState | PartialLibraryCollections): value is LibraryState {
  return Boolean(value && 'version' in value && 'words' in value && 'sets' in value && 'memberships' in value && 'folders' in value && 'questions' in value)
}

function normalizeCollections(value: LibraryState | PartialLibraryCollections): LibraryCollections {
  if (isLibraryState(value)) {
    const sanitizedSets = value.sets.map((set) => {
      const { wordCount: _wordCount, senseCount: _senseCount, questionCount: _questionCount, ...metadata } = set as LibrarySetSummary
      return metadata
    })
    const normalized = normalizeLibraryState({ ...cloneJson(value), sets: sanitizedSets })
    return {
      folders: sortFolders(normalized.folders),
      sets: normalized.sets.map(set => ({ ...set, folderId: set.folderId || UNCATEGORIZED_FOLDER_ID })),
      memberships: cloneJson(normalized.memberships),
      words: cloneJson(normalized.words),
      questions: cloneJson(normalized.questions),
      updatedAt: normalized.updatedAt,
    }
  }
  const base = emptyCollections(value.updatedAt)
  const folders = value.folders ? sortFolders(cloneJson(value.folders)) : base.folders
  if (!folders.some(folder => folder.id === UNCATEGORIZED_FOLDER_ID))
    folders.unshift(createUncategorizedFolder())
  return {
    folders,
    sets: value.sets ? cloneJson(value.sets) : base.sets,
    memberships: value.memberships ? cloneJson(value.memberships) : base.memberships,
    words: value.words ? cloneJson(value.words) : base.words,
    questions: value.questions ? cloneJson(value.questions) : base.questions,
    updatedAt: value.updatedAt || base.updatedAt,
  }
}

function normalizeLegacyCollections(value: unknown): LibraryCollections {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('legacy library must be a complete object')
  const source = value as Record<string, unknown>
  const requiredKeys = ['version', 'words', 'sets', 'memberships', 'folders', 'questions', 'updatedAt']
  if (requiredKeys.some(key => !(key in source)))
    throw new Error('legacy library is not a complete snapshot')
  return normalizeCollections(value as LibraryState)
}

function stripSetSummary(value: LibrarySet | LibrarySetSummary): LibrarySet {
  const { wordCount: _wordCount, senseCount: _senseCount, questionCount: _questionCount, ...set } = value as LibrarySetSummary
  return set
}

function normalizeSearchText(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase('zh-TW').replace(/\s+/g, ' ')
}

function membershipsForSet(collections: LibraryCollections, setId: string): SetMembership[] {
  return (collections.memberships[setId] ?? []).map(member => ({ wordKey: normalizeWordKey(member.wordKey), senseIds: [...member.senseIds] }))
}

function questionsForSet(collections: LibraryCollections, setId: string): LibraryQuestion[] {
  const memberships = new Map(membershipsForSet(collections, setId).map(member => [member.wordKey, new Set(member.senseIds)]))
  return collections.questions.filter((question) => {
    if (question.kind === 'reading')
      return question.questions.every(child => memberships.get(normalizeWordKey(child.wordKey))?.has(child.senseId))
    return Boolean(memberships.get(normalizeWordKey(question.wordKey))?.has(question.senseId))
  })
}

function buildIndex(generation: string, collections: LibraryCollections): LibraryIndex {
  const words = collections.words
  const searchIndex: LibrarySearchEntry[] = []
  const sets = collections.sets.map((set): LibrarySetSummary => {
    const memberships = membershipsForSet(collections, set.id)
    const terms = memberships.flatMap((member) => {
      const word = words[member.wordKey]
      if (!word)
        return []
      return [word.word, ...word.senses.filter(sense => member.senseIds.includes(sense.id)).map(sense => sense.meaningZh)]
    })
    const uniqueTerms = Array.from(new Set(terms.map(normalizeSearchText).filter(Boolean)))
    searchIndex.push({
      setId: set.id,
      setName: set.setName,
      normalizedSetName: normalizeSearchText(set.setName),
      terms: uniqueTerms,
    })
    return {
      ...set,
      wordCount: memberships.length,
      senseCount: memberships.reduce((total, member) => total + member.senseIds.length, 0),
      questionCount: questionsForSet(collections, set.id).length,
    }
  })
  return {
    schemaVersion: LIBRARY_REPOSITORY_SCHEMA_VERSION,
    generation,
    updatedAt: collections.updatedAt,
    folders: sortFolders(collections.folders),
    sets,
    searchIndex,
  }
}

function recordEntries(collections: LibraryCollections): LibraryRepositoryRecord[] {
  return [
    ...collections.folders.map(value => ({ kind: 'folder' as const, id: value.id, value })),
    ...collections.sets.map(value => ({ kind: 'set' as const, id: value.id, value })),
    ...Object.entries(collections.memberships).map(([id, value]) => ({ kind: 'membership' as const, id, value })),
    ...Object.entries(collections.words).map(([id, value]) => ({ kind: 'word' as const, id, value })),
    ...collections.questions.map(value => ({ kind: 'question' as const, id: value.id, value })),
  ]
}

function mergeRecordEntries(base: LibraryCollections, entries: LibraryRepositoryRecord[]): LibraryCollections {
  const next = cloneJson(base)
  for (const entry of entries) {
    if (entry.kind === 'folder') {
      next.folders = [...next.folders.filter(folder => folder.id !== entry.id), cloneJson(entry.value as VocabFolder)]
    }
    else if (entry.kind === 'set') {
      next.sets = [...next.sets.filter(set => set.id !== entry.id), cloneJson(entry.value as LibrarySet)]
    }
    else if (entry.kind === 'membership') {
      next.memberships[entry.id] = cloneJson(entry.value as SetMembership[])
    }
    else if (entry.kind === 'word') {
      next.words[entry.id] = cloneJson(entry.value as WordEntry)
    }
    else {
      next.questions = [...next.questions.filter(question => question.id !== entry.id), cloneJson(entry.value as LibraryQuestion)]
    }
  }
  return next
}

function recordValueHash(record: Pick<LibraryRepositoryRecord, 'kind' | 'id' | 'value'>): string {
  return canonicalHash({ kind: record.kind, id: record.id, value: record.value })
}

function emptyStagingIds(generation: string, updatedAt?: string): StagingManifest {
  return { schemaVersion: LIBRARY_REPOSITORY_SCHEMA_VERSION, generation, ...(updatedAt ? { updatedAt } : {}), complete: false, remoteChunkIds: [], ids: { folder: [], set: [], membership: [], word: [], question: [] }, questionIdsBySet: {} }
}

function questionIdsBySet(collections: LibraryCollections): Record<string, string[]> {
  return Object.fromEntries(collections.sets.map(set => [set.id, questionsForSet(collections, set.id).map(question => question.id)]))
}

function pageSlice<T>(items: T[], page: number, pageSize: number): { items: T[], hasMore: boolean } {
  const safePage = Math.max(0, Math.floor(page))
  const safeSize = Math.max(1, Math.floor(pageSize))
  const start = safePage * safeSize
  return { items: items.slice(start, start + safeSize), hasMore: start + safeSize < items.length }
}

/**
 * Repository for the Library's index and content shards.
 *
 * Every write targets a fresh generation. Readers continue using the previous
 * generation until the final active marker is written, so a failed migration
 * or interrupted batch can never expose a partially written library.
 */
export class LibraryRepository {
  readonly namespace: string
  private readonly prefix: string
  private activeIndex: LibraryIndex | null = null
  private commitQueue: Promise<unknown> = Promise.resolve()
  private readonly payloadCache = new Map<string, LibrarySetPayload>()
  private readonly pendingLoads = new Map<string, { promise: Promise<LibrarySetPayload>, controller: AbortController, waiters: number }>()

  constructor(namespace = getStorageNamespace()) {
    this.namespace = namespace.trim() || 'guest'
    this.prefix = `${this.namespace}:lexiro-library-v5`
  }

  private activeKey(): string {
    return `${this.prefix}:active`
  }

  private indexKey(generation: string): string {
    return `${this.prefix}:${generation}:index`
  }

  private stagingKey(generation: string): string {
    return `${this.prefix}:${generation}:staging`
  }

  private remoteChunkKey(generation: string, chunkId: string): string {
    return `${this.prefix}:${generation}:remote-chunk:${encodeURIComponent(chunkId)}`
  }

  private remoteSyncStateKey(): string {
    return `${this.prefix}:remote-cache:state`
  }

  private remoteCacheChunkKey(chunkId: string): string {
    return `${this.prefix}:remote-cache:chunk:${encodeURIComponent(chunkId)}`
  }

  private recordKey(generation: string, kind: LibraryRecordKind, id: string): string {
    return `${this.prefix}:${generation}:record:${kind}:${encodeURIComponent(id)}`
  }

  private async readActive(): Promise<ActiveGeneration | null> {
    const marker = await get<ActiveGeneration>(this.activeKey())
    if (!marker || marker.schemaVersion !== LIBRARY_REPOSITORY_SCHEMA_VERSION || !marker.generation)
      return null
    return marker
  }

  private async readIndex(generation: string): Promise<LibraryIndex | null> {
    const index = await get<LibraryIndex>(this.indexKey(generation))
    if (!index || index.schemaVersion !== LIBRARY_REPOSITORY_SCHEMA_VERSION || index.generation !== generation)
      return null
    return index
  }

  private async readRecord(generation: string, kind: LibraryRecordKind, id: string): Promise<LibraryRepositoryRecord | null> {
    const record = await get<StoredRecord>(this.recordKey(generation, kind, id))
    if (!record || record.schemaVersion !== LIBRARY_REPOSITORY_SCHEMA_VERSION || record.generation !== generation || record.kind !== kind || record.id !== id)
      return null
    const current = { kind: record.kind, id: record.id, value: record.value }
    if (record.checksum !== recordValueHash(current))
      throw new Error(`Library record checksum mismatch: ${kind}/${id}`)
    return current
  }

  private async migrateLegacy(): Promise<LibraryCommitResult> {
    let legacy = emptyCollections()
    const stored = await loadFromStorage(LIBRARY_STORAGE_KEY)
    let corruptLegacy: string | null = null
    if (stored.value) {
      try {
        const parsed = JSON.parse(stored.value) as LibraryState
        legacy = normalizeLegacyCollections(parsed)
      }
      catch {
        // Keep the raw blob until a clean generation is live, then quarantine it
        // before clearing the legacy entry. A damaged import must remain
        // recoverable even when the app falls back to an empty Library.
        corruptLegacy = stored.value
      }
    }
    const result = await this.commitRecordsInternal({
      version: 1,
      words: legacy.words,
      sets: legacy.sets,
      memberships: legacy.memberships,
      folders: legacy.folders,
      questions: legacy.questions,
      updatedAt: legacy.updatedAt,
    }, true)
    const quarantined = corruptLegacy ? await this.quarantineLegacyStorage(corruptLegacy) : true
    if (quarantined)
      await this.clearLegacyStorage()
    return result
  }

  private async quarantineLegacyStorage(raw: string): Promise<boolean> {
    const key = `${this.namespace}:${LIBRARY_STORAGE_KEY}:quarantine:${Date.now()}-${crypto.randomUUID()}`
    try {
      await set(key, raw)
      return true
    }
    catch {
      // The legacy value is still present if quarantine fails, so a later
      // startup can retry without silently discarding the original blob.
      return false
    }
  }

  private async clearLegacyStorage(): Promise<void> {
    try {
      const stored = await loadFromStorage(LIBRARY_STORAGE_KEY)
      if (stored.value) {
        try {
          normalizeLegacyCollections(JSON.parse(stored.value))
        }
        catch {
          // Never erase a legacy blob that cannot be parsed or normalized.
          return
        }
      }
      await set(`${this.namespace}:${LIBRARY_STORAGE_KEY}`, '')
    }
    catch {
      // The active generation is already safe. A later startup can retry
      // clearing the legacy mirror without blocking Library access.
    }
  }

  /**
   * Recovery is only used when the active pointer or its index is unusable.
   * Normal startup never enumerates records, but an interrupted migration can
   * leave a complete generation behind with a missing/corrupt pointer. In
   * that case the staging manifest and per-record checksums are enough to
   * rebuild the index without trusting the damaged index value.
   */
  private async recoverLatestGeneration(preferredGeneration = ''): Promise<LibraryIndex | null> {
    const keyPrefix = `${this.prefix}:`
    const indexSuffix = ':index'
    const stagingSuffix = ':staging'
    const candidates = new Set<string>()
    for (const key of await keys()) {
      if (typeof key !== 'string' || !key.startsWith(keyPrefix))
        continue
      if (key.endsWith(indexSuffix))
        candidates.add(key.slice(keyPrefix.length, -indexSuffix.length))
      if (key.endsWith(stagingSuffix))
        candidates.add(key.slice(keyPrefix.length, -stagingSuffix.length))
    }

    const valid: LibraryIndex[] = []
    for (const generation of candidates) {
      if (!generation || generation === 'active')
        continue
      // Local commits/migrations are safe to recover from their completed
      // generation. A remote staging generation is only eligible when the
      // active marker already pointed at it; an unactivated download must not
      // become live merely because the app crashed during staging.
      if (!generation.startsWith('generation-') && generation !== preferredGeneration)
        continue
      try {
        const staging = await get<StagingManifest>(this.stagingKey(generation))
        if (!staging || staging.schemaVersion !== LIBRARY_REPOSITORY_SCHEMA_VERSION || staging.generation !== generation)
          continue
        if (staging.complete !== true)
          continue
        for (const kind of RECORD_KINDS) {
          for (const id of staging.ids[kind]) {
            if (!await this.readRecord(generation, kind, id))
              throw new Error(`Incomplete Library generation: ${kind}/${id}`)
          }
        }
        const collections = await this.loadStagedCollections(generation)
        if (!collections.folders.some(folder => folder.id === UNCATEGORIZED_FOLDER_ID))
          continue
        const rebuiltIndex = buildIndex(generation, collections)
        // The record checksums are authoritative during recovery. A damaged
        // or stale index can be rebuilt from a complete staging generation;
        // only missing/corrupt records reject the candidate.
        valid.push(rebuiltIndex)
      }
      catch {
        // Ignore incomplete/corrupt generations and continue looking for the
        // newest complete one. The legacy blob remains available as a final
        // fallback until a generation is successfully activated.
      }
    }
    valid.sort((left, right) => left.updatedAt.localeCompare(right.updatedAt) || left.generation.localeCompare(right.generation))
    const recovered = valid.at(-1)
    if (!recovered)
      return null
    const marker: ActiveGeneration = {
      schemaVersion: LIBRARY_REPOSITORY_SCHEMA_VERSION,
      generation: recovered.generation,
      updatedAt: recovered.updatedAt,
      indexChecksum: canonicalHash(recovered),
    }
    // The index is written before the pointer so readers never observe a
    // marker that cannot resolve to a complete index.
    await set(this.indexKey(recovered.generation), recovered)
    await set(this.activeKey(), marker)
    return recovered
  }

  async loadIndex(): Promise<LibraryIndex> {
    if (this.activeIndex)
      return cloneJson(this.activeIndex)
    const marker = await this.readActive()
    if (marker) {
      const index = await this.readIndex(marker.generation)
      if (index && marker.indexChecksum && marker.indexChecksum === canonicalHash(index)) {
        this.activeIndex = index
        await this.clearLegacyStorage()
        return cloneJson(index)
      }
    }
    const recovered = await this.recoverLatestGeneration(marker?.generation)
    if (recovered) {
      this.activeIndex = recovered
      await this.clearLegacyStorage()
      return cloneJson(recovered)
    }
    const result = await this.migrateLegacy()
    this.activeIndex = result
    return cloneJson(result)
  }

  /** Loads the complete canonical state for backup, editing, or sync code. */
  async loadState(): Promise<LibraryState> {
    const index = await this.loadIndex()
    const state: LibraryState = {
      version: 1,
      words: {},
      sets: index.sets.map(stripSetSummary),
      memberships: {},
      folders: cloneJson(index.folders),
      questions: [],
      updatedAt: index.updatedAt,
    }
    for await (const batch of this.streamAllRecords()) {
      for (const entry of batch) {
        if (entry.kind === 'folder')
          state.folders = [...state.folders.filter(folder => folder.id !== entry.id), cloneJson(entry.value as VocabFolder)]
        else if (entry.kind === 'set')
          state.sets = [...state.sets.filter(set => set.id !== entry.id), cloneJson(entry.value as LibrarySet)]
        else if (entry.kind === 'membership')
          state.memberships[entry.id] = cloneJson(entry.value as SetMembership[])
        else if (entry.kind === 'word')
          state.words[entry.id] = cloneJson(entry.value as WordEntry)
        else
          state.questions = [...state.questions.filter(question => question.id !== entry.id), cloneJson(entry.value as LibraryQuestion)]
      }
    }
    return normalizeLibraryState(state)
  }

  async listFolderPage(folderId = ALL_FOLDER_ID, page = 0, pageSize = LIBRARY_PAGE_SIZE): Promise<LibraryFolderPage> {
    const index = await this.loadIndex()
    const parentId = folderId === ALL_FOLDER_ID ? undefined : folderId
    const folders = index.folders
      .filter(folder => folder.id !== UNCATEGORIZED_FOLDER_ID && (folder.parentId ?? undefined) === parentId)
      .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name))
    const sets = index.sets
      .filter(set => folderId === ALL_FOLDER_ID ? set.folderId === UNCATEGORIZED_FOLDER_ID : set.folderId === folderId)
      .sort((left, right) => left.setName.localeCompare(right.setName))
    const sliced = pageSlice(sets, page, pageSize)
    return { folderId, folders, sets: sliced.items, page: Math.max(0, page), pageSize: Math.max(1, pageSize), hasMore: sliced.hasMore, totalSets: sets.length }
  }

  async searchSets(query: string, page = 0, pageSize = LIBRARY_PAGE_SIZE): Promise<LibrarySearchPage> {
    const index = await this.loadIndex()
    const normalizedQuery = normalizeSearchText(query)
    const terms = normalizedQuery.split(' ').filter(Boolean)
    const matches = index.searchIndex
      .filter(entry => terms.every(term => entry.normalizedSetName.includes(term) || entry.terms.some(candidate => candidate.includes(term))))
      .map(entry => index.sets.find(set => set.id === entry.setId))
      .filter((set): set is LibrarySetSummary => Boolean(set))
    const sliced = pageSlice(matches, page, pageSize)
    return { query: normalizedQuery, items: sliced.items, page: Math.max(0, page), pageSize: Math.max(1, pageSize), hasMore: sliced.hasMore, total: matches.length }
  }

  /** Streams only set memberships for aggregate views such as Statistics. */
  async* streamMemberships(batchSize = LIBRARY_PAGE_SIZE): AsyncGenerator<LibraryMembershipBatchEntry[]> {
    const index = await this.loadIndex()
    const staging = await get<StagingManifest>(this.stagingKey(index.generation))
    const safeBatchSize = Math.max(1, Math.floor(batchSize))
    let batch: LibraryMembershipBatchEntry[] = []
    for (const setId of staging?.ids.membership ?? []) {
      const record = await this.readRecord(index.generation, 'membership', setId)
      if (!record)
        continue
      batch.push({ setId, memberships: cloneJson(record.value as SetMembership[]) })
      if (batch.length >= safeBatchSize) {
        yield batch
        batch = []
      }
    }
    if (batch.length)
      yield batch
  }

  async loadSetPayloads(setIds: string | string[], options?: { signal?: AbortSignal }): Promise<Map<string, LibrarySetPayload>> {
    const index = await this.loadIndex()
    const generation = index.generation
    const requested = Array.from(new Set(typeof setIds === 'string' ? [setIds] : setIds))
    const result = new Map<string, LibrarySetPayload>()
    for (const setId of requested) {
      if (options?.signal?.aborted)
        throw new DOMException('The operation was aborted.', 'AbortError')
      const summary = index.sets.find(set => set.id === setId)
      if (!summary)
        continue
      const cached = this.payloadCache.get(setId)
      if (cached) {
        result.set(setId, cloneJson(cached))
        this.touchCache(setId, cached)
        continue
      }
      const pending = this.pendingLoads.get(setId)
      if (pending) {
        pending.waiters += 1
        try {
          const payload = await this.awaitWithSignal(pending.promise, options?.signal)
          result.set(setId, cloneJson(payload))
        }
        finally {
          this.releasePendingLoad(setId, pending)
        }
        continue
      }
      const controller = new AbortController()
      const promise = this.readSetPayload(setId, generation, controller.signal)
      const pendingLoad = { promise, controller, waiters: 1 }
      this.pendingLoads.set(setId, pendingLoad)
      try {
        const payload = await this.awaitWithSignal(promise, options?.signal)
        this.touchCache(setId, payload)
        result.set(setId, cloneJson(payload))
      }
      finally {
        this.releasePendingLoad(setId, pendingLoad)
        if (pendingLoad.waiters === 0 && this.pendingLoads.get(setId)?.promise === promise)
          this.pendingLoads.delete(setId)
      }
    }
    return result
  }

  /** Streams bounded groups of complete set payloads without touching Pinia. */
  async* streamSetPayloads(
    setIds: readonly string[],
    batchSize = LIBRARY_PAGE_SIZE,
    options?: { signal?: AbortSignal },
  ): AsyncGenerator<Map<string, LibrarySetPayload>> {
    const requested = Array.from(new Set(setIds))
    const safeBatchSize = Math.max(1, Math.floor(batchSize))
    for (let offset = 0; offset < requested.length; offset += safeBatchSize) {
      if (options?.signal?.aborted)
        throw new DOMException('The operation was aborted.', 'AbortError')
      yield await this.loadSetPayloads(requested.slice(offset, offset + safeBatchSize), options)
    }
  }

  cancelSetPayloadLoad(setId: string): void {
    this.pendingLoads.get(setId)?.controller.abort()
  }

  /** Finds an unactivated remote download whose verified batches can resume. */
  async findResumableRemoteGeneration(): Promise<ResumableRemoteGeneration | null> {
    const candidates: StagingManifest[] = []
    const keyPrefix = `${this.prefix}:`
    for (const key of await keys()) {
      if (typeof key !== 'string' || !key.startsWith(keyPrefix) || !key.endsWith(':staging'))
        continue
      const generation = key.slice(keyPrefix.length, -':staging'.length)
      if (!generation.startsWith('remote-'))
        continue
      const staging = await get<StagingManifest>(key)
      if (staging?.generation === generation && staging.remoteRevision && staging.complete !== true)
        candidates.push(staging)
    }
    candidates.sort((left, right) => (right.stagedAt ?? '').localeCompare(left.stagedAt ?? '') || right.generation.localeCompare(left.generation))
    const latest = candidates[0]
    return latest
      ? { generation: latest.generation, revision: latest.remoteRevision!, chunkIds: [...(latest.remoteChunkIds ?? [])] }
      : null
  }

  /** Reads raw chunks already committed into a resumable staging generation. */
  async loadStagedRemoteChunks(generation: string, chunkIds?: string[]): Promise<Map<string, FirestoreLibraryChunk | FirestoreLibraryV5Chunk>> {
    const staging = await get<StagingManifest>(this.stagingKey(generation))
    const result = new Map<string, FirestoreLibraryChunk | FirestoreLibraryV5Chunk>()
    for (const chunkId of chunkIds ?? staging?.remoteChunkIds ?? []) {
      const chunk = await get<FirestoreLibraryChunk | FirestoreLibraryV5Chunk>(this.remoteChunkKey(generation, chunkId))
      if (chunk)
        result.set(chunkId, cloneJson(chunk))
    }
    return result
  }

  async loadRemoteLibrarySyncState(): Promise<RemoteLibrarySyncState | null> {
    const value = await get<RemoteLibrarySyncState>(this.remoteSyncStateKey())
    if (!value || value.schemaVersion !== 1 || typeof value.revision !== 'string' || typeof value.updatedAt !== 'string' || !value.hashes || typeof value.hashes !== 'object' || Array.isArray(value.hashes) || !Object.values(value.hashes).every(checksum => typeof checksum === 'string'))
      return null
    return cloneJson(value)
  }

  async loadRemoteLibraryChunks(chunkIds: readonly string[], expectedHashes: ReadonlyMap<string, string> | Record<string, string>): Promise<Map<string, FirestoreLibraryChunk | FirestoreLibraryV5Chunk>> {
    const entries = await Promise.all(chunkIds.map(async (chunkId) => {
      const cached = await get<StoredRemoteLibraryChunk>(this.remoteCacheChunkKey(chunkId))
      const expected = expectedHashes instanceof Map ? expectedHashes.get(chunkId) : (expectedHashes as Record<string, string>)[chunkId]
      if (!cached || cached.schemaVersion !== 1 || !expected || cached.checksum !== expected || cached.chunk.chunkId !== chunkId)
        return null
      return [chunkId, cloneJson(cached.chunk)] as const
    }))
    return new Map(entries.filter((entry): entry is readonly [string, FirestoreLibraryChunk | FirestoreLibraryV5Chunk] => Boolean(entry)))
  }

  async saveRemoteLibraryChunks(chunks: readonly (FirestoreLibraryChunk | FirestoreLibraryV5Chunk)[]): Promise<void> {
    if (!chunks.length)
      return
    await setMany(chunks.map(chunk => [this.remoteCacheChunkKey(chunk.chunkId), { schemaVersion: 1, checksum: chunk.checksum, chunk: cloneJson(chunk) } satisfies StoredRemoteLibraryChunk]))
  }

  async commitRemoteLibrarySyncState(state: Omit<RemoteLibrarySyncState, 'schemaVersion'>): Promise<void> {
    const previous = await this.loadRemoteLibrarySyncState()
    const next: RemoteLibrarySyncState = { schemaVersion: 1, ...cloneJson(state) }
    const staleIds = Object.keys(previous?.hashes ?? {}).filter(chunkId => !Object.hasOwn(next.hashes, chunkId))
    await set(this.remoteSyncStateKey(), next)
    await Promise.all(staleIds.map(chunkId => del(this.remoteCacheChunkKey(chunkId))))
  }

  clearPayloadCache(): void {
    for (const pending of this.pendingLoads.values())
      pending.controller.abort()
    this.pendingLoads.clear()
    this.payloadCache.clear()
  }

  private releasePendingLoad(setId: string, pending: { promise: Promise<LibrarySetPayload>, controller: AbortController, waiters: number }): void {
    if (this.pendingLoads.get(setId) !== pending)
      return
    pending.waiters = Math.max(0, pending.waiters - 1)
    if (pending.waiters === 0) {
      pending.controller.abort()
      if (this.pendingLoads.get(setId) === pending)
        this.pendingLoads.delete(setId)
    }
  }

  private async readSetPayload(setId: string, generation: string, signal: AbortSignal): Promise<LibrarySetPayload> {
    const setRecord = await this.readRecord(generation, 'set', setId)
    if (signal.aborted)
      throw new DOMException('The operation was aborted.', 'AbortError')
    const membershipRecord = await this.readRecord(generation, 'membership', setId)
    if (!membershipRecord)
      throw new Error(`Library membership not found: ${setId}`)
    if (signal.aborted)
      throw new DOMException('The operation was aborted.', 'AbortError')
    const memberships = membershipRecord.value as SetMembership[]
    const words: WordEntry[] = []
    for (const member of memberships) {
      if (signal.aborted)
        throw new DOMException('The operation was aborted.', 'AbortError')
      const record = await this.readRecord(generation, 'word', normalizeWordKey(member.wordKey))
      if (!record)
        throw new Error(`Library word not found: ${member.wordKey}`)
      words.push(record.value as WordEntry)
    }
    const questions: LibraryQuestion[] = []
    const questionIds = await this.questionIdsForSet(generation, setId, signal)
    for (const questionId of questionIds) {
      if (signal.aborted)
        throw new DOMException('The operation was aborted.', 'AbortError')
      const record = await this.readRecord(generation, 'question', questionId)
      if (!record)
        throw new Error(`Library question not found: ${questionId}`)
      questions.push(record.value as LibraryQuestion)
    }
    if (!setRecord)
      throw new Error(`Library set not found: ${setId}`)
    return { set: setRecord.value as LibrarySet, memberships, words, questions }
  }

  private async questionIdsForSet(generation: string, setId: string, signal?: AbortSignal): Promise<string[]> {
    const staged = await get<StagingManifest>(this.stagingKey(generation))
    if (staged?.questionIdsBySet && Object.hasOwn(staged.questionIdsBySet, setId))
      return [...(staged.questionIdsBySet[setId] ?? [])]
    const membershipRecord = await this.readRecord(generation, 'membership', setId)
    const memberships = new Map(((membershipRecord?.value as SetMembership[] | undefined) ?? []).map(member => [normalizeWordKey(member.wordKey), new Set(member.senseIds)]))
    const ids = staged?.ids.question ?? []
    const matching: string[] = []
    for (const id of ids) {
      if (signal?.aborted)
        throw new DOMException('The operation was aborted.', 'AbortError')
      const record = await this.readRecord(generation, 'question', id)
      if (!record)
        continue
      const question = record.value as LibraryQuestion
      const belongs = question.kind === 'reading'
        ? question.questions.every(child => memberships.get(normalizeWordKey(child.wordKey))?.has(child.senseId))
        : Boolean(memberships.get(normalizeWordKey(question.wordKey))?.has(question.senseId))
      if (belongs)
        matching.push(id)
    }
    return matching
  }

  private async awaitWithSignal<T>(promise: Promise<T>, signal?: AbortSignal, onAbort?: () => void): Promise<T> {
    if (!signal)
      return promise
    if (signal.aborted)
      throw new DOMException('The operation was aborted.', 'AbortError')
    return new Promise<T>((resolve, reject) => {
      const abort = () => {
        onAbort?.()
        reject(new DOMException('The operation was aborted.', 'AbortError'))
      }
      signal.addEventListener('abort', abort, { once: true })
      promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
    })
  }

  private touchCache(setId: string, payload: LibrarySetPayload): void {
    this.payloadCache.delete(setId)
    this.payloadCache.set(setId, cloneJson(payload))
    while (this.payloadCache.size > LIBRARY_CONTENT_CACHE_LIMIT) {
      const oldest = this.payloadCache.keys().next().value
      if (!oldest)
        break
      this.payloadCache.delete(oldest)
    }
  }

  async* streamAllRecords(batchSize = 24): AsyncGenerator<LibraryRepositoryRecord[]> {
    const index = await this.loadIndex()
    const generation = index.generation
    const staging = await get<StagingManifest>(this.stagingKey(generation))
    const safeBatchSize = Math.max(1, Math.floor(batchSize))
    let batch: LibraryRepositoryRecord[] = []
    for (const kind of RECORD_KINDS) {
      for (const id of staging?.ids[kind] ?? []) {
        const record = await this.readRecord(generation, kind, id)
        if (!record)
          continue
        batch.push(record)
        if (batch.length >= safeBatchSize) {
          yield batch.map(cloneJson)
          batch = []
        }
      }
    }
    if (batch.length)
      yield batch.map(cloneJson)
  }

  async commitRecords(records: LibraryCommitInput): Promise<LibraryCommitResult> {
    const previous = this.commitQueue
    const run = previous.catch(() => undefined).then(() => this.commitRecordsInternal(records, false))
    this.commitQueue = run
    return run
  }

  private async commitRecordsInternal(records: LibraryCommitInput, migrated: boolean): Promise<LibraryCommitResult> {
    this.clearPayloadCache()
    let collections: LibraryCollections
    if (Array.isArray(records)) {
      collections = normalizeCollections(mergeRecordEntries(await this.loadCollections(), records))
    }
    else if (isLibraryState(records)) {
      collections = normalizeCollections(records)
    }
    else {
      const current = await this.loadCollections()
      collections = normalizeCollections({ ...current, ...records })
    }
    const generation = `generation-${Date.now()}-${crypto.randomUUID()}`
    const entries = recordEntries(collections)
    const staging = emptyStagingIds(generation, collections.updatedAt)
    staging.questionIdsBySet = questionIdsBySet(collections)
    const recordWrites: [string, StoredRecord][] = []
    for (const entry of entries) {
      const stored: StoredRecord = {
        schemaVersion: LIBRARY_REPOSITORY_SCHEMA_VERSION,
        generation,
        kind: entry.kind,
        id: entry.id,
        checksum: recordValueHash(entry),
        value: cloneJson(entry.value),
      }
      recordWrites.push([this.recordKey(generation, entry.kind, entry.id), stored])
      staging.ids[entry.kind].push(entry.id)
    }
    staging.complete = true
    const index = buildIndex(generation, collections)
    await setMany([
      ...recordWrites,
      [this.stagingKey(generation), staging],
      [this.indexKey(generation), index],
    ])
    const verified = await this.readIndex(generation)
    if (!verified)
      throw new Error('Library generation index verification failed')
    for (const entry of entries) {
      if (!await this.readRecord(generation, entry.kind, entry.id))
        throw new Error(`Library generation verification failed: ${entry.kind}/${entry.id}`)
    }
    const marker: ActiveGeneration = { schemaVersion: LIBRARY_REPOSITORY_SCHEMA_VERSION, generation, updatedAt: collections.updatedAt, indexChecksum: canonicalHash(index) }
    await set(this.activeKey(), marker)
    this.activeIndex = index
    return { ...cloneJson(index), migrated }
  }

  private async loadCollections(): Promise<LibraryCollections> {
    const index = await this.loadIndex()
    const generation = index.generation
    const staging = await get<StagingManifest>(this.stagingKey(generation))
    const collections = emptyCollections(index.updatedAt)
    collections.folders = []
    collections.sets = []
    collections.memberships = {}
    collections.words = {}
    collections.questions = []
    for (const kind of RECORD_KINDS) {
      for (const id of staging?.ids[kind] ?? []) {
        const record = await this.readRecord(generation, kind, id)
        if (!record)
          continue
        if (kind === 'folder')
          collections.folders.push(record.value as VocabFolder)
        else if (kind === 'set')
          collections.sets.push(record.value as LibrarySet)
        else if (kind === 'membership')
          collections.memberships[id] = record.value as SetMembership[]
        else if (kind === 'word')
          collections.words[id] = record.value as WordEntry
        else
          collections.questions.push(record.value as LibraryQuestion)
      }
    }
    if (!collections.folders.length)
      collections.folders = [createUncategorizedFolder()]
    return collections
  }

  async stageRemoteBatch(generation: string, batch: LibraryRepositoryRecord[] | { kind: LibraryRecordKind, records: LibraryRepositoryRecord[] } | StagedIndexBatch | LibraryRemoteStagingBatch | LibraryState): Promise<void> {
    if (!Array.isArray(batch) && 'kind' in batch && batch.kind === 'index') {
      if (batch.index.generation !== generation)
        throw new Error('Staged Library index belongs to a different generation')
      await set(this.indexKey(generation), cloneJson(batch.index))
      return
    }
    if (!Array.isArray(batch) && 'kind' in batch && batch.kind === 'remote') {
      const existing = await get<StagingManifest>(this.stagingKey(generation)) ?? emptyStagingIds(generation)
      if (existing.remoteRevision && existing.remoteRevision !== batch.revision)
        throw new Error('Remote staging generation belongs to a different manifest')
      const writes: [string, StoredRecord][] = []
      for (const entry of batch.records) {
        const stored: StoredRecord = {
          schemaVersion: LIBRARY_REPOSITORY_SCHEMA_VERSION,
          generation,
          kind: entry.kind,
          id: entry.id,
          checksum: recordValueHash(entry),
          value: cloneJson(entry.value),
        }
        writes.push([this.recordKey(generation, entry.kind, entry.id), stored])
        if (!existing.ids[entry.kind].includes(entry.id))
          existing.ids[entry.kind].push(entry.id)
      }
      const remoteChunkIds = new Set(existing.remoteChunkIds ?? [])
      const chunkWrites: [string, FirestoreLibraryChunk | FirestoreLibraryV5Chunk][] = []
      for (const chunk of batch.chunks) {
        remoteChunkIds.add(chunk.chunkId)
        chunkWrites.push([this.remoteChunkKey(generation, chunk.chunkId), cloneJson(chunk)])
      }
      existing.remoteRevision = batch.revision
      existing.remoteChunkIds = Array.from(remoteChunkIds)
      existing.stagedAt = new Date().toISOString()
      await setMany([
        ...writes,
        ...chunkWrites,
        [this.stagingKey(generation), existing],
      ])
      return
    }
    let stagedIndex: LibraryIndex | null = null
    let stagedUpdatedAt: string | undefined
    let stagedCollections: LibraryCollections | null = null
    const entries = Array.isArray(batch)
      ? batch
      : 'kind' in batch
        ? batch.records
        : (() => {
            const collections = normalizeCollections(batch)
            stagedCollections = collections
            stagedIndex = buildIndex(generation, collections)
            stagedUpdatedAt = collections.updatedAt
            return recordEntries(collections)
          })()
    const existing = await get<StagingManifest>(this.stagingKey(generation)) ?? emptyStagingIds(generation)
    const writes: [string, StoredRecord][] = []
    for (const entry of entries) {
      const stored: StoredRecord = {
        schemaVersion: LIBRARY_REPOSITORY_SCHEMA_VERSION,
        generation,
        kind: entry.kind,
        id: entry.id,
        checksum: recordValueHash(entry),
        value: cloneJson(entry.value),
      }
      writes.push([this.recordKey(generation, entry.kind, entry.id), stored])
      if (!existing.ids[entry.kind].includes(entry.id))
        existing.ids[entry.kind].push(entry.id)
    }
    if (stagedIndex) {
      const completeIds = emptyStagingIds(generation, stagedUpdatedAt).ids
      for (const entry of recordEntries(stagedCollections!))
        completeIds[entry.kind].push(entry.id)
      existing.ids = completeIds
      existing.complete = true
      existing.updatedAt = stagedUpdatedAt
      if (stagedCollections)
        existing.questionIdsBySet = questionIdsBySet(stagedCollections)
    }
    await setMany([
      ...writes,
      [this.stagingKey(generation), existing],
      ...(stagedIndex ? [[this.indexKey(generation), stagedIndex] as [string, LibraryIndex]] : []),
    ])
  }

  async activateGeneration(generation: string, index?: LibraryIndex): Promise<LibraryIndex> {
    const staging = await get<StagingManifest>(this.stagingKey(generation))
    if (!staging || staging.generation !== generation || staging.complete !== true)
      throw new Error('Cannot activate a generation without a staging manifest')
    for (const kind of RECORD_KINDS) {
      for (const id of staging.ids[kind]) {
        if (!await this.readRecord(generation, kind, id))
          throw new Error(`Library generation is missing ${kind}/${id}`)
      }
    }
    const stagedCollections = await this.loadStagedCollections(generation)
    if (!stagedCollections.folders.some(folder => folder.id === UNCATEGORIZED_FOLDER_ID))
      throw new Error('Library generation is missing the uncategorized folder')
    const rebuiltIndex = buildIndex(generation, stagedCollections)
    const stagedIndex = await this.readIndex(generation)
    const nextIndex = index ?? stagedIndex ?? rebuiltIndex
    if (nextIndex.generation !== generation)
      throw new Error('Cannot activate a different Library generation')
    if (canonicalHash(nextIndex) !== canonicalHash(rebuiltIndex))
      throw new Error('Library generation index does not match staged records')
    const marker: ActiveGeneration = { schemaVersion: LIBRARY_REPOSITORY_SCHEMA_VERSION, generation, updatedAt: nextIndex.updatedAt, indexChecksum: canonicalHash(nextIndex) }
    await setMany([
      [this.indexKey(generation), nextIndex],
      [this.activeKey(), marker],
    ])
    this.activeIndex = nextIndex
    this.clearPayloadCache()
    return cloneJson(nextIndex)
  }

  private async loadStagedCollections(generation: string): Promise<LibraryCollections> {
    const staging = await get<StagingManifest>(this.stagingKey(generation)) ?? emptyStagingIds(generation)
    const stagedIndex = await this.readIndex(generation)
    const collections = emptyCollections(stagedIndex?.updatedAt ?? staging.updatedAt)
    collections.folders = []
    collections.sets = []
    collections.memberships = {}
    collections.words = {}
    collections.questions = []
    for (const kind of RECORD_KINDS) {
      for (const id of staging.ids[kind]) {
        const record = await this.readRecord(generation, kind, id)
        if (!record)
          continue
        if (kind === 'folder')
          collections.folders.push(record.value as VocabFolder)
        else if (kind === 'set')
          collections.sets.push(record.value as LibrarySet)
        else if (kind === 'membership')
          collections.memberships[id] = record.value as SetMembership[]
        else if (kind === 'word')
          collections.words[id] = record.value as WordEntry
        else
          collections.questions.push(record.value as LibraryQuestion)
      }
    }
    return collections
  }
}

const repositoryCache = new Map<string, LibraryRepository>()

export function getLibraryRepository(namespace = getStorageNamespace()): LibraryRepository {
  const normalized = namespace.trim() || 'guest'
  const existing = repositoryCache.get(normalized)
  if (existing)
    return existing
  const repository = new LibraryRepository(normalized)
  repositoryCache.set(normalized, repository)
  return repository
}

export function resetLibraryRepositoryCache(): void {
  for (const repository of repositoryCache.values())
    repository.clearPayloadCache()
  repositoryCache.clear()
}

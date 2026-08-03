import type { SyncRecords } from './sync-outbox'
import type { AiSettings, DashboardStats, FirestoreLibraryManifestPart, FirestoreLibraryV5Chunk, FirestoreLibraryV5Manifest, FirestoreSyncHeadDoc, LearningProgress, LibrarySet, LibraryState, SetMembership, VocabFolder, WordEntry } from '@/types'
import { CLOUD_SCHEMA_VERSION, CLOUD_STATS_PAYLOAD_KEYS, MAX_LIBRARY_CHUNK_BYTES, MAX_LIBRARY_MANIFEST_BYTES } from '@/constants/cloud'
import { getShareableAiSettings, normalizeAiSettings } from './ai-provider'
import { CloudSyncError } from './cloud-sync-errors'
import { canonicalHash, estimateJsonBytes } from './hash'
import { normalizeWordKey } from './library'
import { questionBelongsToAnyMemberships, questionUsesWords } from './question-ownership'
import { normalizeDashboardStats, normalizeLearningProgress } from './share'

type LibrarySection = FirestoreLibraryV5Chunk['section']
const LIBRARY_SECTIONS: LibrarySection[] = ['words', 'sets', 'memberships', 'folders', 'questions']

function v5ChunkForSection(uid: string, library: LibraryState, section: LibrarySection, items: unknown[]): FirestoreLibraryV5Chunk {
  const contentHash = canonicalHash({ section, items })
  const chunkId = `chunk-${contentHash}`
  const base = {
    ownerId: uid,
    schemaVersion: CLOUD_SCHEMA_VERSION,
    chunkId,
    updatedAt: library.updatedAt,
    section,
    items,
  } satisfies Omit<FirestoreLibraryV5Chunk, 'checksum'>
  const integrityBase = {
    ownerId: base.ownerId,
    schemaVersion: base.schemaVersion,
    chunkId: base.chunkId,
    section: base.section,
    items: base.items,
  }
  return { ...base, checksum: canonicalHash(integrityBase) }
}

/** Builds immutable, content-addressed v5 chunks. */
export function buildV5LibraryChunks(uid: string, library: LibraryState): FirestoreLibraryV5Chunk[] {
  const sections: { section: LibrarySection, items: unknown[] }[] = [
    { section: 'words', items: Object.values(library.words) },
    { section: 'sets', items: library.sets },
    { section: 'memberships', items: Object.entries(library.memberships).map(([setId, members]) => ({ setId, members })) },
    { section: 'folders', items: library.folders },
    { section: 'questions', items: library.questions },
  ]
  const chunks: FirestoreLibraryV5Chunk[] = []
  for (const { section, items } of sections) {
    let current: unknown[] = []
    for (const item of items) {
      const candidate = v5ChunkForSection(uid, library, section, [...current, item])
      if (!current.length && estimateJsonBytes(candidate) > MAX_LIBRARY_CHUNK_BYTES)
        throw new CloudSyncError('cloud/data-invalid', `Cloud ${section} 單筆資料超過大小限制`)
      if (current.length && estimateJsonBytes(candidate) > MAX_LIBRARY_CHUNK_BYTES) {
        chunks.push(v5ChunkForSection(uid, library, section, current))
        current = []
      }
      current.push(item)
    }
    if (current.length || !items.length)
      chunks.push(v5ChunkForSection(uid, library, section, current))
  }
  return chunks
}

export interface V5LibraryManifestDocuments {
  manifest: FirestoreLibraryV5Manifest
  parts: FirestoreLibraryManifestPart[]
}

function buildV5ManifestPart(uid: string, updatedAt: string, index: number, chunks: Record<string, string>): FirestoreLibraryManifestPart {
  const base = {
    ownerId: uid,
    schemaVersion: CLOUD_SCHEMA_VERSION,
    documentType: 'library-manifest-part' as const,
    partId: `manifest-part-${String(index + 1).padStart(4, '0')}`,
    updatedAt,
    chunks,
  }
  return { ...base, checksum: canonicalHash(base) }
}

const jsonEncoder = new TextEncoder()

function jsonByteLength(value: unknown): number {
  return jsonEncoder.encode(JSON.stringify(value)).byteLength
}

function manifestPartFixedBytes(uid: string, updatedAt: string, index: number): number {
  return jsonByteLength({
    ownerId: uid,
    schemaVersion: CLOUD_SCHEMA_VERSION,
    documentType: 'library-manifest-part',
    partId: `manifest-part-${String(index + 1).padStart(4, '0')}`,
    updatedAt,
    checksum: '00000000',
    chunks: {},
  }) - 2
}

function manifestEntryBytes(chunkId: string, checksum: string): number {
  return jsonEncoder.encode(`${JSON.stringify(chunkId)}:${JSON.stringify(checksum)}`).byteLength
}

export function buildV5LibraryManifestDocuments(uid: string, chunks: FirestoreLibraryV5Chunk[], updatedAt: string): V5LibraryManifestDocuments {
  const checksums = Object.fromEntries(chunks.map(chunk => [chunk.chunkId, chunk.checksum]))
  const flatManifest: FirestoreLibraryV5Manifest = {
    ownerId: uid,
    schemaVersion: CLOUD_SCHEMA_VERSION,
    documentType: 'library-manifest',
    updatedAt,
    revision: canonicalHash({ checksums, updatedAt }),
    chunks: checksums,
  }
  if (estimateJsonBytes(flatManifest) <= MAX_LIBRARY_MANIFEST_BYTES)
    return { manifest: flatManifest, parts: [] }

  const parts: FirestoreLibraryManifestPart[] = []
  let current: Record<string, string> = {}
  let currentBytes = 2
  let currentCount = 0
  for (const [chunkId, checksum] of Object.entries(checksums)) {
    const entryBytes = manifestEntryBytes(chunkId, checksum)
    const candidateBytes = currentBytes === 2 ? currentBytes + entryBytes : currentBytes + 1 + entryBytes
    if (currentCount > 0 && manifestPartFixedBytes(uid, updatedAt, parts.length) + candidateBytes > MAX_LIBRARY_MANIFEST_BYTES) {
      parts.push(buildV5ManifestPart(uid, updatedAt, parts.length, current))
      current = {}
      currentBytes = 2
      currentCount = 0
    }
    const nextBytes = currentBytes === 2 ? currentBytes + entryBytes : currentBytes + 1 + entryBytes
    if (manifestPartFixedBytes(uid, updatedAt, parts.length) + nextBytes > MAX_LIBRARY_MANIFEST_BYTES)
      throw new CloudSyncError('cloud/data-invalid', 'Cloud library manifest part 單一項目超過大小限制')
    current[chunkId] = checksum
    currentBytes = nextBytes
    currentCount += 1
  }
  if (Object.keys(current).length)
    parts.push(buildV5ManifestPart(uid, updatedAt, parts.length, current))

  const manifestParts = Object.fromEntries(parts.map(part => [part.partId, part.checksum]))
  const manifest: FirestoreLibraryV5Manifest = {
    ownerId: uid,
    schemaVersion: CLOUD_SCHEMA_VERSION,
    documentType: 'library-manifest',
    updatedAt,
    revision: canonicalHash({ manifestParts, updatedAt }),
    chunks: {},
    manifestParts,
  }
  if (estimateJsonBytes(manifest) > MAX_LIBRARY_MANIFEST_BYTES)
    throw new CloudSyncError('cloud/data-invalid', 'Cloud library manifest 分片索引仍然過大')
  return { manifest, parts }
}

export function buildV5LibraryManifest(uid: string, chunks: FirestoreLibraryV5Chunk[], updatedAt: string): FirestoreLibraryV5Manifest {
  return buildV5LibraryManifestDocuments(uid, chunks, updatedAt).manifest
}

export function validateV5LibraryManifest(value: unknown, uid: string): FirestoreLibraryV5Manifest {
  const manifest = validateLibraryManifestShape(value, uid)
  return manifest as FirestoreLibraryV5Manifest
}

export function validateV5LibraryChunk(value: unknown, uid: string, documentId: string): FirestoreLibraryV5Chunk {
  const chunk = validateLibraryChunkShape(value, uid, documentId)
  return chunk as FirestoreLibraryV5Chunk
}

function validateLibraryManifestShape(value: unknown, uid: string): FirestoreLibraryV5Manifest {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new CloudSyncError('cloud/data-invalid', 'Cloud library manifest 格式錯誤')
  const source = value as Record<string, unknown>
  const allowed = ['ownerId', 'schemaVersion', 'documentType', 'updatedAt', 'revision', 'chunks', 'manifestParts']
  const rawChunks = source.chunks
  const rawManifestParts = source.manifestParts
  const hasValidChunks = Boolean(rawChunks && typeof rawChunks === 'object' && !Array.isArray(rawChunks) && Object.entries(rawChunks).every(([chunkId, checksum]) => chunkId !== 'manifest' && typeof checksum === 'string'))
  const hasValidManifestParts = Boolean(rawManifestParts && typeof rawManifestParts === 'object' && !Array.isArray(rawManifestParts) && Object.entries(rawManifestParts).every(([partId, checksum]) => partId.startsWith('manifest-part-') && typeof checksum === 'string'))
  const hasInlineChunks = hasValidChunks && Object.keys(rawChunks as Record<string, unknown>).length > 0
  const hasManifestParts = hasValidManifestParts && Object.keys(rawManifestParts as Record<string, unknown>).length > 0
  if (Object.keys(source).some(key => !allowed.includes(key))
    || source.ownerId !== uid
    || source.schemaVersion !== CLOUD_SCHEMA_VERSION
    || source.documentType !== 'library-manifest'
    || typeof source.updatedAt !== 'string'
    || typeof source.revision !== 'string'
    || !hasValidChunks
    || hasInlineChunks === hasManifestParts) {
    throw new CloudSyncError('cloud/schema-unsupported', 'Cloud library manifest schema 不受支援')
  }
  const manifest = source as unknown as FirestoreLibraryV5Manifest
  const v5Manifest = manifest
  const expectedRevision = v5Manifest.manifestParts && Object.keys(v5Manifest.manifestParts).length
    ? canonicalHash({ manifestParts: v5Manifest.manifestParts, updatedAt: manifest.updatedAt })
    : canonicalHash({ checksums: manifest.chunks, updatedAt: manifest.updatedAt })
  if (expectedRevision !== manifest.revision)
    throw new CloudSyncError('cloud/checksum-mismatch', 'Cloud library manifest checksum 不一致')
  return manifest
}

export function validateV5LibraryManifestPart(value: unknown, uid: string, documentId: string): FirestoreLibraryManifestPart {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new CloudSyncError('cloud/data-invalid', 'Cloud library manifest part 格式錯誤')
  const source = value as Record<string, unknown>
  const chunks = source.chunks
  if (Object.keys(source).some(key => !['ownerId', 'schemaVersion', 'documentType', 'partId', 'updatedAt', 'checksum', 'chunks'].includes(key))
    || source.ownerId !== uid
    || source.schemaVersion !== CLOUD_SCHEMA_VERSION
    || source.documentType !== 'library-manifest-part'
    || source.partId !== documentId
    || !documentId.startsWith('manifest-part-')
    || typeof source.updatedAt !== 'string'
    || typeof source.checksum !== 'string'
    || !chunks
    || typeof chunks !== 'object'
    || Array.isArray(chunks)
    || !Object.entries(chunks).every(([chunkId, checksum]) => chunkId.startsWith('chunk-') && typeof checksum === 'string')) {
    throw new CloudSyncError('cloud/schema-unsupported', 'Cloud library manifest part schema 不受支援')
  }
  const base = {
    ownerId: source.ownerId,
    schemaVersion: source.schemaVersion,
    documentType: source.documentType,
    partId: source.partId,
    updatedAt: source.updatedAt,
    chunks: source.chunks,
  }
  if (canonicalHash(base) !== source.checksum)
    throw new CloudSyncError('cloud/checksum-mismatch', 'Cloud library manifest part checksum 不一致')
  return source as unknown as FirestoreLibraryManifestPart
}

export function validateCloudSyncHead(value: unknown, uid: string): FirestoreSyncHeadDoc {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new CloudSyncError('cloud/data-invalid', 'Cloud sync head 格式錯誤')
  const source = value as Record<string, unknown>
  const allowed = ['ownerId', 'schemaVersion', 'updatedAt', 'libraryRevision', 'progressHash', 'statsHash', 'settingsHash']
  if (Object.keys(source).some(key => !allowed.includes(key))
    || source.ownerId !== uid
    || source.schemaVersion !== CLOUD_SCHEMA_VERSION
    || typeof source.updatedAt !== 'string'
    || !['libraryRevision', 'progressHash', 'statsHash', 'settingsHash'].every(key => typeof source[key] === 'string')) {
    throw new CloudSyncError('cloud/schema-unsupported', 'Cloud sync head schema 不受支援')
  }
  return source as unknown as FirestoreSyncHeadDoc
}

export function validateV5LibraryChunkSet(chunks: FirestoreLibraryV5Chunk[]): void {
  if (!chunks.length)
    throw new CloudSyncError('cloud/data-invalid', 'Cloud library 缺少必要 chunks')
  for (const section of LIBRARY_SECTIONS) {
    const sectionChunks = chunks.filter(chunk => chunk.section === section)
    if (!sectionChunks.length)
      throw new CloudSyncError('cloud/data-invalid', `Cloud library 缺少 ${section} chunk`)
    if (sectionChunks.some(chunk => !chunk.chunkId.startsWith('chunk-')))
      throw new CloudSyncError('cloud/data-invalid', 'Cloud library v5 chunk ID 格式錯誤')
  }
}

export function combineV5LibraryChunks(chunks: FirestoreLibraryV5Chunk[]): LibraryState {
  validateV5LibraryChunkSet(chunks)
  if (new Set(chunks.map(chunk => chunk.updatedAt)).size !== 1)
    throw new CloudSyncError('cloud/data-invalid', 'Cloud library chunks 不屬於同一次提交')
  const words: Record<string, WordEntry> = {}
  const sets: LibrarySet[] = []
  const memberships: Record<string, SetMembership[]> = {}
  const folders: VocabFolder[] = []
  const questions: LibraryState['questions'] = []
  let updatedAt = ''
  for (const chunk of chunks) {
    updatedAt = chunk.updatedAt > updatedAt ? chunk.updatedAt : updatedAt
    if (chunk.section === 'words') {
      for (const word of chunk.items as WordEntry[])
        words[word.wordKey] = word
    }
    else if (chunk.section === 'sets') {
      sets.push(...chunk.items as LibrarySet[])
    }
    else if (chunk.section === 'memberships') {
      for (const entry of chunk.items as { setId: string, members: SetMembership[] }[])
        memberships[entry.setId] = entry.members
    }
    else if (chunk.section === 'folders') {
      folders.push(...chunk.items as VocabFolder[])
    }
    else {
      questions.push(...chunk.items as LibraryState['questions'])
    }
  }
  return { version: 1, words, sets, memberships, folders, questions, updatedAt: updatedAt || new Date().toISOString() }
}

function validateLibraryChunkShape(value: unknown, uid: string, documentId: string): FirestoreLibraryV5Chunk {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new CloudSyncError('cloud/data-invalid', 'Cloud library chunk 格式錯誤')
  const source = value as Record<string, unknown>
  const allowed = ['ownerId', 'schemaVersion', 'chunkId', 'updatedAt', 'checksum', 'section', 'items']
  if (Object.keys(source).some(key => !allowed.includes(key)) || source.ownerId !== uid || source.schemaVersion !== CLOUD_SCHEMA_VERSION || source.chunkId !== documentId || typeof source.chunkId !== 'string' || typeof source.updatedAt !== 'string' || typeof source.checksum !== 'string' || !['words', 'sets', 'memberships', 'folders', 'questions'].includes(String(source.section)) || !Array.isArray(source.items))
    throw new CloudSyncError('cloud/schema-unsupported', 'Cloud library chunk schema 不受支援')
  const base = {
    ownerId: source.ownerId,
    schemaVersion: source.schemaVersion,
    chunkId: source.chunkId,
    updatedAt: source.updatedAt,
    section: source.section,
    items: source.items,
  }
  const integrityBase = { ownerId: base.ownerId, schemaVersion: base.schemaVersion, chunkId: base.chunkId, section: base.section, items: base.items }
  if (canonicalHash(integrityBase) !== source.checksum)
    throw new CloudSyncError('cloud/checksum-mismatch', 'Cloud library chunk checksum 不一致')
  return source as unknown as FirestoreLibraryV5Chunk
}

export function validateCloudEnvelope(value: unknown, uid: string, field: string, payloadKeys: readonly string[] = []): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new CloudSyncError('cloud/data-invalid', `${field} 格式錯誤`)
  const source = value as Record<string, unknown>
  const allowedKeys = new Set(['ownerId', 'schemaVersion', ...payloadKeys])
  if (Object.keys(source).some(key => !allowedKeys.has(key)) || source.ownerId !== uid || source.schemaVersion !== CLOUD_SCHEMA_VERSION)
    throw new CloudSyncError('cloud/schema-unsupported', `${field} schema 不受支援`)
  return source
}

export function cloudChunkHash(value: unknown | null): string {
  if (value === null)
    return ''
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return '#invalid'
  const checksum = (value as Record<string, unknown>).checksum
  return typeof checksum === 'string' ? checksum : '#invalid'
}

export function normalizeCloudProgress(value: unknown, uid: string): LearningProgress {
  const remote = validateCloudEnvelope(value, uid, 'Cloud progress', ['cards', 'updatedAt'])
  return normalizeLearningProgress({ cards: remote.cards, updatedAt: remote.updatedAt })
}

export function normalizeCloudStats(value: unknown, uid: string): DashboardStats {
  const remote = validateCloudEnvelope(value, uid, 'Cloud stats', CLOUD_STATS_PAYLOAD_KEYS)
  const { ownerId: _ownerId, schemaVersion: _schemaVersion, ...statsData } = remote
  return normalizeDashboardStats(statsData)
}

export function normalizeCloudAiSettings(value: unknown, uid: string): Omit<AiSettings, 'apiKey'> {
  const remote = validateCloudEnvelope(value, uid, 'Cloud AI settings', ['enabled', 'provider', 'baseUrl', 'model', 'batchSize', 'updatedAt'])
  const { ownerId: _ownerId, schemaVersion: _schemaVersion, updatedAt: _updatedAt, ...settings } = remote
  return getShareableAiSettings(normalizeAiSettings({ ...settings, apiKey: '' }))
}

export function libraryStateFromRecords(base: LibraryState, records: SyncRecords): LibraryState {
  const words: Record<string, WordEntry> = {}
  const sets: LibrarySet[] = []
  const memberships: Record<string, SetMembership[]> = {}
  const folders: VocabFolder[] = []
  const questions: LibraryState['questions'] = []
  for (const [key, payload] of Object.entries(records)) {
    if (key.startsWith('word:'))
      words[key.slice(5)] = payload as WordEntry
    else if (key.startsWith('set:'))
      sets.push(payload as LibrarySet)
    else if (key.startsWith('membership:'))
      memberships[key.slice(11)] = payload as SetMembership[]
    else if (key.startsWith('folder:'))
      folders.push(payload as VocabFolder)
    else if (key.startsWith('question:'))
      questions.push(payload as LibraryState['questions'][number])
  }
  const liveFolderIds = new Set<string>()
  let addedFolder = true
  while (addedFolder) {
    addedFolder = false
    for (const folder of folders) {
      if (liveFolderIds.has(folder.id) || (folder.parentId && !liveFolderIds.has(folder.parentId)))
        continue
      liveFolderIds.add(folder.id)
      addedFolder = true
    }
  }
  const liveFolders = folders.filter(folder => liveFolderIds.has(folder.id))
  const liveSets = sets.filter(set => liveFolderIds.has(set.folderId))
  const liveSetIds = new Set(liveSets.map(set => set.id))
  const liveMembershipRecords = Object.fromEntries(Object.entries(memberships).filter(([setId]) => liveSetIds.has(setId)))
  const referencedWordKeys = new Set(Object.values(liveMembershipRecords).flatMap(members => members.map(member => normalizeWordKey(member.wordKey))))
  const liveWords = Object.fromEntries(Object.entries(words).filter(([wordKey]) => referencedWordKeys.has(wordKey)))
  const liveMemberships = Object.values(liveMembershipRecords)
  const liveQuestions = questions.filter(question => questionUsesWords(question, liveWords) && questionBelongsToAnyMemberships(question, liveMemberships))
  return { ...base, words: liveWords, sets: liveSets, memberships: liveMembershipRecords, folders: liveFolders, questions: liveQuestions }
}

export function learningStateFromRecords(baseProgress: LearningProgress, baseStats: DashboardStats, records: SyncRecords): { progress: LearningProgress, stats: DashboardStats } {
  const cards: LearningProgress['cards'] = {}
  for (const [key, payload] of Object.entries(records)) {
    if (key.startsWith('card:'))
      cards[key.slice(5)] = payload as LearningProgress['cards'][string]
  }
  return {
    progress: { ...baseProgress, cards },
    stats: (records['stats:summary'] as DashboardStats | undefined) ?? baseStats,
  }
}

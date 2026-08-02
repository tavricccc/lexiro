import type { SyncRecords } from './sync-outbox'
import type { AiSettings, DashboardStats, FirestoreLibraryChunk, LearningProgress, LibrarySet, LibraryState, SetMembership, VocabFolder, WordEntry } from '@/types'
import { CLOUD_SCHEMA_VERSION, CLOUD_STATS_PAYLOAD_KEYS, MAX_LIBRARY_CHUNK_BYTES } from '@/constants/cloud'
import { getShareableAiSettings, normalizeAiSettings } from './ai-provider'
import { CloudSyncError } from './cloud-sync-errors'
import { estimateJsonBytes, stableHash } from './hash'
import { normalizeDashboardStats, normalizeLearningProgress } from './share'

type LibrarySection = FirestoreLibraryChunk['section']

export function buildLibraryChunks(uid: string, library: LibraryState): FirestoreLibraryChunk[] {
  const sections: { section: LibrarySection, items: unknown[] }[] = [
    { section: 'words', items: Object.values(library.words) },
    { section: 'sets', items: library.sets },
    { section: 'memberships', items: Object.entries(library.memberships).map(([setId, members]) => ({ setId, members })) },
    { section: 'folders', items: library.folders },
    { section: 'questions', items: library.questions },
  ]
  const chunks: FirestoreLibraryChunk[] = []
  for (const { section, items } of sections) {
    let current: unknown[] = []
    let sectionIndex = 0
    for (const item of items) {
      const candidate = { ownerId: uid, schemaVersion: CLOUD_SCHEMA_VERSION, chunkId: '', updatedAt: library.updatedAt, checksum: '', section, items: [...current, item] } as FirestoreLibraryChunk
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
  const base = { ownerId: uid, schemaVersion: CLOUD_SCHEMA_VERSION, chunkId: `${section}-${String(index + 1).padStart(3, '0')}`, updatedAt: library.updatedAt, section, items } as FirestoreLibraryChunk
  return { ...base, checksum: stableHash(base) }
}

export function combineLibraryChunks(chunks: FirestoreLibraryChunk[]): LibraryState {
  const words: Record<string, WordEntry> = {}
  const sets: LibrarySet[] = []
  const memberships: Record<string, SetMembership[]> = {}
  const folders: VocabFolder[] = []
  const questions: LibraryState['questions'] = []
  let updatedAt = ''
  for (const chunk of chunks) {
    updatedAt = chunk.updatedAt > updatedAt ? chunk.updatedAt : updatedAt
    if (chunk.section === 'words') {
      for (const word of chunk.items)
        words[word.wordKey] = word
    }
    else if (chunk.section === 'sets') {
      sets.push(...chunk.items)
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
  return { version: 1, words, sets, memberships, folders, questions, updatedAt: updatedAt || new Date().toISOString() }
}

export function validateLibraryChunk(value: unknown, uid: string, documentId: string): FirestoreLibraryChunk {
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
  if (stableHash(base) !== source.checksum)
    throw new CloudSyncError('cloud/checksum-mismatch', 'Cloud library chunk checksum 不一致')
  return source as unknown as FirestoreLibraryChunk
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
  return { ...base, words, sets, memberships, folders, questions }
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

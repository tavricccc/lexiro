import type { FirestoreLibraryChunk, FirestoreLibraryV5Chunk } from '@/types'
import { get, keys, set, setMany } from 'idb-keyval'
import { cloneJson } from './clone'

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

interface RemoteStagingManifest {
  generation: string
  stagedAt?: string
  complete?: boolean
  remoteRevision?: string
  remoteChunkIds?: string[]
}

interface StoredRemoteLibraryChunk {
  schemaVersion: 1
  checksum: string
  chunk: FirestoreLibraryChunk | FirestoreLibraryV5Chunk
}

export class LibraryRepositoryRemoteCache {
  constructor(private readonly prefix: string) {}

  private stagingKey(generation: string): string {
    return `${this.prefix}:${generation}:staging`
  }

  private stagedChunkKey(generation: string, chunkId: string): string {
    return `${this.prefix}:${generation}:remote-chunk:${encodeURIComponent(chunkId)}`
  }

  private syncStateKey(): string {
    return `${this.prefix}:remote-cache:state`
  }

  private cachedChunkKey(chunkId: string): string {
    return `${this.prefix}:remote-cache:chunk:${encodeURIComponent(chunkId)}`
  }

  async findResumableGeneration(): Promise<ResumableRemoteGeneration | null> {
    const candidates: RemoteStagingManifest[] = []
    const keyPrefix = `${this.prefix}:`
    for (const key of await keys()) {
      if (typeof key !== 'string' || !key.startsWith(keyPrefix) || !key.endsWith(':staging'))
        continue
      const generation = key.slice(keyPrefix.length, -':staging'.length)
      if (!generation.startsWith('remote-'))
        continue
      const staging = await get<RemoteStagingManifest>(key)
      if (staging?.generation === generation && staging.remoteRevision && staging.complete !== true)
        candidates.push(staging)
    }
    candidates.sort((left, right) => (right.stagedAt ?? '').localeCompare(left.stagedAt ?? '') || right.generation.localeCompare(left.generation))
    const latest = candidates[0]
    return latest
      ? { generation: latest.generation, revision: latest.remoteRevision!, chunkIds: [...(latest.remoteChunkIds ?? [])] }
      : null
  }

  async loadStagedChunks(generation: string, chunkIds?: string[]): Promise<Map<string, FirestoreLibraryChunk | FirestoreLibraryV5Chunk>> {
    const staging = await get<RemoteStagingManifest>(this.stagingKey(generation))
    const result = new Map<string, FirestoreLibraryChunk | FirestoreLibraryV5Chunk>()
    for (const chunkId of chunkIds ?? staging?.remoteChunkIds ?? []) {
      const chunk = await get<FirestoreLibraryChunk | FirestoreLibraryV5Chunk>(this.stagedChunkKey(generation, chunkId))
      if (chunk)
        result.set(chunkId, cloneJson(chunk))
    }
    return result
  }

  async loadSyncState(): Promise<RemoteLibrarySyncState | null> {
    const value = await get<RemoteLibrarySyncState>(this.syncStateKey())
    if (!value || value.schemaVersion !== 1 || typeof value.revision !== 'string' || typeof value.updatedAt !== 'string' || !value.hashes || typeof value.hashes !== 'object' || Array.isArray(value.hashes) || !Object.values(value.hashes).every(checksum => typeof checksum === 'string'))
      return null
    return cloneJson(value)
  }

  async loadChunks(chunkIds: readonly string[], expectedHashes: ReadonlyMap<string, string> | Record<string, string>): Promise<Map<string, FirestoreLibraryChunk | FirestoreLibraryV5Chunk>> {
    const entries = await Promise.all(chunkIds.map(async (chunkId) => {
      const cached = await get<StoredRemoteLibraryChunk>(this.cachedChunkKey(chunkId))
      const expected = expectedHashes instanceof Map ? expectedHashes.get(chunkId) : (expectedHashes as Record<string, string>)[chunkId]
      if (!cached || cached.schemaVersion !== 1 || !expected || cached.checksum !== expected || cached.chunk.chunkId !== chunkId)
        return null
      return [chunkId, cloneJson(cached.chunk)] as const
    }))
    return new Map(entries.filter((entry): entry is readonly [string, FirestoreLibraryChunk | FirestoreLibraryV5Chunk] => Boolean(entry)))
  }

  async saveChunks(chunks: readonly (FirestoreLibraryChunk | FirestoreLibraryV5Chunk)[]): Promise<void> {
    if (!chunks.length)
      return
    await setMany(chunks.map(chunk => [this.cachedChunkKey(chunk.chunkId), { schemaVersion: 1, checksum: chunk.checksum, chunk: cloneJson(chunk) } satisfies StoredRemoteLibraryChunk]))
  }

  async commitSyncState(state: Omit<RemoteLibrarySyncState, 'schemaVersion'>): Promise<void> {
    const previous = await this.loadSyncState()
    const next: RemoteLibrarySyncState = { schemaVersion: 1, ...cloneJson(state) }
    const staleIds = Object.keys(previous?.hashes ?? {}).filter(chunkId => !Object.hasOwn(next.hashes, chunkId))
    await set(this.syncStateKey(), next)
    await Promise.all(staleIds.map(chunkId => set(this.cachedChunkKey(chunkId), null)))
  }
}

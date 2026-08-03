import type { Firestore } from 'firebase/firestore'
import type { CloudLibraryBatchProgress, CloudLibraryReadResult } from './cloud-sync-remote'
import type { LibraryRemoteStagingBatch, LibraryRepositoryRecord } from './library-repository'
import type { FirestoreLibraryChunk, FirestoreLibraryV5Chunk, LibraryQuestion, LibrarySet, SetMembership, VocabFolder, WordEntry } from '@/types'
import { getLibraryRepository } from './library-repository'
import { normalizeLibraryState } from './share'

function recordsFromChunks(chunks: readonly (FirestoreLibraryChunk | FirestoreLibraryV5Chunk)[]): LibraryRepositoryRecord[] {
  const records: LibraryRepositoryRecord[] = []
  for (const chunk of chunks) {
    if (chunk.section === 'words') {
      for (const word of chunk.items as WordEntry[])
        records.push({ kind: 'word', id: word.wordKey, value: word })
    }
    else if (chunk.section === 'sets') {
      for (const set of chunk.items as LibrarySet[])
        records.push({ kind: 'set', id: set.id, value: set })
    }
    else if (chunk.section === 'memberships') {
      for (const entry of chunk.items as { setId: string, members: SetMembership[] }[])
        records.push({ kind: 'membership', id: entry.setId, value: entry.members })
    }
    else if (chunk.section === 'folders') {
      for (const folder of chunk.items as VocabFolder[])
        records.push({ kind: 'folder', id: folder.id, value: folder })
    }
    else {
      for (const question of chunk.items as LibraryQuestion[])
        records.push({ kind: 'question', id: question.id, value: question })
    }
  }
  return records
}

export async function stageCloudLibrary(options: {
  db: Firestore
  uid: string
  manifestData?: unknown
  onProgress?: (progress: CloudLibraryBatchProgress) => void
}): Promise<CloudLibraryReadResult & { stagingGeneration: string }> {
  const { readCloudLibraryV5 } = await import('./cloud-sync-remote')
  const repository = getLibraryRepository()
  const cachedRemote = await repository.loadRemoteLibrarySyncState()
  const resumable = await repository.findResumableRemoteGeneration()
  let stagingGeneration = resumable?.generation ?? `remote-${Date.now()}-${crypto.randomUUID()}`
  let stagedRevision = resumable?.revision ?? ''
  let stageAllVerifiedChunks = false
  const existingChunks = resumable
    ? await repository.loadStagedRemoteChunks(resumable.generation, resumable.chunkIds)
    : new Map<string, FirestoreLibraryChunk | FirestoreLibraryV5Chunk>()

  const result = await readCloudLibraryV5(
    options.db,
    options.uid,
    options.onProgress,
    async ({ chunks, newChunks, revision }) => {
      if (stagedRevision && stagedRevision !== revision) {
        stagingGeneration = `remote-${Date.now()}-${crypto.randomUUID()}`
        stageAllVerifiedChunks = true
      }
      stagedRevision = revision
      const chunksToStage = stageAllVerifiedChunks ? chunks : newChunks
      await repository.saveRemoteLibraryChunks(newChunks)
      if (!chunksToStage.length)
        return
      const batch: LibraryRemoteStagingBatch = {
        kind: 'remote',
        revision,
        chunks: chunksToStage,
        records: recordsFromChunks(chunksToStage),
      }
      await repository.stageRemoteBatch(stagingGeneration, batch)
    },
    {
      existingChunks,
      manifestData: options.manifestData,
      cachedRevision: cachedRemote?.revision,
      cachedHashes: cachedRemote ? new Map(Object.entries(cachedRemote.hashes)) : undefined,
      loadExistingChunks: (chunkIds, checksums) => repository.loadRemoteLibraryChunks(chunkIds, checksums),
    },
  )

  await repository.stageRemoteBatch(stagingGeneration, normalizeLibraryState(result.library))
  await repository.commitRemoteLibrarySyncState({
    revision: result.revision,
    updatedAt: result.library.updatedAt,
    hashes: Object.fromEntries(result.hashes),
  })
  return { ...result, stagingGeneration }
}

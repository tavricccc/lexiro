import type { FirestoreLibraryV5Chunk, LibraryState } from '@/types'
import { describe, expect, it } from 'vitest'
import { MAX_LIBRARY_CHUNK_BYTES, MAX_LIBRARY_MANIFEST_BYTES } from '@/constants/cloud'
import { buildV5LibraryChunks, buildV5LibraryManifest, buildV5LibraryManifestDocuments, combineV5LibraryChunks, normalizeCloudAiSettings, validateCloudSyncHead, validateV5LibraryChunk, validateV5LibraryManifest, validateV5LibraryManifestPart } from '@/lib/cloud-sync-schema'
import { createUncategorizedFolder } from '@/lib/folders'

const library: LibraryState = {
  version: 1,
  words: {},
  sets: [],
  memberships: {},
  folders: [createUncategorizedFolder()],
  questions: [],
  updatedAt: '2026-08-01T00:00:00.000Z',
}

describe('cloud sync schema', () => {
  it('accepts only exact v5 sync heads', () => {
    const head = {
      ownerId: 'user-1',
      schemaVersion: 5,
      updatedAt: library.updatedAt,
      libraryRevision: 'library-revision',
      progressHash: 'progress-hash',
      statsHash: 'stats-hash',
      settingsHash: 'settings-hash',
    }

    expect(validateCloudSyncHead(head, 'user-1')).toEqual(head)
    expect(() => validateCloudSyncHead({ ...head, schemaVersion: 4 }, 'user-1')).toThrow('schema')
    expect(() => validateCloudSyncHead({ ...head, unexpected: true }, 'user-1')).toThrow('schema')
  })

  it('round-trips the canonical library through empty-section chunks', () => {
    const chunks = buildV5LibraryChunks('user-1', library)

    expect(chunks.map(chunk => chunk.section)).toEqual(['words', 'sets', 'memberships', 'folders', 'questions'])
    expect(chunks.every(chunk => chunk.schemaVersion === 5)).toBe(true)
    expect(combineV5LibraryChunks(chunks, library.updatedAt)).toEqual(library)
  })

  it('validates chunk ownership and checksums before combining', () => {
    const chunk = buildV5LibraryChunks('user-1', library)[0]

    expect(validateV5LibraryChunk(chunk, 'user-1', chunk.chunkId)).toEqual(chunk)
    expect(() => validateV5LibraryChunk(chunk, 'other-user', chunk.chunkId)).toThrow('schema')
    expect(() => validateV5LibraryChunk({ ...chunk, checksum: 'tampered' }, 'user-1', chunk.chunkId)).toThrow('checksum')
  })

  it('binds the complete chunk checksum map to a manifest revision', () => {
    const chunks = buildV5LibraryChunks('user-1', library)
    const manifest = buildV5LibraryManifest('user-1', chunks, library.updatedAt)

    expect(validateV5LibraryManifest(manifest, 'user-1')).toEqual(manifest)
    const firstChunkId = Object.keys(manifest.chunks)[0]
    expect(() => validateV5LibraryManifest({ ...manifest, chunks: { ...manifest.chunks, [firstChunkId]: 'tampered' } }, 'user-1')).toThrow('checksum')
  })

  it('splits an oversized v5 manifest into independently validated parts', () => {
    const chunks = Array.from({ length: 8_000 }, (_, index) => ({
      chunkId: `chunk-${index.toString(16).padStart(8, '0')}`,
      checksum: 'a'.repeat(64),
    } as FirestoreLibraryV5Chunk))
    const documents = buildV5LibraryManifestDocuments('user-1', chunks, library.updatedAt)

    expect(documents.parts.length).toBeGreaterThan(1)
    expect(documents.manifest.chunks).toEqual({})
    expect(Object.keys(documents.manifest.manifestParts ?? {})).toHaveLength(documents.parts.length)
    expect(JSON.stringify(documents.manifest).length).toBeLessThan(MAX_LIBRARY_MANIFEST_BYTES)
    expect(validateV5LibraryManifest(documents.manifest, 'user-1')).toEqual(documents.manifest)
    for (const part of documents.parts)
      expect(validateV5LibraryManifestPart(part, 'user-1', part.partId)).toEqual(part)
  })

  it('keeps unchanged v5 content reusable when the library timestamp advances', () => {
    const first = buildV5LibraryChunks('user-1', library)
    const newer = buildV5LibraryChunks('user-1', { ...library, updatedAt: '2026-08-02T00:00:00.000Z' })

    expect(first.map(chunk => chunk.chunkId)).toEqual(newer.map(chunk => chunk.chunkId))
    expect(first.map(chunk => chunk.checksum)).toEqual(newer.map(chunk => chunk.checksum))
    expect(first.map(chunk => chunk.updatedAt)).not.toEqual(newer.map(chunk => chunk.updatedAt))
  })

  it('accepts Firestore-reordered nested map keys with the original checksum', () => {
    const populated: LibraryState = {
      ...library,
      sets: [{ id: 'set-1', setName: 'Fresh set', folderId: '__uncategorized__', createdAt: library.updatedAt, updatedAt: library.updatedAt }],
      memberships: { 'set-1': [{ wordKey: 'apple', senseIds: ['sense-1'] }] },
    }
    const chunk = buildV5LibraryChunks('user-1', populated).find(item => item.section === 'sets')!
    const set = chunk.items[0] as LibraryState['sets'][number]
    const reordered = {
      updatedAt: set.updatedAt,
      setName: set.setName,
      id: set.id,
      folderId: set.folderId,
      createdAt: set.createdAt,
    }

    expect(validateV5LibraryChunk({ ...chunk, items: [reordered] }, 'user-1', chunk.chunkId)).toEqual({ ...chunk, items: [reordered] })
  })

  it('rejects incomplete and mixed-commit chunk collections', () => {
    const chunks = buildV5LibraryChunks('user-1', library)

    expect(() => combineV5LibraryChunks(chunks.filter(chunk => chunk.section !== 'memberships'), library.updatedAt)).toThrow('缺少 memberships')
    expect(combineV5LibraryChunks(
      chunks.map((chunk, index) => index === 0 ? { ...chunk, updatedAt: 'earlier-chunk-build' } : chunk),
      '2026-08-03T00:00:00.000Z',
    ).updatedAt).toBe('2026-08-03T00:00:00.000Z')
  })

  it('writes memberships to Firestore as set records containing member arrays', () => {
    const populated: LibraryState = {
      ...library,
      sets: [{ id: 'set-1', setName: 'Fresh set', folderId: 'folder-uncategorized', createdAt: library.updatedAt, updatedAt: library.updatedAt }],
      memberships: { 'set-1': [{ wordKey: 'apple', senseIds: ['sense-1'] }] },
    }

    const chunks = buildV5LibraryChunks('user-1', populated)
    const membershipChunk = chunks.find(chunk => chunk.section === 'memberships')

    expect(membershipChunk?.items).toEqual([{
      setId: 'set-1',
      members: [{ wordKey: 'apple', senseIds: ['sense-1'] }],
    }])
    expect(combineV5LibraryChunks(chunks, populated.updatedAt)).toEqual(populated)
  })

  it('rejects an individual record that cannot fit in a Cloud chunk', () => {
    const oversized: LibraryState = {
      ...library,
      words: {
        huge: {
          wordKey: 'huge',
          word: 'huge',
          senses: [{ id: 'sense-1', pos: 'n.', meaningZh: '大', examples: ['x'.repeat(MAX_LIBRARY_CHUNK_BYTES)] }],
          updatedAt: library.updatedAt,
        },
      },
    }

    expect(() => buildV5LibraryChunks('user-1', oversized)).toThrow('單筆資料超過大小限制')
  })

  it('normalizes Cloud AI settings without accepting a device key', () => {
    expect(normalizeCloudAiSettings({
      ownerId: 'user-1',
      schemaVersion: 5,
      enabled: true,
      provider: 'openai',
      baseUrl: '',
      model: 'gpt-4o-mini',
      batchSize: 10,
      updatedAt: '2026-08-01T00:00:00.000Z',
    }, 'user-1')).toEqual({
      enabled: true,
      provider: 'openai',
      baseUrl: '',
      model: 'gpt-4o-mini',
      batchSize: 10,
    })
  })
})

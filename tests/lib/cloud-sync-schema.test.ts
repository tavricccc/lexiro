import type { LibraryState } from '@/types'
import { describe, expect, it } from 'vitest'
import { MAX_LIBRARY_CHUNK_BYTES } from '@/constants/cloud'
import { buildLibraryChunks, combineLibraryChunks, normalizeCloudAiSettings, validateLibraryChunk } from '@/lib/cloud-sync-schema'
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
  it('round-trips the canonical library through empty-section chunks', () => {
    const chunks = buildLibraryChunks('user-1', library)

    expect(chunks.map(chunk => chunk.chunkId)).toEqual([
      'words-001',
      'sets-001',
      'memberships-001',
      'folders-001',
      'questions-001',
    ])
    expect(chunks.every(chunk => chunk.schemaVersion === 3)).toBe(true)
    expect(combineLibraryChunks(chunks)).toEqual(library)
  })

  it('validates chunk ownership and checksums before combining', () => {
    const chunk = buildLibraryChunks('user-1', library)[0]

    expect(validateLibraryChunk(chunk, 'user-1', chunk.chunkId)).toEqual(chunk)
    expect(() => validateLibraryChunk(chunk, 'other-user', chunk.chunkId)).toThrow('schema')
    expect(() => validateLibraryChunk({ ...chunk, checksum: 'tampered' }, 'user-1', chunk.chunkId)).toThrow('checksum')
  })

  it('writes memberships to Firestore as set records containing member arrays', () => {
    const populated: LibraryState = {
      ...library,
      sets: [{ id: 'set-1', setName: 'Fresh set', folderId: 'folder-uncategorized', createdAt: library.updatedAt, updatedAt: library.updatedAt }],
      memberships: { 'set-1': [{ wordKey: 'apple', senseIds: ['sense-1'] }] },
    }

    const chunks = buildLibraryChunks('user-1', populated)
    const membershipChunk = chunks.find(chunk => chunk.section === 'memberships')

    expect(membershipChunk?.items).toEqual([{
      setId: 'set-1',
      members: [{ wordKey: 'apple', senseIds: ['sense-1'] }],
    }])
    expect(combineLibraryChunks(chunks)).toEqual(populated)
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

    expect(() => buildLibraryChunks('user-1', oversized)).toThrow('單筆資料超過大小限制')
  })

  it('normalizes Cloud AI settings without accepting a device key', () => {
    expect(normalizeCloudAiSettings({
      ownerId: 'user-1',
      schemaVersion: 3,
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

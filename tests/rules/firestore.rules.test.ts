import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { defaultAiSettings, getShareableAiSettings } from '@/lib/ai-provider'
import { parseCloudLibrarySnapshot } from '@/lib/cloud-sync-remote'
import { buildLibraryChunks, buildLibraryManifest, validateLibraryChunk, validateLibraryManifest } from '@/lib/cloud-sync-schema'
import { prepareFirestoreData } from '@/lib/firestore-data'
import { createDefaultStats } from '@/lib/learning-defaults'

const rulesEnabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST)
const rulesDescribe = rulesEnabled ? describe : describe.skip

rulesDescribe('Firestore security rules', () => {
  let testEnv: RulesTestEnvironment

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-lexiro',
      firestore: {
        rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
      },
    })
  })

  afterAll(async () => {
    await testEnv?.cleanup()
  })

  it('rejects unauthenticated reads', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(db.doc('users/alice/library/sets-001').get())
  })

  it('isolates users and protects ownerId on canonical library chunks', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore()
    const bob = testEnv.authenticatedContext('bob').firestore()
    const payload = {
      ownerId: 'alice',
      schemaVersion: 4,
      chunkId: 'sets-001',
      section: 'sets',
      items: [{ id: 'set-1', setName: 'Basics', folderId: 'folder-1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
      checksum: 'abc123',
      updatedAt: new Date().toISOString(),
    }

    await assertSucceeds(alice.doc('users/alice/library/sets-001').set(payload))
    await assertFails(bob.doc('users/alice/library/sets-001').get())
    await assertFails(alice.doc('users/alice/library/sets-001').update({ ownerId: 'bob' }))
  })

  it('rejects unknown fields on canonical library chunks', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore()
    await assertFails(alice.doc('users/alice/library/sets-002').set({ ownerId: 'alice', schemaVersion: 4, chunkId: 'sets-002', section: 'sets', items: [], unexpected: true }))
  })

  it('allows the v3 library chunks and keeps them isolated', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore()
    const bob = testEnv.authenticatedContext('bob').firestore()
    const payload = {
      ownerId: 'alice',
      schemaVersion: 4,
      chunkId: 'words-001',
      updatedAt: new Date().toISOString(),
      checksum: 'abc123',
      section: 'words',
      items: [],
    }

    await assertSucceeds(alice.doc('users/alice/library/words-001').set(payload))
    await assertFails(bob.doc('users/alice/library/words-001').get())
    await assertFails(alice.doc('users/alice/library/words-001').update({ schemaVersion: 2 }))
  })

  it('accepts every production chunk for a newly created local set', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore()
    const timestamp = '2026-08-02T00:00:00.000Z'
    const chunks = buildLibraryChunks('alice', {
      version: 1,
      words: {
        apple: { wordKey: 'apple', word: 'apple', senses: [{ id: 'sense-1', pos: 'n.', meaningZh: '蘋果', examples: [] }], updatedAt: timestamp },
      },
      sets: [{ id: 'set-1', setName: 'Fresh set', folderId: '__uncategorized__', createdAt: timestamp, updatedAt: timestamp }],
      memberships: { 'set-1': [{ wordKey: 'apple', senseIds: ['sense-1'] }] },
      folders: [{ id: '__uncategorized__', name: '未分類', parentId: undefined, order: -1, createdAt: timestamp, updatedAt: timestamp }],
      questions: [],
      updatedAt: timestamp,
    })

    const manifest = buildLibraryManifest('alice', chunks, timestamp)
    await assertSucceeds(alice.runTransaction(async (transaction) => {
      for (const chunk of chunks)
        transaction.set(alice.doc(`users/alice/library/${chunk.chunkId}`), prepareFirestoreData(chunk))
      transaction.set(alice.doc('users/alice/library/manifest'), manifest)
    }))

    for (const chunk of chunks) {
      const reference = alice.doc(`users/alice/library/${chunk.chunkId}`)
      const snapshot = await assertSucceeds(reference.get())
      validateLibraryChunk(snapshot.data(), 'alice', chunk.chunkId)
    }
    const manifestReference = alice.doc('users/alice/library/manifest')
    const manifestSnapshot = await assertSucceeds(manifestReference.get())
    validateLibraryManifest(manifestSnapshot.data(), 'alice')
    const collectionSnapshot = await assertSucceeds(alice.collection('users/alice/library').get())
    const parsed = parseCloudLibrarySnapshot(collectionSnapshot as never, 'alice')
    if (parsed.library.folders[0].parentId !== undefined)
      throw new Error('根資料夾不應包含 parentId')
  })

  it('accepts production progress, stats, and shareable AI settings envelopes', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore()
    const timestamp = '2026-08-02T00:00:00.000Z'
    await assertSucceeds(alice.doc('users/alice/progress/global').set({
      cards: {},
      updatedAt: timestamp,
      ownerId: 'alice',
      schemaVersion: 4,
    }))
    await assertSucceeds(alice.doc('users/alice/stats/summary').set({
      ...createDefaultStats(),
      updatedAt: timestamp,
      ownerId: 'alice',
      schemaVersion: 4,
    }))
    await assertSucceeds(alice.doc('users/alice/settings/ai').set({
      ...getShareableAiSettings(defaultAiSettings),
      updatedAt: timestamp,
      ownerId: 'alice',
      schemaVersion: 4,
    }))
  })
})

import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { afterAll, beforeAll, describe, it } from 'vitest'

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
      schemaVersion: 3,
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
    await assertFails(alice.doc('users/alice/library/sets-002').set({ ownerId: 'alice', schemaVersion: 3, chunkId: 'sets-002', section: 'sets', items: [], unexpected: true }))
  })

  it('allows the v3 library chunks and keeps them isolated', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore()
    const bob = testEnv.authenticatedContext('bob').firestore()
    const payload = {
      ownerId: 'alice',
      schemaVersion: 3,
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
})

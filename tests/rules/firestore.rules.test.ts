import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

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
    await assertFails(db.doc('users/alice/sets/set-1').get())
  })

  it('isolates users and protects ownerId', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore()
    const bob = testEnv.authenticatedContext('bob').firestore()
    const payload = {
      id: 'set-1',
      setName: 'Basics',
      difficulty: 1,
      items: [{ word: 'hello', meaning: '你好', pos: 'interjection', example: 'Hello!' }],
      ownerId: 'alice',
      schemaVersion: 2,
      checksum: 'abc123',
      updatedAt: new Date().toISOString(),
    }

    await assertSucceeds(alice.doc('users/alice/sets/set-1').set(payload))
    await assertFails(bob.doc('users/alice/sets/set-1').get())
    await assertFails(alice.doc('users/alice/sets/set-1').update({ ownerId: 'bob' }))
  })

  it('rejects unknown fields and oversized set item lists', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore()
    const base = {
      id: 'set-2',
      setName: 'Basics',
      difficulty: 1,
      ownerId: 'alice',
      schemaVersion: 2,
      checksum: 'abc123',
      updatedAt: new Date().toISOString(),
    }
    await assertFails(alice.doc('users/alice/sets/set-2').set({
      ...base,
      items: [{ word: 'hello', meaning: '你好', pos: 'interjection', example: 'Hello!' }],
      unexpected: true,
    }))
    await assertFails(alice.doc('users/alice/sets/set-3').set({
      ...base,
      id: 'set-3',
      items: Array.from({ length: 501 }, (_, index) => ({ word: `word-${index}`, meaning: '意思', pos: 'noun', example: 'Example' })),
    }))
    expect(true).toBe(true)
  })

  it('allows the v2 library chunks and keeps them isolated', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore()
    const bob = testEnv.authenticatedContext('bob').firestore()
    const payload = {
      ownerId: 'alice',
      schemaVersion: 2,
      chunkId: 'words-001',
      updatedAt: new Date().toISOString(),
      checksum: 'abc123',
      section: 'words',
      items: [],
    }

    await assertSucceeds(alice.doc('users/alice/library/words-001').set(payload))
    await assertFails(bob.doc('users/alice/library/words-001').get())
    await assertFails(alice.doc('users/alice/library/words-001').update({ schemaVersion: 1 }))
  })
})

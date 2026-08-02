import { afterEach, describe, expect, it } from 'vitest'
import { loadCloudOutbox, saveCloudOutbox } from '@/lib/cloud-sync-outbox-storage'
import { saveToStorage, setStorageNamespace } from '@/lib/persist'

const validEntry = {
  id: 'sync-1',
  domain: 'library' as const,
  recordKey: 'word:apple',
  baseHash: 'base-hash',
  payload: { wordKey: 'apple' },
  attempts: 0,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
}

describe('cloud sync outbox storage', () => {
  afterEach(() => {
    setStorageNamespace('guest')
  })

  it('round-trips a canonical pending entry', async () => {
    await saveCloudOutbox('outbox-test-user', [validEntry])

    await expect(loadCloudOutbox('outbox-test-user')).resolves.toEqual([validEntry])
  })

  it('round-trips the membership array produced when a set is created', async () => {
    const membershipEntry = {
      ...validEntry,
      id: 'sync-membership',
      recordKey: 'membership:set-1',
      payload: [{ wordKey: 'apple', senseIds: ['sense-1'] }],
    }
    await saveCloudOutbox('outbox-membership-user', [membershipEntry])

    await expect(loadCloudOutbox('outbox-membership-user')).resolves.toEqual([membershipEntry])
  })

  it('rejects malformed JSON instead of replacing the queue with an empty one', async () => {
    await saveToStorage('lexiro_sync_outbox:outbox-invalid-json', '{')

    await expect(loadCloudOutbox('outbox-invalid-json')).rejects.toThrow('Cloud sync outbox 格式錯誤')
  })

  it('rejects malformed entries instead of silently dropping them', async () => {
    await saveToStorage('lexiro_sync_outbox:outbox-invalid-entry', [{ ...validEntry, attempts: -1 }])

    await expect(loadCloudOutbox('outbox-invalid-entry')).rejects.toThrow('Cloud sync outbox 格式錯誤')
  })

  it('refuses to save an entry that the loader would reject', async () => {
    const invalidEntry = { ...validEntry, recordKey: 'word:apple', payload: [] }

    await expect(saveCloudOutbox('outbox-invalid-write', [invalidEntry])).rejects.toThrow('拒絕保存')
  })
})

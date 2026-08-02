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

  it('rejects malformed JSON instead of replacing the queue with an empty one', async () => {
    await saveToStorage('lexiro_sync_outbox:outbox-invalid-json', '{')

    await expect(loadCloudOutbox('outbox-invalid-json')).rejects.toThrow('Cloud sync outbox 格式錯誤')
  })

  it('rejects malformed entries instead of silently dropping them', async () => {
    await saveToStorage('lexiro_sync_outbox:outbox-invalid-entry', [{ ...validEntry, attempts: -1 }])

    await expect(loadCloudOutbox('outbox-invalid-entry')).rejects.toThrow('Cloud sync outbox 格式錯誤')
  })
})

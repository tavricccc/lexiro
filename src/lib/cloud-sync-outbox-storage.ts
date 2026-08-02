import type { SyncOutboxEntry } from './sync-outbox'
import { SYNC_OUTBOX_STORAGE_KEY } from '@/constants'
import { CloudSyncError } from './cloud-sync-errors'
import { loadFromStorage, saveToStorage } from './persist'
import { isSyncOutboxEntry } from './sync-outbox'

export function cloudOutboxStorageKey(uid: string): string {
  return `${SYNC_OUTBOX_STORAGE_KEY}:${uid || 'guest'}`
}

export async function loadCloudOutbox(uid: string): Promise<SyncOutboxEntry[]> {
  const stored = await loadFromStorage(cloudOutboxStorageKey(uid))
  if (!stored.value)
    return []
  let parsed: unknown
  try {
    parsed = JSON.parse(stored.value)
  }
  catch {
    throw new CloudSyncError('cloud/outbox-invalid', 'Cloud sync outbox 格式錯誤')
  }
  if (!Array.isArray(parsed) || !parsed.every(isSyncOutboxEntry))
    throw new CloudSyncError('cloud/outbox-invalid', 'Cloud sync outbox 格式錯誤')
  return parsed
}

export async function saveCloudOutbox(uid: string, entries: SyncOutboxEntry[]): Promise<void> {
  if (!entries.every(isSyncOutboxEntry))
    throw new CloudSyncError('cloud/outbox-invalid', '拒絕保存無法重新載入的 Cloud sync outbox')
  await saveToStorage(cloudOutboxStorageKey(uid), entries)
}

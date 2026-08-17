import { CLOUD_SYNC_PENDING_EVENT, CLOUD_SYNC_PENDING_STORAGE_KEY } from '@/constants'

export function hasCloudSyncPending(): boolean {
  if (typeof localStorage === 'undefined')
    return false
  try {
    return Boolean(localStorage.getItem(CLOUD_SYNC_PENDING_STORAGE_KEY))
  }
  catch {
    return false
  }
}

export function markCloudSyncPending(): void {
  if (typeof window === 'undefined')
    return
  try {
    localStorage.setItem(CLOUD_SYNC_PENDING_STORAGE_KEY, '1')
  }
  catch {
    // IndexedDB remains authoritative when localStorage is unavailable.
  }
  window.dispatchEvent(new Event(CLOUD_SYNC_PENDING_EVENT))
}

export function clearCloudSyncPending(): void {
  if (typeof localStorage === 'undefined')
    return
  try {
    localStorage.removeItem(CLOUD_SYNC_PENDING_STORAGE_KEY)
  }
  catch {
    // Sync succeeded; a blocked localStorage marker must not report failure.
  }
}

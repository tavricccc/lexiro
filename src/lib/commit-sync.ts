import { useCloudSyncStore } from '@/stores/cloudSync'
import { useUIStore } from '@/stores/ui'
import { i18n } from './i18n'

/**
 * Business forms commit locally first. A cloud failure must not roll back the
 * local transaction; the outbox and pending indicator keep the change queued
 * for the next explicit sync attempt.
 */
export async function syncAfterLocalCommit(): Promise<boolean> {
  const cloudStore = useCloudSyncStore()
  const synced = await cloudStore.syncCommittedChange()
  if (cloudStore.status === 'offline' || (!synced && cloudStore.status !== 'error'))
    useUIStore().showToast(i18n.global.t('sync.savedLocally'))
  return synced
}

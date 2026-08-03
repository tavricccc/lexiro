import { useCloudSyncStore } from '@/stores/cloudSync'
import { useUIStore } from '@/stores/ui'
import { i18n } from './i18n'

/**
 * Business forms commit locally first so a failed network request cannot lose
 * the edit. While online, the caller remains blocked until the ordered cloud
 * write succeeds; the outbox is only the recovery path for offline or failed
 * requests.
 */
export async function syncAfterLocalCommit(): Promise<boolean> {
  const cloudStore = useCloudSyncStore()
  const synced = await cloudStore.syncCommittedChange()
  if (cloudStore.status === 'offline' || (!synced && cloudStore.status !== 'error'))
    useUIStore().showToast(i18n.global.t('sync.savedLocally'))
  return synced
}

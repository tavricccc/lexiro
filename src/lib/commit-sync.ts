import type { SyncAfterLocalCommitResult } from '@/types'
import { useCloudSyncStore } from '@/stores/cloudSync'
import { useUIStore } from '@/stores/ui'
import { i18n } from './i18n'

/**
 * Business forms commit locally first so a failed network request cannot lose
 * the edit. The caller completes once local persistence and the durable outbox
 * are safe; Cloud delivery continues in the background.
 */
export async function syncAfterLocalCommit(): Promise<SyncAfterLocalCommitResult> {
  const cloudStore = useCloudSyncStore()
  const result = await cloudStore.syncCommittedChange()
  if (result.status === 'queued')
    useUIStore().showToast(i18n.global.t('sync.savedLocally'))
  return result
}

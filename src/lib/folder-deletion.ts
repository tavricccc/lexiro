import type { VocabFolder } from '@/types'
import { i18n } from '@/lib/i18n'
import { useLibraryStore } from '@/stores/library'
import { useSessionStore } from '@/stores/session'
import { useUIStore } from '@/stores/ui'

const t = i18n.global.t

/** Confirm and remove a complete folder subtree, including its set content. */
export async function confirmAndRemoveFolder(folder: VocabFolder): Promise<boolean> {
  const libraryStore = useLibraryStore()
  const sessionStore = useSessionStore()
  const uiStore = useUIStore()
  const folderIds = libraryStore.getFolderTreeIds(folder.id)
  const setIds = libraryStore.sets.filter(set => folderIds.has(set.folderId)).map(set => set.id)
  const wordCount = setIds.reduce((total, setId) => total + libraryStore.getSetStudyWords(setId).length, 0)
  const confirmed = await uiStore.showConfirm(
    t('library.folderDeleteTitle'),
    t('library.folderDeleteMessage', { folder: folder.name, folders: folderIds.size, sets: setIds.length, words: wordCount }),
  )
  if (!confirmed)
    return false

  for (const setId of setIds)
    sessionStore.clearSessionsForSet(setId)
  const removed = libraryStore.removeFolder(folder.id)
  if (!removed.size) {
    uiStore.showToast(t('library.folderUpdateFailed'))
    return false
  }
  uiStore.showToast(t('library.folderDeleted', { folder: folder.name }))
  return true
}

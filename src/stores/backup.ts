import type { FullBackupPayload, LibraryQuestion, LibraryState, SharedSet, VocabFolder, WordEntry } from '@/types'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { loadAiSettings, saveAiSettings, waitForAiSettingsPersistence } from '@/lib/ai-provider'
import { buildExportFileName, buildFullBackupZipBlob, downloadBlob, getBackupPreviewData, getFullBackupMergePreviewData, getFullBackupPreviewData, parseBackupZipBuffer } from '@/lib/file'
import { createUncategorizedFolder, folderIdFromSelection, UNCATEGORIZED_FOLDER_ID } from '@/lib/folders'
import { i18n } from '@/lib/i18n'
import { mergeWord, normalizeWordKey } from '@/lib/library'
import { getLibraryRepository } from '@/lib/library-repository'
import { normalizeLibraryState } from '@/lib/share'
import { useLearningStore } from './learning'
import { useLibraryStore } from './library'
import { useSetsStore } from './sets'
import { useUIStore } from './ui'

const t = i18n.global.t

function sharedSetsToLibraryState(targetSets: SharedSet[], folderSelection: string | undefined, availableFolders: VocabFolder[]): LibraryState {
  const words: Record<string, WordEntry> = {}
  const folders = availableFolders.length ? availableFolders : [createUncategorizedFolder()]
  const folderIds = new Set(folders.map(folder => folder.id))
  const importedIds = targetSets.map(() => `set-import-${crypto.randomUUID()}`)
  const sets = targetSets.map(({ words: _words, memberships: _memberships, questions: _questions, ...set }, index) => ({
    ...set,
    id: importedIds[index],
    folderId: folderIds.has(folderSelection || set.folderId) ? folderSelection || set.folderId : UNCATEGORIZED_FOLDER_ID,
  }))
  const memberships = Object.fromEntries(targetSets.map((set, index) => [importedIds[index], set.memberships.map(member => ({ wordKey: normalizeWordKey(member.wordKey), senseIds: [...member.senseIds] }))]))
  const questionsById = new Map<string, LibraryQuestion>()
  const questionFingerprints = new Set<string>()
  for (const question of targetSets.flatMap(set => set.questions)) {
    if (questionsById.has(question.id) || questionFingerprints.has(question.fingerprint))
      continue
    questionsById.set(question.id, question)
    questionFingerprints.add(question.fingerprint)
  }
  for (const set of targetSets) {
    for (const word of set.words) {
      const wordKey = normalizeWordKey(word.wordKey)
      words[wordKey] = mergeWord(words[wordKey], { ...word, wordKey })
    }
  }
  return normalizeLibraryState({
    version: 1,
    words,
    sets,
    memberships,
    folders,
    questions: Array.from(questionsById.values()),
    updatedAt: new Date().toISOString(),
  })
}

export const useBackupStore = defineStore('backup', () => {
  const zipImportError = ref('')
  const zipImportPreview = ref('')
  const zipImportSets = ref<SharedSet[] | null>(null)
  const zipImportFullBackup = ref<FullBackupPayload | null>(null)
  const zipImportFullPreview = ref<ReturnType<typeof getFullBackupMergePreviewData> | null>(null)
  const zipImportKind = ref<'' | 'set-share' | 'full-backup'>('')
  const zipImportName = ref('')
  const zipImportInputKey = ref(0)

  function resetZipImportState(resetInput = true) {
    zipImportError.value = ''
    zipImportPreview.value = ''
    zipImportSets.value = null
    zipImportFullBackup.value = null
    zipImportFullPreview.value = null
    zipImportKind.value = ''
    zipImportName.value = ''
    if (resetInput)
      zipImportInputKey.value += 1
  }

  async function handleZipImportChange(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    resetZipImportState(false)
    if (!file)
      return

    zipImportName.value = file.name
    try {
      const parsed = await parseBackupZipBuffer(await file.arrayBuffer())
      zipImportKind.value = parsed.kind
      zipImportSets.value = parsed.sets
      zipImportFullBackup.value = parsed.fullBackup
      if (parsed.fullBackup) {
        await useLibraryStore().waitForPersistence()
        const library = await getLibraryRepository().loadState()
        const learningStore = useLearningStore()
        await learningStore.waitForPersistence()
        zipImportFullPreview.value = getFullBackupMergePreviewData(parsed.fullBackup, library, learningStore.progress, learningStore.stats)
      }
      zipImportPreview.value = parsed.kind === 'full-backup' && parsed.fullBackup
        ? (() => {
            const preview = getFullBackupPreviewData(parsed.fullBackup)
            return t('backup.fullImportPreview', preview)
          })()
        : (() => {
            const preview = getBackupPreviewData(parsed.sets, parsed.exportedAt)
            return t('backup.shareImportPreview', {
              ...preview,
              time: preview.exportedAt ? new Date(preview.exportedAt).toLocaleString() : t('backup.previewTimeUnavailable'),
            })
          })()
    }
    catch {
      zipImportError.value = t('backup.importZipFailed')
    }
  }

  async function applyZipImport(folderSelection?: string): Promise<boolean> {
    const setsStore = useSetsStore()
    const uiStore = useUIStore()
    zipImportError.value = ''
    try {
      if (zipImportKind.value === 'set-share') {
        if (!zipImportSets.value?.length) {
          zipImportError.value = t('backup.zipImportError')
          return false
        }
        const libraryStore = useLibraryStore()
        const imported = sharedSetsToLibraryState(zipImportSets.value, folderIdFromSelection(folderSelection ?? uiStore.transferFolderId), libraryStore.folders)
        const result = await libraryStore.mergeImportedStateFromRepository(imported)
        if (!result.addedSets)
          return false
        uiStore.showToast(t('backup.importSuccess', { count: result.addedSets }))
      }
      else if (zipImportKind.value === 'full-backup' && zipImportFullBackup.value) {
        const libraryStore = useLibraryStore()
        const learningStore = useLearningStore()
        await libraryStore.mergeImportedStateFromRepository(zipImportFullBackup.value.library)
        learningStore.mergeImportedState(zipImportFullBackup.value.learning, zipImportFullBackup.value.stats)
        const currentAiSettings = loadAiSettings()
        saveAiSettings({ ...zipImportFullBackup.value.aiSettings, apiKey: currentAiSettings.apiKey })
        useUIStore().showToast(t('backup.fullImportSuccess'))
      }
      else {
        zipImportError.value = t('backup.zipImportError')
        return false
      }
    }
    catch {
      zipImportError.value = t('backup.importZipFailed')
      return false
    }
    setsStore.exportSelectedIds = setsStore.sets.map(set => set.id)
    return true
  }

  async function exportAllToZip() {
    const uiStore = useUIStore()
    const setsStore = useSetsStore()
    await setsStore.exportSelectedSetsToZip()
    if (setsStore.exportError)
      uiStore.showToast(t('backup.noSetsToExport'))
  }

  async function exportFullBackup() {
    const libraryStore = useLibraryStore()
    const learningStore = useLearningStore()
    await libraryStore.waitForPersistence()
    await learningStore.waitForPersistence()
    await waitForAiSettingsPersistence()
    const currentLibrary = await getLibraryRepository().loadState()
    const blob = await buildFullBackupZipBlob(currentLibrary, learningStore.progress, learningStore.stats)
    downloadBlob(blob, buildExportFileName('full'))
    useUIStore().showToast(t('backup.fullExported'))
  }

  return {
    zipImportError,
    zipImportPreview,
    zipImportSets,
    zipImportFullBackup,
    zipImportFullPreview,
    zipImportKind,
    zipImportName,
    zipImportInputKey,
    resetZipImportState,
    handleZipImportChange,
    applyZipImport,
    exportAllToZip,
    exportFullBackup,
  }
})

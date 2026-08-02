import type { FullBackupPayload, SharedSet } from '@/types'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { loadAiSettings, saveAiSettings } from '@/lib/ai-provider'
import { buildExportFileName, buildExportZipBlob, buildFullBackupZipBlob, downloadBlob, getBackupPreviewData, getFullBackupMergePreviewData, getFullBackupPreviewData, parseBackupZipBuffer } from '@/lib/file'
import { folderIdFromSelection } from '@/lib/folders'
import { i18n } from '@/lib/i18n'
import { useLearningStore } from './learning'
import { useLibraryStore } from './library'
import { useSetsStore } from './sets'
import { useUIStore } from './ui'

const t = i18n.global.t

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
        const libraryStore = useLibraryStore()
        const learningStore = useLearningStore()
        zipImportFullPreview.value = getFullBackupMergePreviewData(parsed.fullBackup, libraryStore.state, learningStore.progress, learningStore.stats)
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

  function applyZipImport(): boolean {
    const setsStore = useSetsStore()
    const uiStore = useUIStore()
    zipImportError.value = ''
    if (zipImportKind.value === 'set-share') {
      if (!zipImportSets.value?.length) {
        zipImportError.value = t('backup.zipImportError')
        return false
      }
      const result = setsStore.applyImported(zipImportSets.value, folderIdFromSelection(uiStore.transferFolderId))
      if (!result)
        return false
    }
    else if (zipImportKind.value === 'full-backup' && zipImportFullBackup.value) {
      const libraryStore = useLibraryStore()
      const learningStore = useLearningStore()
      libraryStore.mergeImportedState(zipImportFullBackup.value.library)
      learningStore.mergeImportedState(zipImportFullBackup.value.learning, zipImportFullBackup.value.stats)
      const currentAiSettings = loadAiSettings()
      saveAiSettings({ ...zipImportFullBackup.value.aiSettings, apiKey: currentAiSettings.apiKey })
      useUIStore().showToast(t('backup.fullImportSuccess'))
    }
    else {
      zipImportError.value = t('backup.zipImportError')
      return false
    }
    resetZipImportState()
    uiStore.closeTransfer()
    return true
  }

  async function exportAllToZip() {
    const setsStore = useSetsStore()
    const uiStore = useUIStore()
    if (!setsStore.sets.length) {
      uiStore.showToast(t('backup.noSetsToExport'))
      return
    }
    const blob = await buildExportZipBlob(setsStore.exportSelectedSets)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = buildExportFileName()
    link.click()
    URL.revokeObjectURL(url)
    uiStore.showToast(t('backup.exported', { count: setsStore.sets.length }))
  }

  async function exportFullBackup() {
    const libraryStore = useLibraryStore()
    const learningStore = useLearningStore()
    const blob = await buildFullBackupZipBlob(libraryStore.state, learningStore.progress, learningStore.stats)
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

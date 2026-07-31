import type { ImportMode, VocabSet } from '@/types'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { buildExportFileName, buildExportZipBlob, formatBackupPreview, parseBackupZipBuffer } from '@/lib/file'
import { i18n } from '@/lib/i18n'
import { useSetsStore } from './sets'
import { useUIStore } from './ui'

const t = i18n.global.t

export const useBackupStore = defineStore('backup', () => {
  const zipImportError = ref('')
  const zipImportPreview = ref('')
  const zipImportSets = ref<VocabSet[] | null>(null)
  const zipImportName = ref('')
  const zipImportInputKey = ref(0)

  function resetZipImportState(resetInput = true) {
    zipImportError.value = ''
    zipImportPreview.value = ''
    zipImportSets.value = null
    zipImportName.value = ''
    const setsStore = useSetsStore()
    setsStore.duplicateSummary = null
    setsStore.resetImportVersionDiffs()
    if (resetInput)
      zipImportInputKey.value += 1
  }

  async function handleZipImportChange(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    const setsStore = useSetsStore()
    resetZipImportState(false)
    if (!file)
      return

    zipImportName.value = file.name
    try {
      const parsed = await parseBackupZipBuffer(await file.arrayBuffer())
      zipImportSets.value = parsed.sets
      zipImportPreview.value = formatBackupPreview(parsed.sets, parsed.exportedAt)
      setsStore.refreshDiffs(parsed.sets)
    }
    catch (error) {
      zipImportError.value = (error as Error).message || t('backup.importZipFailed')
    }
  }

  function applyZipImport() {
    const setsStore = useSetsStore()
    const uiStore = useUIStore()
    zipImportError.value = ''
    if (!zipImportSets.value?.length) {
      zipImportError.value = t('backup.zipImportError')
      return
    }
    const result = setsStore.applyImported(zipImportSets.value, setsStore.importMode as ImportMode)
    if (!result)
      return
    resetZipImportState()
    uiStore.closeTransfer()
  }

  async function exportAllToZip() {
    const setsStore = useSetsStore()
    const uiStore = useUIStore()
    if (!setsStore.sets.length) {
      uiStore.showToast(t('backup.noSetsToExport'))
      return
    }
    const blob = await buildExportZipBlob(setsStore.sets)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = buildExportFileName()
    link.click()
    URL.revokeObjectURL(url)
    uiStore.showToast(t('backup.exported', { count: setsStore.sets.length }))
  }

  return {
    zipImportError,
    zipImportPreview,
    zipImportSets,
    zipImportName,
    zipImportInputKey,
    resetZipImportState,
    handleZipImportChange,
    applyZipImport,
    exportAllToZip,
  }
})

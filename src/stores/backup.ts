import type { ImportMode, SyncTaskKind, SyncTaskState, VocabSet } from '@/types'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { LAST_DRIVE_BACKUP_AT_KEY } from '@/constants'
import { buildExportFileName, buildExportZipBlob, formatBackupPreview, parseBackupZipBuffer } from '@/lib/file'
import {
  downloadBackupFile,
  hasDriveToken,
  listBackupFiles,
  pruneOldBackupFiles,
  requestDriveAccess,
  revokeDriveAccess,
  uploadBackupZip,
} from '@/lib/googleDrive'
import { i18n } from '@/lib/i18n'
import { useSetsStore } from './sets'
import { useUIStore } from './ui'

const t = i18n.global.t

export const useBackupStore = defineStore('backup', () => {
  const driveConfigured = ref(Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID))
  const driveSignedIn = ref(hasDriveToken())
  const driveAccountLabel = ref('')
  const driveBackupLoading = ref(false)
  const driveImportLoading = ref(false)
  const driveListLoading = ref(false)
  const driveError = ref('')
  const driveBackups = ref<{ id: string, name: string, size: string, createdTime: string, modifiedTime: string }[]>([])
  const driveSelectedFileId = ref('')
  const driveSelectedFileName = ref('')
  const driveImportPreview = ref('')
  const driveImportSets = ref<VocabSet[] | null>(null)
  const driveImportExportedAt = ref('')
  const lastDriveBackupAt = ref(localStorage.getItem(LAST_DRIVE_BACKUP_AT_KEY) ?? '')
  const syncTask = ref<SyncTaskState>({
    kind: null,
    status: 'idle',
    progress: 0,
    messageKey: 'backup.syncIdle',
  })

  const zipImportError = ref('')
  const zipImportPreview = ref('')
  const zipImportSets = ref<VocabSet[] | null>(null)
  const zipImportName = ref('')
  const zipImportInputKey = ref(0)

  function startSyncTask(kind: SyncTaskKind, messageKey: string) {
    syncTask.value = { kind, status: 'running', progress: 8, messageKey }
  }

  function updateSyncTask(progress: number, messageKey: string) {
    syncTask.value = { ...syncTask.value, status: 'running', progress, messageKey }
  }

  function completeSyncTask(messageKey: string) {
    syncTask.value = { ...syncTask.value, status: 'success', progress: 100, messageKey }
  }

  function failSyncTask() {
    syncTask.value = { ...syncTask.value, status: 'error', messageKey: 'backup.syncFailed' }
  }

  // Drive auth
  async function ensureDriveSignedIn(prompt?: string | null): Promise<{ accessToken: string, expiresAt: number }> {
    driveError.value = ''
    if (!driveConfigured.value) {
      driveError.value = t('backup.driveNotConfigured')
      throw new Error(driveError.value)
    }

    const token = await requestDriveAccess(
      import.meta.env.VITE_GOOGLE_CLIENT_ID as string,
      prompt ?? (hasDriveToken() ? '' : 'consent'),
    ) as { accessToken: string, expiresAt: number }
    driveSignedIn.value = hasDriveToken()
    driveAccountLabel.value = t('backup.signedIn')
    return token
  }

  async function signInDrive() {
    try {
      await ensureDriveSignedIn('consent select_account')
      const uiStore = useUIStore()
      uiStore.showToast(t('backup.signedIn'))
    }
    catch (error) {
      driveSignedIn.value = false
      driveError.value = (error as Error).message || 'Google 登入失敗'
    }
  }

  function signOutDrive() {
    revokeDriveAccess()
    driveSignedIn.value = false
    driveAccountLabel.value = ''
    driveBackups.value = []
    resetDriveImportState()
    const uiStore = useUIStore()
    uiStore.showToast(t('backup.signedOut'))
  }

  // Drive backup
  async function backupToDrive() {
    const uiStore = useUIStore()
    const setsStore = useSetsStore()
    driveError.value = ''

    if (!setsStore.sets.length) {
      driveError.value = t('backup.noSetsToBackup')
      return
    }

    driveBackupLoading.value = true
    startSyncTask('backup', 'backup.syncAuthorizing')
    try {
      await ensureDriveSignedIn()
      updateSyncTask(30, 'backup.syncPackaging')
      const filename = buildExportFileName()
      const blob = await buildExportZipBlob(setsStore.sets)
      updateSyncTask(55, 'backup.syncUploading')
      await uploadBackupZip(blob, filename)
      updateSyncTask(82, 'backup.syncCleaning')
      const pruneResult = await pruneOldBackupFiles(10)
      driveBackups.value = pruneResult.kept
      lastDriveBackupAt.value = new Date().toISOString()
      localStorage.setItem(LAST_DRIVE_BACKUP_AT_KEY, lastDriveBackupAt.value)
      completeSyncTask('backup.syncBackupComplete')
      let toastMsg = t('backup.backupSuccess', { filename })
      if (pruneResult.deleted.length) {
        toastMsg += t('backup.backupDeleted', { count: pruneResult.deleted.length })
      }
      uiStore.showToast(toastMsg)
    }
    catch (error) {
      driveError.value = (error as Error).message || t('backup.backupFailed')
      failSyncTask()
    }
    finally {
      driveBackupLoading.value = false
    }
  }

  // Drive restore
  async function refreshDriveBackups() {
    driveError.value = ''
    driveListLoading.value = true
    startSyncTask('list', 'backup.syncAuthorizing')
    try {
      await ensureDriveSignedIn()
      updateSyncTask(55, 'backup.syncListing')
      driveBackups.value = await listBackupFiles()
      if (!driveBackups.value.length) {
        resetDriveImportState()
      }
      completeSyncTask('backup.syncListComplete')
    }
    catch (error) {
      driveError.value = (error as Error).message || t('backup.loadListFailed')
      failSyncTask()
    }
    finally {
      driveListLoading.value = false
    }
  }

  async function selectDriveBackup(fileId: string) {
    driveError.value = ''
    const file = driveBackups.value.find(item => item.id === fileId)
    driveSelectedFileId.value = fileId
    driveSelectedFileName.value = file?.name ?? ''
    driveImportPreview.value = ''
    driveImportSets.value = null
    driveImportExportedAt.value = ''

    if (!fileId)
      return

    driveImportLoading.value = true
    startSyncTask('restore', 'backup.syncAuthorizing')
    try {
      await ensureDriveSignedIn()
      updateSyncTask(35, 'backup.syncDownloading')
      const buffer = await downloadBackupFile(fileId)
      updateSyncTask(70, 'backup.syncValidating')
      const parsed = await parseBackupZipBuffer(buffer)
      driveImportSets.value = parsed.sets
      driveImportExportedAt.value = parsed.exportedAt
      driveImportPreview.value = formatBackupPreview(parsed.sets, parsed.exportedAt)
      const setsStore = useSetsStore()
      updateSyncTask(88, 'backup.syncComparing')
      setsStore.refreshDiffs(parsed.sets)
      completeSyncTask('backup.syncRestoreReady')
    }
    catch (error) {
      driveError.value = (error as Error).message || t('backup.loadBackupFailed')
      driveImportSets.value = null
      failSyncTask()
    }
    finally {
      driveImportLoading.value = false
    }
  }

  async function applyDriveImport() {
    const setsStore = useSetsStore()
    driveError.value = ''
    if (!driveImportSets.value || !driveImportSets.value.length) {
      driveError.value = t('backup.selectBackupFirst')
      return
    }

    driveImportLoading.value = true
    startSyncTask('import', 'backup.syncImporting')
    try {
      const result = setsStore.applyImported(driveImportSets.value, setsStore.importMode as ImportMode)
      if (!result)
        return
      resetDriveImportState()
      completeSyncTask('backup.syncImportComplete')
      const uiStore = useUIStore()
      uiStore.closeTransfer()
    }
    catch (error) {
      driveError.value = (error as Error).message || t('backup.importDriveFailed')
      failSyncTask()
    }
    finally {
      driveImportLoading.value = false
    }
  }

  // ZIP import
  function resetZipImportState(resetInput = true) {
    zipImportError.value = ''
    zipImportPreview.value = ''
    zipImportSets.value = null
    zipImportName.value = ''
    const setsStore = useSetsStore()
    setsStore.duplicateSummary = null
    setsStore.resetImportVersionDiffs()
    if (resetInput) {
      zipImportInputKey.value += 1
    }
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
      const buffer = await file.arrayBuffer()
      const parsed = await parseBackupZipBuffer(buffer)
      zipImportSets.value = parsed.sets
      zipImportPreview.value = formatBackupPreview(parsed.sets, parsed.exportedAt)
      setsStore.refreshDiffs(parsed.sets)
    }
    catch (error) {
      zipImportError.value = (error as Error).message || t('backup.importZipFailed')
    }
  }

  async function applyZipImport() {
    const setsStore = useSetsStore()
    const uiStore = useUIStore()
    zipImportError.value = ''
    if (!zipImportSets.value || !zipImportSets.value.length) {
      zipImportError.value = t('backup.zipImportError')
      return
    }

    const result = setsStore.applyImported(zipImportSets.value, setsStore.importMode as ImportMode)
    if (!result)
      return
    resetZipImportState()
    uiStore.closeTransfer()
  }

  function resetDriveImportState() {
    driveSelectedFileId.value = ''
    driveSelectedFileName.value = ''
    driveImportPreview.value = ''
    driveImportSets.value = null
    driveImportExportedAt.value = ''
    const setsStore = useSetsStore()
    setsStore.duplicateSummary = null
    setsStore.resetImportVersionDiffs()
  }

  return {
    driveConfigured,
    driveSignedIn,
    driveAccountLabel,
    driveBackupLoading,
    driveImportLoading,
    driveListLoading,
    driveError,
    driveBackups,
    driveSelectedFileId,
    driveSelectedFileName,
    driveImportPreview,
    driveImportSets,
    driveImportExportedAt,
    lastDriveBackupAt,
    syncTask,
    zipImportError,
    zipImportPreview,
    zipImportSets,
    zipImportName,
    zipImportInputKey,
    ensureDriveSignedIn,
    signInDrive,
    signOutDrive,
    backupToDrive,
    refreshDriveBackups,
    selectDriveBackup,
    applyDriveImport,
    resetZipImportState,
    handleZipImportChange,
    applyZipImport,
    resetDriveImportState,
  }
})

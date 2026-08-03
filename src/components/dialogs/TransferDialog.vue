<script setup lang="ts">
import { Download, FileArchive, Upload } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { syncAfterLocalCommit } from '@/lib/commit-sync'
import { useDirtyForm } from '@/lib/dirty-form'
import { useBackupStore } from '@/stores/backup'
import { useUIStore } from '@/stores/ui'
import Button from '../ui/button/Button.vue'
import Dialog from '../ui/dialog/Dialog.vue'
import SectionPanel from '../ui/section-panel/SectionPanel.vue'
import StatusMessage from '../ui/status-message/StatusMessage.vue'
import ExportSettings from './ExportSettings.vue'
import FolderPicker from './FolderPicker.vue'
import ImportSettings from './ImportSettings.vue'

const uiStore = useUIStore()
const backupStore = useBackupStore()
const { transferOpen, transferFolderId } = storeToRefs(uiStore)
const { closeTransfer } = uiStore
const {
  zipImportInputKey,
  zipImportName,
  zipImportPreview,
  zipImportSets,
  zipImportFullBackup,
  zipImportFullPreview,
  zipImportKind,
  zipImportError,
} = storeToRefs(backupStore)
const { resetZipImportState, handleZipImportChange, applyZipImport, exportFullBackup } = backupStore
const transferDirty = computed(() => transferOpen.value && Boolean(zipImportName.value || zipImportPreview.value || zipImportError.value || zipImportKind.value))
const appliedLocally = ref(false)
const saving = ref(false)
const transferFolderDraft = ref(transferFolderId.value)
const activeMode = ref<'import' | 'export'>('import')

watch(transferOpen, (open) => {
  if (open) {
    transferFolderDraft.value = transferFolderId.value
    activeMode.value = 'import'
  }
})

async function saveTransfer(): Promise<boolean> {
  if (saving.value)
    return false
  if (!transferDirty.value)
    return true
  saving.value = true
  try {
    if (!appliedLocally.value) {
      const applied = await applyZipImport(transferFolderDraft.value)
      if (!applied)
        return false
      appliedLocally.value = true
    }
    const synced = await syncAfterLocalCommit()
    if (!synced)
      return false
    appliedLocally.value = false
    transferFolderId.value = transferFolderDraft.value
    resetZipImportState()
    closeTransfer()
    return true
  }
  finally {
    saving.value = false
  }
}

function discardTransfer() {
  appliedLocally.value = false
  resetZipImportState()
  closeTransfer()
}

async function handleTransferFileChange(event: Event) {
  appliedLocally.value = false
  await handleZipImportChange(event)
}

const dirtyForm = useDirtyForm({
  id: 'backup-transfer',
  isDirty: () => transferDirty.value,
  save: saveTransfer,
  discard: discardTransfer,
})

async function requestTransferClose() {
  await dirtyForm.requestClose()
}
</script>

<template>
  <Dialog
    :open="transferOpen"
    :title="$t('backup.title')"
    :description="$t('backup.description')"
    width-class="max-w-3xl"
    :busy="saving"
    @close="requestTransferClose"
  >
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-1 rounded-2xl bg-ink-100/70 p-1 dark:bg-ink-900/70" role="tablist" :aria-label="$t('backup.title')">
        <button
          type="button"
          role="tab"
          :aria-selected="activeMode === 'import'"
          class="flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-colors"
          :class="activeMode === 'import' ? 'bg-white text-accent-primary shadow-sm dark:bg-ink-800' : 'text-ink-500 hover:text-ink-900 dark:hover:text-ink-100'"
          @click="activeMode = 'import'"
        >
          <Upload class="h-4 w-4" aria-hidden="true" />
          {{ $t('backup.importZip') }}
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="activeMode === 'export'"
          class="flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-colors"
          :class="activeMode === 'export' ? 'bg-white text-accent-primary shadow-sm dark:bg-ink-800' : 'text-ink-500 hover:text-ink-900 dark:hover:text-ink-100'"
          @click="activeMode = 'export'"
        >
          <Download class="h-4 w-4" aria-hidden="true" />
          {{ $t('backup.exportSection') }}
        </button>
      </div>

      <SectionPanel v-if="activeMode === 'import'" role="tabpanel">
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-start gap-3">
            <FileArchive class="mt-0.5 h-5 w-5 text-accent-primary" />
            <div>
              <p class="text-sm font-bold text-ink-950 dark:text-ink-50">
                {{ $t('backup.importZip') }}
              </p>
              <p class="mt-1 text-xs text-ink-400 dark:text-ink-500">
                {{ $t('backup.importZipDescription') }}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" :disabled="saving || appliedLocally || (!zipImportPreview && !zipImportError && !zipImportName)" @click="resetZipImportState">
            {{ $t('backup.clear') }}
          </Button>
        </div>

        <div class="mt-4 space-y-2">
          <FolderPicker v-model="transferFolderDraft" :title="$t('backup.importFolderLabel')" :disabled="saving || appliedLocally" />
          <input
            :key="zipImportInputKey"
            type="file"
            accept=".zip"
            class="block w-full text-sm text-ink-500 file:mr-4 file:rounded-xl file:border-0 file:bg-ink-950 file:px-4 file:py-2.5 file:text-xs file:font-semibold file:text-white file:transition-all hover:file:opacity-90"
            :disabled="saving || appliedLocally"
            @change="handleTransferFileChange"
          >
          <p v-if="zipImportName" class="text-xs font-bold text-ink-400">
            {{ $t('backup.selectedFile', { name: zipImportName }) }}
          </p>
        </div>
        <StatusMessage v-if="zipImportPreview" tone="success" class="mt-3">
          {{ zipImportPreview }}
        </StatusMessage>
        <StatusMessage v-if="zipImportError" tone="error" class="mt-3">
          {{ zipImportError }}
        </StatusMessage>
        <ImportSettings :sets="zipImportSets" :kind="zipImportKind" :full-backup="zipImportFullBackup" :full-preview="zipImportFullPreview" />
        <div class="mt-4 flex justify-end border-t border-ink-200/50 pt-4 dark:border-ink-800/50">
          <Button variant="default" :disabled="saving || !zipImportKind" :loading="saving" class="gap-2" @click="saveTransfer">
            <Upload class="h-4 w-4" />
            {{ $t('backup.applyImport') }}
          </Button>
        </div>
      </SectionPanel>

      <SectionPanel v-else role="tabpanel">
        <div class="flex items-start gap-3">
          <Download class="mt-0.5 h-5 w-5 text-accent-primary" />
          <div>
            <p class="text-sm font-bold text-ink-950 dark:text-ink-50">
              {{ $t('backup.exportSection') }}
            </p>
            <p class="mt-1 text-xs text-ink-400 dark:text-ink-500">
              {{ $t('backup.exportDescription') }}
            </p>
          </div>
        </div>
        <ExportSettings class="mt-4" />
        <div class="mt-4 flex justify-end border-t border-ink-200/50 pt-4 dark:border-ink-800/50">
          <Button variant="outline" class="gap-2" @click="exportFullBackup">
            <Download class="h-4 w-4" />
            {{ $t('backup.downloadFullZip') }}
          </Button>
        </div>
      </SectionPanel>
    </div>
  </Dialog>
</template>

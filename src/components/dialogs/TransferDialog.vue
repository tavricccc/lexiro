<script setup lang="ts">
import { Cloud, Download, FileArchive, Upload } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { useBackupStore } from '@/stores/backup'
import { useUIStore } from '@/stores/ui'
import SyncProgressPanel from '../SyncProgressPanel.vue'
import Button from '../ui/button/Button.vue'
import Dialog from '../ui/dialog/Dialog.vue'
import SectionPanel from '../ui/section-panel/SectionPanel.vue'
import StatusMessage from '../ui/status-message/StatusMessage.vue'
import ExportSettings from './ExportSettings.vue'
import ImportSettings from './ImportSettings.vue'

const uiStore = useUIStore()
const backupStore = useBackupStore()
const { transferOpen } = storeToRefs(uiStore)
const { closeTransfer } = uiStore
const {
  zipImportInputKey,
  zipImportName,
  zipImportPreview,
  zipImportSets,
  zipImportError,
} = storeToRefs(backupStore)
const { resetZipImportState, handleZipImportChange, applyZipImport } = backupStore
</script>

<template>
  <Dialog
    :open="transferOpen"
    :title="$t('backup.title')"
    :description="$t('backup.description')"
    width-class="max-w-3xl"
    @close="closeTransfer"
  >
    <div class="space-y-6">
      <SyncProgressPanel />

      <SectionPanel>
        <div class="flex items-start gap-3">
          <Cloud class="mt-0.5 h-5 w-5 text-accent-primary" />
          <div>
            <p class="text-sm font-bold text-ink-950 dark:text-ink-50">
              {{ $t('sync.cloudTitle') }}
            </p>
            <p class="mt-1 text-xs leading-relaxed text-ink-400 dark:text-ink-500">
              {{ $t('sync.cloudDescription') }}
            </p>
          </div>
        </div>
        <p class="mt-4 rounded-xl bg-ink-100/70 p-3 text-xs font-semibold leading-relaxed text-ink-600 dark:bg-ink-900 dark:text-ink-400">
          {{ $t('sync.cloudSafety') }}
        </p>
      </SectionPanel>

      <SectionPanel>
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
          <Button variant="outline" size="sm" :disabled="!zipImportPreview && !zipImportError && !zipImportName" @click="resetZipImportState">
            {{ $t('backup.clear') }}
          </Button>
        </div>

        <div class="mt-4 space-y-2">
          <input
            :key="zipImportInputKey"
            type="file"
            accept=".zip"
            class="block w-full text-sm text-ink-500 file:mr-4 file:rounded-xl file:border-0 file:bg-ink-950 file:px-4 file:py-2.5 file:text-xs file:font-semibold file:text-white file:transition-all hover:file:opacity-90"
            @change="handleZipImportChange"
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
        <ImportSettings :sets="zipImportSets" prefix="zip" />
        <div class="mt-4 flex justify-end border-t border-ink-200/50 pt-4 dark:border-ink-800/50">
          <Button variant="default" :disabled="!zipImportSets || !zipImportSets.length" class="gap-2" @click="applyZipImport">
            <Upload class="h-4 w-4" />
            {{ $t('backup.applyImport') }}
          </Button>
        </div>
      </SectionPanel>

      <SectionPanel>
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
      </SectionPanel>
    </div>
  </Dialog>
</template>

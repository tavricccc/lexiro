<script setup lang="ts">
import { Cloud, LogOut, RefreshCw, Upload } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { useBackupStore } from '@/stores/backup'
import { useSetsStore } from '@/stores/sets'
import { useUIStore } from '@/stores/ui'
import SyncProgressPanel from '../SyncProgressPanel.vue'
import Button from '../ui/button/Button.vue'
import Dialog from '../ui/dialog/Dialog.vue'
import SectionPanel from '../ui/section-panel/SectionPanel.vue'
import StatusMessage from '../ui/status-message/StatusMessage.vue'
import DriveBackupSelector from './DriveBackupSelector.vue'
import ExportSettings from './ExportSettings.vue'
import ImportSettings from './ImportSettings.vue'

const uiStore = useUIStore()
const setsStore = useSetsStore()
const backupStore = useBackupStore()
const { transferOpen } = storeToRefs(uiStore)
const { closeTransfer } = uiStore

const { sets } = storeToRefs(setsStore)

const {
  zipImportInputKey,
  zipImportName,
  zipImportPreview,
  zipImportSets,
  zipImportError,
} = storeToRefs(backupStore)

const {
  driveConfigured,
  driveSignedIn,
  driveAccountLabel,
  driveBackupLoading,
  driveImportLoading,
  driveListLoading,
  driveError,
  driveImportPreview,
  driveImportSets,
} = storeToRefs(backupStore)
const { signOutDrive, backupToDrive, refreshDriveBackups, applyDriveImport, resetZipImportState, handleZipImportChange, applyZipImport } = backupStore
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

      <!-- 1. Google Drive Section -->
      <SectionPanel>
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <p class="text-sm font-bold text-ink-950 dark:text-ink-50">
              {{ $t('backup.driveSection') }}
            </p>
            <p class="mt-1 text-xs text-ink-400 dark:text-ink-500">
              {{ $t('backup.driveDescription') }}
            </p>
            <p v-if="driveAccountLabel" class="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              {{ driveAccountLabel }}
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button v-if="driveSignedIn" variant="default" class="gap-2" @click="signOutDrive">
              <LogOut class="h-4 w-4" />
              <span>{{ $t('backup.signOut') }}</span>
            </Button>
          </div>
        </div>

        <StatusMessage v-if="!driveConfigured" tone="warning" class="mt-4">
          {{ $t('backup.driveNotConfigured') }}
        </StatusMessage>
        <StatusMessage v-if="driveError" tone="error" class="mt-4">
          {{ driveError }}
        </StatusMessage>

        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          <Button
            variant="default"
            :disabled="!sets.length || !driveConfigured"
            :loading="driveBackupLoading"
            class="gap-2"
            @click="backupToDrive"
          >
            <Cloud class="h-4 w-4" />
            <span>{{ $t('backup.backupToDrive') }}</span>
          </Button>
          <Button
            variant="default"
            :disabled="!driveConfigured"
            :loading="driveListLoading"
            class="gap-2"
            @click="refreshDriveBackups"
          >
            <RefreshCw class="h-4 w-4" />
            <span>{{ $t('backup.loadDriveBackups') }}</span>
          </Button>
        </div>

        <!-- Custom Dropdown Selector -->
        <DriveBackupSelector />

        <StatusMessage v-if="driveImportPreview" tone="success" class="mt-3">
          {{ driveImportPreview }}
        </StatusMessage>

        <!-- Google Drive Import Settings -->
        <ImportSettings :sets="driveImportSets" prefix="drive" />

        <div class="mt-4 pt-4 border-t border-ink-200/50 dark:border-ink-800/50 flex justify-end">
          <Button
            variant="default"
            :disabled="!driveImportSets || !driveImportSets.length"
            :loading="driveImportLoading"
            class="gap-2"
            @click="applyDriveImport"
          >
            <Upload class="h-4 w-4" />
            <span>{{ $t('backup.applyDriveImport') }}</span>
          </Button>
        </div>
      </SectionPanel>

      <!-- 2. Import ZIP Section -->
      <SectionPanel>
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-sm font-bold text-ink-950 dark:text-ink-50">
              {{ $t('backup.importZip') }}
            </p>
            <p class="mt-1 text-xs text-ink-400 dark:text-ink-500">
              {{ $t('backup.importZipDescription') }}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            class="h-8 px-3 text-xs bg-white dark:bg-ink-900"
            :disabled="!zipImportPreview && !zipImportError && !zipImportName"
            @click="resetZipImportState"
          >
            {{ $t('backup.clear') }}
          </Button>
        </div>

        <div class="mt-4 space-y-2">
          <input
            :key="zipImportInputKey"
            type="file"
            accept=".zip"
            class="block w-full text-sm text-ink-500 file:mr-4 file:rounded-xl file:border-0 file:bg-ink-950 dark:file:bg-ink-50 file:px-4 file:py-2.5 file:text-xs file:font-semibold file:text-white dark:file:text-ink-950 file:transition-all file:cursor-pointer hover:file:opacity-90 file:active:scale-95"
            @change="handleZipImportChange"
          >
          <p v-if="zipImportName" class="text-xs text-ink-400 dark:text-ink-500 font-bold">
            {{ $t('backup.selectedFile', { name: zipImportName }) }}
          </p>
        </div>

        <StatusMessage v-if="zipImportPreview" tone="success" class="mt-3">
          {{ zipImportPreview }}
        </StatusMessage>
        <StatusMessage v-if="zipImportError" tone="error" class="mt-3">
          {{ zipImportError }}
        </StatusMessage>

        <!-- ZIP Import Settings -->
        <ImportSettings :sets="zipImportSets" prefix="zip" />

        <div class="mt-4 pt-4 border-t border-ink-200/50 dark:border-ink-800/50 flex justify-end">
          <Button variant="default" :disabled="!zipImportSets || !zipImportSets.length" class="gap-2" @click="applyZipImport">
            <Upload class="h-4 w-4" />
            <span>{{ $t('backup.applyImport') }}</span>
          </Button>
        </div>
      </SectionPanel>

      <!-- 3. Export Section -->
      <SectionPanel>
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-sm font-bold text-ink-950 dark:text-ink-50">
              {{ $t('backup.exportSection') }}
            </p>
            <p class="mt-1 text-xs text-ink-400 dark:text-ink-500">
              {{ $t('backup.exportDescription') }}
            </p>
          </div>
        </div>

        <ExportSettings />
      </SectionPanel>
    </div>
  </Dialog>
</template>

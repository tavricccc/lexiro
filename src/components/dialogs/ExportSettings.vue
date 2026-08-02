<script setup lang="ts">
import { Download, Settings2 } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { ref } from 'vue'
import { useSetsStore } from '@/stores/sets'
import Button from '../ui/button/Button.vue'
import Dialog from '../ui/dialog/Dialog.vue'
import DialogFooter from '../ui/dialog/DialogFooter.vue'
import StatusMessage from '../ui/status-message/StatusMessage.vue'

const setsStore = useSetsStore()
const {
  sets,
  exportSelectedIds,
  exportAllSelected,
  exportSelectedCount,
  exportSelectedWordCount,
  exportError,
} = storeToRefs(setsStore)
const { toggleExportAll, exportSelectedSetsToZip } = setsStore

const settingsOpen = ref(false)
</script>

<template>
  <div class="mt-4 rounded-xl border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 px-4 py-3">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="text-left">
        <p class="text-sm font-bold text-ink-950 dark:text-ink-50">
          {{ $t('backup.exportSelection') }}
        </p>
        <p class="mt-1 text-xs font-medium text-ink-500 dark:text-ink-400">
          <template v-if="sets.length">
            {{ $t('backup.exportSelectedSummary', { count: exportSelectedCount, words: exportSelectedWordCount }) }}
          </template>
          <template v-else>
            {{ $t('home.emptyState') }}
          </template>
        </p>
      </div>
      <Button variant="default" class="shrink-0 gap-2" :disabled="!sets.length" @click="settingsOpen = true">
        <Settings2 class="h-4 w-4" />
        <span>{{ $t('backup.configureExport') }}</span>
      </Button>
    </div>

    <StatusMessage v-if="exportError" tone="error" class="mt-3">
      {{ exportError }}
    </StatusMessage>

    <Dialog
      :open="settingsOpen"
      :title="$t('backup.exportSettingsTitle')"
      :description="$t('backup.exportSettingsDescription')"
      width-class="max-w-2xl"
      @close="settingsOpen = false"
    >
      <div class="space-y-5">
        <div class="flex items-center justify-between gap-4">
          <p class="text-xs font-semibold text-ink-500 dark:text-ink-400">
            {{ $t('backup.exportSelectedSummary', { count: exportSelectedCount, words: exportSelectedWordCount }) }}
          </p>
          <Button variant="outline" size="sm" :disabled="!sets.length" @click="toggleExportAll">
            {{ exportAllSelected ? $t('backup.deselectAll') : $t('backup.selectAll') }}
          </Button>
        </div>

        <div v-if="sets.length" class="grid max-h-80 gap-2.5 overflow-y-auto pr-1">
          <label
            v-for="set in sets"
            :key="set.id"
            class="flex cursor-pointer items-center gap-3 rounded-xl border border-ink-200 bg-white px-4 py-2.5 hover:bg-ink-50 dark:border-ink-800 dark:bg-ink-900 dark:hover:bg-ink-850"
          >
            <input
              v-model="exportSelectedIds"
              type="checkbox"
              :value="set.id"
              class="h-4 w-4 rounded border-ink-300 accent-emerald-500"
            >
            <div class="text-left">
              <p class="text-sm font-bold text-ink-900 dark:text-ink-100">
                {{ set.setName }}
              </p>
              <p class="text-[11px] font-semibold text-ink-400 dark:text-ink-500">
                {{ $t('home.wordsCount', { count: setsStore.getSetWordCount(set.id) }) }}
              </p>
            </div>
          </label>
        </div>

        <p v-else class="text-xs font-semibold text-ink-400 dark:text-ink-500">
          {{ $t('home.emptyState') }}
        </p>

        <StatusMessage v-if="exportError" tone="error">
          {{ exportError }}
        </StatusMessage>
      </div>
      <template #footer>
        <DialogFooter>
          <Button variant="outline" @click="settingsOpen = false">
            {{ $t('editor.cancel') }}
          </Button>
          <Button variant="default" :disabled="!exportSelectedCount" class="gap-2" @click="exportSelectedSetsToZip">
            <Download class="h-4 w-4" />
            <span>{{ $t('backup.downloadZip') }}</span>
          </Button>
        </DialogFooter>
      </template>
    </Dialog>
  </div>
</template>

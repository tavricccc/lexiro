<script setup lang="ts">
import { CheckCircle2, CloudOff, LoaderCircle, TriangleAlert } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBackupStore } from '@/stores/backup'
import Progress from './ui/progress/Progress.vue'

withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })

const { t, d } = useI18n()
const backupStore = useBackupStore()
const { syncTask, lastDriveBackupAt } = storeToRefs(backupStore)

const statusText = computed(() => {
  if (syncTask.value.status === 'running' || syncTask.value.status === 'error')
    return t(syncTask.value.messageKey)
  if (lastDriveBackupAt.value)
    return t('backup.lastBackupAt', { time: d(new Date(lastDriveBackupAt.value), 'short') })
  return t('backup.neverBackedUp')
})

const toneClass = computed(() => {
  if (syncTask.value.status === 'error')
    return 'border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400'
  if (syncTask.value.status === 'running')
    return 'border-accent-primary/20 bg-accent-primary/10 text-accent-primary'
  if (lastDriveBackupAt.value)
    return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
  return 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'
})
</script>

<template>
  <div
    class="rounded-2xl border text-left"
    :class="[toneClass, compact ? 'px-3 py-2.5' : 'p-4']"
    role="status"
    aria-live="polite"
  >
    <div class="flex items-center gap-3">
      <LoaderCircle v-if="syncTask.status === 'running'" class="h-4 w-4 shrink-0 animate-spin" />
      <TriangleAlert v-else-if="syncTask.status === 'error'" class="h-4 w-4 shrink-0" />
      <CheckCircle2 v-else-if="lastDriveBackupAt" class="h-4 w-4 shrink-0" />
      <CloudOff v-else class="h-4 w-4 shrink-0" />
      <div class="min-w-0 flex-1">
        <p class="truncate text-xs font-extrabold">
          {{ statusText }}
        </p>
        <p v-if="!compact && syncTask.status === 'running'" class="mt-0.5 text-[11px] font-semibold opacity-70">
          {{ $t('backup.syncProgress', { progress: syncTask.progress }) }}
        </p>
      </div>
      <span v-if="syncTask.status === 'running'" class="text-xs font-extrabold tabular-nums">
        {{ syncTask.progress }}%
      </span>
    </div>
    <Progress v-if="syncTask.status === 'running'" :model-value="syncTask.progress" class="mt-3 h-1" />
  </div>
</template>

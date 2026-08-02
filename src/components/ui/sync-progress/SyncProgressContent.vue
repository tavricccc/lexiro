<script setup lang="ts">
import type { SyncProgressState } from '@/types'
import { LoaderCircle, RotateCcw, WifiOff, X } from 'lucide-vue-next'
import { computed } from 'vue'
import Button from '../button/Button.vue'
import Progress from '../progress/Progress.vue'

const props = withDefaults(defineProps<{
  state: SyncProgressState
  showTitle?: boolean
  allowCancel?: boolean
}>(), {
  showTitle: true,
  allowCancel: false,
})

const emit = defineEmits<{
  retry: []
  cancel: []
}>()

const isWorking = computed(() => !['synced', 'offline', 'error'].includes(props.state.phase))
const showActions = computed(() => ['offline', 'error'].includes(props.state.phase))
</script>

<template>
  <div class="min-w-0" role="status" aria-live="polite" aria-atomic="true">
    <div class="flex items-start gap-4">
      <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-primary/10 text-accent-primary">
        <WifiOff v-if="state.phase === 'offline'" class="h-6 w-6" aria-hidden="true" />
        <RotateCcw v-else-if="state.phase === 'error'" class="h-6 w-6" aria-hidden="true" />
        <LoaderCircle v-else class="h-6 w-6 motion-reduce:animate-none" :class="isWorking ? 'animate-spin' : ''" aria-hidden="true" />
      </div>

      <div class="min-w-0 flex-1">
        <h2 v-if="showTitle" class="text-xl font-black tracking-tight text-ink-950 dark:text-ink-50">
          {{ state.message || $t('sync.progressTitle') }}
        </h2>
        <p v-if="state.totalBatches > 0" class="mt-1 text-sm font-semibold text-ink-500 dark:text-ink-300">
          {{ $t('sync.batchProgress', { current: state.currentBatch, total: state.totalBatches }) }}
        </p>
      </div>

      <span class="shrink-0 text-2xl font-black tabular-nums text-ink-900 dark:text-ink-50">
        {{ state.percent }}%
      </span>
    </div>

    <Progress :model-value="state.percent" class="mt-7 h-2" />

    <div class="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-ink-500 dark:text-ink-300">
      <span>{{ $t('sync.progressCount', { completed: state.completed, total: state.total }) }}</span>
      <span v-if="state.pendingWrites > 0">{{ $t('sync.pending', { count: state.pendingWrites }) }}</span>
    </div>

    <p v-if="state.phase === 'error'" class="mt-5 break-words rounded-2xl bg-red-50 p-4 text-sm font-semibold leading-relaxed text-red-700 dark:bg-red-950/25 dark:text-red-200">
      {{ $t('sync.progressError') }}
    </p>
    <p v-else-if="state.phase === 'offline'" class="mt-5 break-words rounded-2xl bg-amber-50 p-4 text-sm font-semibold leading-relaxed text-amber-800 dark:bg-amber-950/25 dark:text-amber-200">
      {{ $t('sync.offlineContinueHint') }}
    </p>

    <div v-if="showActions" class="mt-6 flex flex-wrap justify-end gap-2">
      <Button v-if="allowCancel" variant="ghost" class="gap-2" @click="emit('cancel')">
        <X class="h-4 w-4" aria-hidden="true" />
        {{ $t('sync.cancel') }}
      </Button>
      <Button v-if="state.retryable" variant="default" class="gap-2" @click="emit('retry')">
        <RotateCcw class="h-4 w-4" aria-hidden="true" />
        {{ $t('sync.retry') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SyncProgressState } from '@/types'
import { Check, LoaderCircle, RotateCcw, WifiOff, X } from 'lucide-vue-next'
import { computed } from 'vue'
import Button from '../button/Button.vue'

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
  <div class="flex min-w-0 flex-col items-center text-center" role="status" aria-live="polite" aria-atomic="true">
    <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-primary/10 text-accent-primary">
      <WifiOff v-if="state.phase === 'offline'" class="h-6 w-6" aria-hidden="true" />
      <RotateCcw v-else-if="state.phase === 'error'" class="h-6 w-6" aria-hidden="true" />
      <Check v-else-if="state.phase === 'synced'" class="h-6 w-6 animate-[sync-ack_120ms_ease-out] motion-reduce:animate-none" aria-hidden="true" />
      <LoaderCircle v-else class="h-6 w-6 motion-reduce:animate-none" :class="isWorking ? 'motion-safe:animate-spin' : ''" aria-hidden="true" />
    </div>

    <div class="mt-3 min-w-0">
      <p v-if="showTitle" class="text-xs font-semibold text-ink-500 dark:text-ink-400">
        {{ state.message || $t('sync.progressTitle') }}
      </p>
      <p v-if="state.totalBatches > 0" class="mt-1 text-[11px] font-medium text-ink-400 dark:text-ink-500">
        {{ $t('sync.batchProgress', { current: state.currentBatch, total: state.totalBatches }) }}
      </p>
    </div>

    <div v-if="state.pendingWrites > 0" class="mt-2 text-[11px] font-medium text-ink-400 dark:text-ink-500">
      {{ $t('sync.pending', { count: state.pendingWrites }) }}
    </div>

    <p v-if="state.phase === 'error'" class="mt-3 max-w-sm break-words text-xs font-semibold leading-relaxed text-red-600 dark:text-red-300">
      {{ $t('sync.progressError') }}
    </p>
    <p v-else-if="state.stalled" class="mt-3 max-w-sm break-words text-xs font-medium leading-relaxed text-ink-400 dark:text-ink-500">
      {{ $t('sync.stalled') }}
    </p>
    <p v-else-if="state.phase === 'retrying' && !state.message" class="mt-3 max-w-sm break-words text-xs font-medium leading-relaxed text-ink-400 dark:text-ink-500">
      {{ $t('sync.retrying') }}
    </p>
    <p v-else-if="state.phase === 'offline'" class="mt-3 max-w-sm break-words text-xs font-medium leading-relaxed text-ink-400 dark:text-ink-500">
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

<script setup lang="ts">
import type { SyncProgressState } from '@/types'
import { ArrowRight, LoaderCircle, RotateCcw, WifiOff } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from '../button/Button.vue'
import Card from '../card/Card.vue'
import Progress from '../progress/Progress.vue'

const props = withDefaults(defineProps<{
  state: SyncProgressState
  fullscreen?: boolean
  allowOffline?: boolean
}>(), {
  fullscreen: false,
  allowOffline: false,
})

const emit = defineEmits<{
  retry: []
  continueOffline: []
}>()

const { t } = useI18n()
const isWorking = computed(() => !['synced', 'offline', 'error'].includes(props.state.phase))
const phaseLabel = computed(() => t(`sync.phase.${props.state.phase}`))
const batchLabel = computed(() => props.state.totalBatches > 0
  ? t('sync.batchProgress', { current: props.state.currentBatch, total: props.state.totalBatches })
  : '')

function handleRetry() {
  emit('retry')
}
</script>

<template>
  <div
    class="sync-progress"
    :class="fullscreen ? 'fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-ink-950/35 p-5 backdrop-blur-xl' : ''"
    role="status"
    aria-live="polite"
  >
    <Card class="w-full max-w-lg overflow-hidden border-ink-200/70 bg-white/95 p-6 shadow-2xl dark:border-ink-700/70 dark:bg-ink-950/95 sm:p-8">
      <div class="flex items-start gap-4">
        <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-primary/10 text-accent-primary">
          <WifiOff v-if="state.phase === 'offline'" class="h-6 w-6" />
          <RotateCcw v-else-if="state.phase === 'error'" class="h-6 w-6" />
          <LoaderCircle v-else class="h-6 w-6" :class="isWorking ? 'animate-spin' : ''" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-xs font-black uppercase tracking-[0.18em] text-accent-primary">
            {{ phaseLabel }}
          </p>
          <h2 class="mt-2 text-xl font-black tracking-tight text-ink-950 dark:text-ink-50">
            {{ state.message || $t('sync.progressTitle') }}
          </h2>
          <p v-if="batchLabel" class="mt-1 text-xs font-semibold text-ink-500">
            {{ batchLabel }}
          </p>
        </div>
        <span class="shrink-0 text-2xl font-black tabular-nums text-ink-900 dark:text-ink-50">
          {{ state.percent }}%
        </span>
      </div>

      <Progress :model-value="state.percent" class="mt-7 h-2" />

      <div class="mt-4 flex items-center justify-between gap-4 text-xs font-semibold text-ink-500">
        <span>{{ $t('sync.progressCount', { completed: state.completed, total: state.total }) }}</span>
        <span v-if="state.pendingWrites > 0">{{ $t('sync.pending', { count: state.pendingWrites }) }}</span>
      </div>

      <p v-if="state.phase === 'error'" class="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold leading-relaxed text-red-700 dark:bg-red-950/25 dark:text-red-200">
        {{ $t('sync.progressError') }}
      </p>
      <p v-else-if="state.phase === 'offline'" class="mt-5 rounded-2xl bg-amber-50 p-4 text-sm font-semibold leading-relaxed text-amber-800 dark:bg-amber-950/25 dark:text-amber-200">
        {{ $t('sync.offlineContinueHint') }}
      </p>

      <div v-if="state.phase === 'error' || state.phase === 'offline'" class="mt-6 flex flex-wrap justify-end gap-2">
        <Button v-if="allowOffline" variant="ghost" class="gap-2" @click="emit('continueOffline')">
          {{ $t('sync.useLocalData') }}
          <ArrowRight class="h-4 w-4" />
        </Button>
        <Button v-if="state.retryable" variant="default" class="gap-2" @click="handleRetry">
          <RotateCcw class="h-4 w-4" />
          {{ $t('sync.retry') }}
        </Button>
      </div>
    </Card>
  </div>
</template>

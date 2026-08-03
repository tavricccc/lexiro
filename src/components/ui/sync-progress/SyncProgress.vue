<script setup lang="ts">
import type { SyncProgressState } from '@/types'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Card from '../card/Card.vue'
import LottieLoadingOverlay from '../loading-overlay/LottieLoadingOverlay.vue'
import SyncProgressContent from './SyncProgressContent.vue'

const props = withDefaults(defineProps<{
  state: SyncProgressState
  fullscreen?: boolean
  allowCancel?: boolean
}>(), {
  fullscreen: false,
  allowCancel: false,
})

const emit = defineEmits<{
  retry: []
  cancel: []
}>()

const { t } = useI18n()
const progressLabel = computed(() => t('sync.progressCount', {
  completed: props.state.completed,
  total: props.state.total,
}))
const detail = computed(() => props.state.totalBatches > 0
  ? t('sync.batchProgress', { current: props.state.currentBatch, total: props.state.totalBatches })
  : '')
const hint = computed(() => {
  if (props.state.phase === 'error')
    return t('sync.progressError')
  if (props.state.phase === 'offline')
    return t('sync.offlineContinueHint')
  return ''
})
</script>

<template>
  <LottieLoadingOverlay
    v-if="fullscreen"
    open
    :message="state.message || $t('sync.progressTitle')"
    :detail="detail"
    :percent="state.percent"
    :progress-label="progressLabel"
    :hint="hint"
    :allow-cancel="allowCancel"
    :retryable="state.retryable"
    @retry="emit('retry')"
    @cancel="emit('cancel')"
  />

  <Card v-else class="sync-progress w-full overflow-hidden p-4 sm:p-5">
    <SyncProgressContent :state="state" :allow-cancel="allowCancel" @retry="emit('retry')" @cancel="emit('cancel')" />
  </Card>
</template>

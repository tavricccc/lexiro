<script setup lang="ts">
import type { SyncProgressState } from '@/types'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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
const isWorking = computed(() => !['synced', 'offline', 'error'].includes(props.state.phase))
const visible = ref(!isWorking.value)
let revealTimer: ReturnType<typeof setTimeout> | null = null
function clearRevealTimer() {
  if (revealTimer) {
    clearTimeout(revealTimer)
    revealTimer = null
  }
}
function updateVisibility() {
  if (isWorking.value && visible.value)
    return
  clearRevealTimer()
  if (!isWorking.value) {
    visible.value = true
    return
  }
  visible.value = false
  revealTimer = setTimeout(() => {
    visible.value = true
    revealTimer = null
  }, 300)
}
onMounted(updateVisibility)
watch(() => props.state.phase, updateVisibility)
onBeforeUnmount(clearRevealTimer)

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
    v-if="fullscreen && visible"
    open
    :message="state.message || $t('sync.progressTitle')"
    :detail="detail"
    :show-progress="false"
    :hint="hint"
    :allow-cancel="allowCancel"
    :retryable="state.retryable"
    @retry="emit('retry')"
    @cancel="emit('cancel')"
  />

  <Card v-else-if="visible" class="sync-progress flex w-full justify-center overflow-hidden p-4 sm:p-5">
    <SyncProgressContent :state="state" :allow-cancel="allowCancel" @retry="emit('retry')" @cancel="emit('cancel')" />
  </Card>
  <span v-else class="sr-only" role="status" aria-live="polite">{{ state.message || $t('sync.progressTitle') }}</span>
</template>

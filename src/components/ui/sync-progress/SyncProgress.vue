<script setup lang="ts">
import type { SyncProgressState } from '@/types'
import { LAYERS } from '@/constants/layers'
import Card from '../card/Card.vue'
import Dialog from '../dialog/Dialog.vue'
import SyncProgressContent from './SyncProgressContent.vue'

withDefaults(defineProps<{
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
</script>

<template>
  <Dialog
    v-if="fullscreen"
    open
    presentation="center"
    tone="mandatory"
    close-policy="blocked"
    :show-close="false"
    :overlay-z-index="LAYERS.syncGate"
    :title="state.message || $t('sync.progressTitle')"
  >
    <SyncProgressContent :state="state" :show-title="false" :allow-cancel="allowCancel" @retry="emit('retry')" @cancel="emit('cancel')" />
  </Dialog>

  <Card v-else class="sync-progress w-full overflow-hidden p-4 sm:p-5">
    <SyncProgressContent :state="state" :allow-cancel="allowCancel" @retry="emit('retry')" @cancel="emit('cancel')" />
  </Card>
</template>

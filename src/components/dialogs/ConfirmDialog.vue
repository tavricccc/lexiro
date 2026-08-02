<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { LAYERS } from '@/constants/layers'
import { useUIStore } from '@/stores/ui'
import Button from '../ui/button/Button.vue'
import Dialog from '../ui/dialog/Dialog.vue'
import DialogFooter from '../ui/dialog/DialogFooter.vue'

const uiStore = useUIStore()
const {
  confirmOpen,
  confirmTitle,
  confirmMessage,
  confirmConfirmLabel,
  confirmCancelLabel,
  confirmDestructive,
} = storeToRefs(uiStore)
const { resolveConfirm } = uiStore
const { t } = useI18n()

const cancelText = computed(() => confirmCancelLabel.value || t('confirm.cancel'))
const confirmText = computed(() => confirmConfirmLabel.value || t('confirm.confirm'))
</script>

<template>
  <Dialog
    :open="confirmOpen"
    :title="confirmTitle"
    :description="confirmMessage"
    :show-close="false"
    presentation="center"
    :overlay-z-index="LAYERS.nestedDialog"
    width-class="max-w-md"
    @close="resolveConfirm(false)"
  >
    <template #footer>
      <DialogFooter>
        <Button variant="outline" @click="resolveConfirm(false)">
          {{ cancelText }}
        </Button>
        <Button
          :variant="confirmDestructive ? 'destructive' : 'default'"
          @click="resolveConfirm(true)"
        >
          {{ confirmText }}
        </Button>
      </DialogFooter>
    </template>
  </Dialog>
</template>

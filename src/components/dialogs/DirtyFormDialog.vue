<script setup lang="ts">
import type { DirtyFormDecision } from '@/stores/ui'
import { storeToRefs } from 'pinia'
import { LAYERS } from '@/constants/layers'
import { useUIStore } from '@/stores/ui'
import Button from '../ui/button/Button.vue'
import Dialog from '../ui/dialog/Dialog.vue'
import DialogFooter from '../ui/dialog/DialogFooter.vue'

const uiStore = useUIStore()
const { dirtyFormPromptOpen } = storeToRefs(uiStore)
const { resolveDirtyFormPrompt } = uiStore

function resolve(decision: DirtyFormDecision) {
  resolveDirtyFormPrompt(decision)
}
</script>

<template>
  <Dialog
    :open="dirtyFormPromptOpen"
    :title="$t('dirtyForm.title')"
    :description="$t('dirtyForm.message')"
    :show-close="false"
    presentation="center"
    tone="mandatory"
    :overlay-z-index="LAYERS.nestedDialog"
    width-class="max-w-md"
    @close="resolve('cancel')"
  >
    <template #footer>
      <DialogFooter>
        <Button variant="ghost" @click="resolve('cancel')">
          {{ $t('dirtyForm.cancel') }}
        </Button>
        <Button variant="destructive" @click="resolve('discard')">
          {{ $t('dirtyForm.discard') }}
        </Button>
        <Button variant="default" @click="resolve('save')">
          {{ $t('dirtyForm.save') }}
        </Button>
      </DialogFooter>
    </template>
  </Dialog>
</template>

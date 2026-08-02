<script setup lang="ts">
import Button from '../ui/button/Button.vue'
import DialogFooter from '../ui/dialog-footer/DialogFooter.vue'
import Dialog from '../ui/dialog/Dialog.vue'
import Input from '../ui/input/Input.vue'
import StatusMessage from '../ui/status-message/StatusMessage.vue'
import Textarea from '../ui/textarea/Textarea.vue'

defineProps<{
  senseOpen: boolean
  sensePos: string
  senseMeaning: string
  exampleOpen: boolean
  exampleValue: string
  error: string
}>()

const emit = defineEmits<{
  'close-sense': []
  'close-example': []
  'update:sensePos': [value: string]
  'update:senseMeaning': [value: string]
  'update:exampleValue': [value: string]
  'save-sense': []
  'save-example': []
}>()
</script>

<template>
  <Dialog :open="senseOpen" :title="$t('vocabulary.editSense')" @close="emit('close-sense')">
    <div class="space-y-4">
      <StatusMessage v-if="error" tone="error">
        {{ error }}
      </StatusMessage>
      <label class="block text-sm font-bold">
        {{ $t('editor.pos') }}
        <Input :model-value="sensePos" class="mt-2" @update:model-value="emit('update:sensePos', $event)" />
      </label>
      <label class="block text-sm font-bold">
        {{ $t('editor.meaning') }}
        <Input :model-value="senseMeaning" class="mt-2" @update:model-value="emit('update:senseMeaning', $event)" />
      </label>
      <DialogFooter>
        <Button variant="outline" @click="emit('close-sense')">
          {{ $t('editor.cancel') }}
        </Button>
        <Button @click="emit('save-sense')">
          {{ $t('editor.save') }}
        </Button>
      </DialogFooter>
    </div>
  </Dialog>

  <Dialog :open="exampleOpen" :title="$t('vocabulary.editExample')" @close="emit('close-example')">
    <div class="space-y-4">
      <StatusMessage v-if="error" tone="error">
        {{ error }}
      </StatusMessage>
      <Textarea :model-value="exampleValue" :rows="4" :placeholder="$t('editor.examplePlaceholder')" @update:model-value="emit('update:exampleValue', $event)" />
      <DialogFooter>
        <Button variant="outline" @click="emit('close-example')">
          {{ $t('editor.cancel') }}
        </Button>
        <Button @click="emit('save-example')">
          {{ $t('editor.save') }}
        </Button>
      </DialogFooter>
    </div>
  </Dialog>
</template>

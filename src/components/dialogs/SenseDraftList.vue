<script setup lang="ts">
import type { EditorSenseDraft } from '@/types'
import { Plus, Trash2 } from 'lucide-vue-next'
import { ref } from 'vue'
import { createBlankSenseDraft } from '@/lib/validation'
import Button from '../ui/button/Button.vue'
import Dialog from '../ui/dialog/Dialog.vue'
import DialogFooter from '../ui/dialog/DialogFooter.vue'
import Input from '../ui/input/Input.vue'
import StatusMessage from '../ui/status-message/StatusMessage.vue'
import Textarea from '../ui/textarea/Textarea.vue'

const props = defineProps<{ senses: EditorSenseDraft[] }>()

const emit = defineEmits<{
  'update:senses': [value: EditorSenseDraft[]]
}>()

const newSenseDialogOpen = ref(false)
const newSensePos = ref('')
const newSenseMeaning = ref('')
const newSenseExample = ref('')
const newSenseError = ref('')

function updateSense(index: number, patch: Partial<EditorSenseDraft>) {
  emit('update:senses', props.senses.map((sense, senseIndex) => senseIndex === index ? { ...sense, ...patch } : sense))
}

function openNewSenseDialog() {
  newSensePos.value = ''
  newSenseMeaning.value = ''
  newSenseExample.value = ''
  newSenseError.value = ''
  newSenseDialogOpen.value = true
}

function saveNewSense() {
  const pos = newSensePos.value.trim()
  const meaning = newSenseMeaning.value.trim()
  if (!pos || !meaning) {
    newSenseError.value = 'senseFieldsRequired'
    return
  }
  const sense = createBlankSenseDraft()
  emit('update:senses', [...props.senses, {
    ...sense,
    pos,
    meaning,
    examples: newSenseExample.value.trim() ? [newSenseExample.value.trim()] : [],
  }])
  newSenseDialogOpen.value = false
}

function removeSense(index: number) {
  emit('update:senses', props.senses.filter((_, senseIndex) => senseIndex !== index))
}

function addExample(senseIndex: number) {
  const sense = props.senses[senseIndex]
  if (sense)
    updateSense(senseIndex, { examples: [...sense.examples, ''] })
}

function updateExample(senseIndex: number, exampleIndex: number, value: string) {
  const sense = props.senses[senseIndex]
  if (sense)
    updateSense(senseIndex, { examples: sense.examples.map((example, index) => index === exampleIndex ? value : example) })
}

function removeExample(senseIndex: number, exampleIndex: number) {
  const sense = props.senses[senseIndex]
  if (sense)
    updateSense(senseIndex, { examples: sense.examples.filter((_, index) => index !== exampleIndex) })
}
</script>

<template>
  <div class="space-y-3">
    <div v-for="(sense, senseIndex) in senses" :key="sense.id" class="rounded-2xl border border-ink-200/60 bg-ink-50/50 p-4 dark:border-ink-200/15 dark:bg-ink-950/30">
      <div class="mb-3 flex items-center justify-between gap-3">
        <p class="text-xs font-black uppercase tracking-wider text-ink-500 dark:text-ink-400">
          {{ $t('editor.sense', { index: senseIndex + 1 }) }}
        </p>
        <Button variant="ghost" size="icon" class="h-11 w-11 text-red-500" :aria-label="$t('editor.removeSense')" @click="removeSense(senseIndex)">
          <Trash2 class="h-4 w-4" />
        </Button>
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="flex flex-col gap-1.5">
          <span class="text-xs font-semibold text-ink-500 dark:text-ink-400">{{ $t('editor.pos') }}</span>
          <Input :model-value="sense.pos" :placeholder="$t('import.manualPosPlaceholder')" @update:model-value="updateSense(senseIndex, { pos: $event })" />
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="text-xs font-semibold text-ink-500 dark:text-ink-400">{{ $t('editor.meaning') }}</span>
          <Input :model-value="sense.meaning" :placeholder="$t('import.manualMeaningPlaceholder')" @update:model-value="updateSense(senseIndex, { meaning: $event })" />
        </label>
      </div>
      <div class="mt-3 space-y-2">
        <div class="flex items-center justify-between gap-3">
          <span class="text-xs font-semibold text-ink-500 dark:text-ink-400">{{ $t('editor.examples') }}</span>
          <Button variant="ghost" size="sm" class="gap-1" @click="addExample(senseIndex)">
            <Plus class="h-3.5 w-3.5" />{{ $t('editor.addExample') }}
          </Button>
        </div>
        <div v-if="sense.examples.length" class="space-y-2">
          <div v-for="(example, exampleIndex) in sense.examples" :key="`${sense.id}-${exampleIndex}`" class="flex items-start gap-2">
            <Textarea :model-value="example" :rows="2" class="min-w-0" :placeholder="$t('editor.examplePlaceholder')" @update:model-value="updateExample(senseIndex, exampleIndex, $event)" />
            <Button variant="ghost" size="icon" class="h-11 w-11 shrink-0 text-red-500" :aria-label="$t('editor.removeExample')" @click="removeExample(senseIndex, exampleIndex)">
              <Trash2 class="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p v-else class="text-xs font-medium text-ink-400">
          {{ $t('editor.noExamples') }}
        </p>
      </div>
    </div>
    <Button variant="outline" class="w-full gap-2 border-dashed" @click="openNewSenseDialog">
      <Plus class="h-4 w-4" />{{ $t('editor.addSense') }}
    </Button>
    <Dialog :open="newSenseDialogOpen" :title="$t('editor.addSense')" @close="newSenseDialogOpen = false">
      <div class="space-y-4">
        <StatusMessage v-if="newSenseError" tone="error">
          {{ $t(`editor.${newSenseError}`) }}
        </StatusMessage>
        <label class="block text-sm font-bold">
          {{ $t('editor.pos') }}
          <Input v-model="newSensePos" class="mt-2" :placeholder="$t('import.manualPosPlaceholder')" />
        </label>
        <label class="block text-sm font-bold">
          {{ $t('editor.meaning') }}
          <Input v-model="newSenseMeaning" class="mt-2" :placeholder="$t('import.manualMeaningPlaceholder')" />
        </label>
        <label class="block text-sm font-bold">
          {{ $t('editor.example') }}
          <Textarea v-model="newSenseExample" class="mt-2" :rows="3" :placeholder="$t('editor.examplePlaceholder')" />
        </label>
      </div>
      <template #footer>
        <DialogFooter>
          <Button variant="outline" @click="newSenseDialogOpen = false">
            {{ $t('editor.cancel') }}
          </Button>
          <Button @click="saveNewSense">
            {{ $t('editor.save') }}
          </Button>
        </DialogFooter>
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import type { WordDraft } from '@/types'
import { Plus, Trash2 } from 'lucide-vue-next'
import Button from '../ui/button/Button.vue'
import Input from '../ui/input/Input.vue'
import Textarea from '../ui/textarea/Textarea.vue'

const props = defineProps<{ modelValue: WordDraft[] }>()

const emit = defineEmits<{
  'update:modelValue': [value: WordDraft[]]
}>()

function updateItem(index: number, patch: Partial<WordDraft>) {
  emit('update:modelValue', props.modelValue.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item))
}

function addItem() {
  emit('update:modelValue', [...props.modelValue, { word: '', pos: '', meaning: '' }])
}

function removeItem(index: number) {
  const next = props.modelValue.filter((_, itemIndex) => itemIndex !== index)
  emit('update:modelValue', next.length ? next : [{ word: '', pos: '', meaning: '' }])
}
</script>

<template>
  <div class="space-y-3">
    <div
      v-for="(item, index) in modelValue"
      :key="index"
      class="rounded-2xl border border-ink-200/70 bg-white/70 p-4 dark:border-ink-200/20 dark:bg-ink-900/50"
    >
      <div class="mb-3 flex items-center justify-between gap-3">
        <p class="text-xs font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">
          {{ $t('import.wordRow', { index: index + 1 }) }}
        </p>
        <Button variant="ghost" size="icon" class="h-8 w-8 text-red-500" :aria-label="$t('import.removeWord')" @click="removeItem(index)">
          <Trash2 class="h-4 w-4" />
        </Button>
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-semibold text-ink-500 dark:text-ink-400">{{ $t('editor.word') }}</label>
          <Input :model-value="item.word" :placeholder="$t('import.manualWordPlaceholder')" @update:model-value="updateItem(index, { word: $event })" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-semibold text-ink-500 dark:text-ink-400">{{ $t('editor.pos') }}</label>
          <Input :model-value="item.pos" :placeholder="$t('import.manualPosPlaceholder')" @update:model-value="updateItem(index, { pos: $event })" />
        </div>
        <div class="flex flex-col gap-1.5 sm:col-span-2">
          <label class="text-xs font-semibold text-ink-500 dark:text-ink-400">{{ $t('editor.meaning') }}</label>
          <Textarea :model-value="item.meaning" :rows="2" :placeholder="$t('import.manualMeaningPlaceholder')" @update:model-value="updateItem(index, { meaning: $event })" />
        </div>
      </div>
    </div>

    <Button variant="outline" class="w-full gap-2 border-dashed" @click="addItem">
      <Plus class="h-4 w-4" />
      {{ $t('import.addWord') }}
    </Button>
  </div>
</template>

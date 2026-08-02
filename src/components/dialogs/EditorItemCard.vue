<script setup lang="ts">
import type { EditorItem } from '@/types'
import { Trash2 } from 'lucide-vue-next'
import Button from '../ui/button/Button.vue'
import Input from '../ui/input/Input.vue'
import SenseDraftList from './SenseDraftList.vue'

defineProps<{
  item: EditorItem
  itemIndex: number
}>()

const emit = defineEmits<{
  'remove': []
  'update:item': [item: EditorItem]
}>()

function updateItem(item: EditorItem, patch: Partial<EditorItem>) {
  emit('update:item', { ...item, ...patch })
}
</script>

<template>
  <div class="rounded-2xl border border-ink-200/80 bg-white/80 p-4 text-left shadow-sm dark:border-ink-200/25 dark:bg-ink-900/70 sm:p-5">
    <div class="flex items-center justify-between gap-4 border-b border-ink-200/70 pb-3 dark:border-ink-200/20">
      <p class="text-sm font-extrabold text-ink-950 dark:text-ink-50">
        {{ $t('editor.word') }} {{ itemIndex + 1 }}
      </p>
      <Button variant="ghost" size="icon" class="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20" :aria-label="$t('editor.removeWord')" @click="$emit('remove')">
        <Trash2 class="h-4 w-4" />
      </Button>
    </div>

    <div class="mt-4">
      <div class="flex flex-col gap-1.5">
        <label class="text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">{{ $t('editor.word') }}</label>
        <Input :model-value="item.word" :placeholder="$t('editor.word')" @update:model-value="updateItem(item, { word: $event })" />
      </div>
      <SenseDraftList class="mt-4" :senses="item.senses" @update:senses="senses => updateItem(item, { senses })" />
    </div>
  </div>
</template>

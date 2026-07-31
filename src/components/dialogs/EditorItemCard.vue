<script setup lang="ts">
import type { EditorItem } from '@/types'
import { Star, Trash2 } from 'lucide-vue-next'
import Button from '../ui/button/Button.vue'
import Input from '../ui/input/Input.vue'
import Textarea from '../ui/textarea/Textarea.vue'

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
      <Button variant="ghost" size="icon" class="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20" @click="$emit('remove')">
        <Trash2 class="h-4 w-4" />
      </Button>
    </div>

    <div class="mt-4 grid gap-4 sm:grid-cols-2">
      <div class="flex flex-col gap-1.5">
        <label class="text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">{{ $t('editor.word') }}</label>
        <Input :model-value="item.word" :placeholder="$t('editor.word')" @update:model-value="updateItem(item, { word: $event })" />
      </div>
      <div class="flex flex-col gap-1.5">
        <label class="text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">{{ $t('editor.pos') }}</label>
        <Input :model-value="item.pos" :placeholder="$t('editor.pos')" @update:model-value="updateItem(item, { pos: $event })" />
      </div>
      <div class="flex flex-col gap-1.5 sm:col-span-2">
        <label class="text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">{{ $t('editor.meaning') }}</label>
        <Textarea :model-value="item.meaning" :rows="2" :placeholder="$t('editor.meaning')" @update:model-value="updateItem(item, { meaning: $event })" />
      </div>
      <div class="flex flex-col gap-1.5 sm:col-span-2">
        <label class="text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">{{ $t('editor.example') }}</label>
        <Textarea :model-value="item.example" :rows="2" :placeholder="$t('editor.example')" @update:model-value="updateItem(item, { example: $event })" />
      </div>
      <details class="sm:col-span-2 rounded-xl border border-ink-200/60 bg-ink-50/50 p-3 dark:border-ink-200/15 dark:bg-ink-950/20">
        <summary class="cursor-pointer text-xs font-bold text-ink-500 dark:text-ink-400">
          {{ $t('editor.advancedFields') }}
        </summary>
        <div class="mt-3 grid gap-4 sm:grid-cols-2">
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">{{ $t('editor.tags') }}</label>
            <Input :model-value="item.tags?.join(', ') ?? ''" :placeholder="$t('editor.tagsPlaceholder')" @update:model-value="updateItem(item, { tags: $event.split(',').map(tag => tag.trim()).filter(Boolean) })" />
          </div>
          <div class="flex items-end">
            <Button type="button" variant="outline" class="gap-2" :class="item.favorite ? 'border-amber-400 text-amber-600' : ''" :aria-pressed="item.favorite" @click="updateItem(item, { favorite: !item.favorite })">
              <Star class="h-4 w-4" :class="item.favorite ? 'fill-current' : ''" />
              {{ item.favorite ? $t('editor.favoriteOn') : $t('editor.favoriteOff') }}
            </Button>
          </div>
        </div>
      </details>
    </div>
  </div>
</template>

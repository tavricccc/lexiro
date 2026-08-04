<script setup lang="ts">
import type { WordSense } from '@/types'
import { Pencil, Trash2 } from 'lucide-vue-next'
import Badge from '../ui/badge/Badge.vue'
import Button from '../ui/button/Button.vue'
import ExampleList from './ExampleList.vue'

const props = withDefaults(defineProps<{
  sense: WordSense
  editable?: boolean
  setNames?: string
}>(), {
  editable: false,
  setNames: '',
})

const emit = defineEmits<{
  'edit': [sense: WordSense]
  'delete': [sense: WordSense]
  'edit-example': [sense: WordSense, index: number]
  'add-example': [sense: WordSense]
  'delete-example': [sense: WordSense, index: number]
}>()
</script>

<template>
  <article class="py-3 text-left border-b border-ink-200/50 last:border-b-0 dark:border-ink-800/50">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {{ sense.pos }}
          </Badge>
          <h3 class="font-black text-ink-950 dark:text-ink-50">
            {{ sense.meaningZh }}
          </h3>
        </div>
        <p v-if="props.setNames" class="mt-2 text-xs font-semibold text-ink-500">
          {{ props.setNames }} · {{ $t('vocabulary.readOnly') }}
        </p>
        <div class="mt-3">
          <ExampleList
            :examples="sense.examples"
            :editable="props.editable"
            @edit="emit('edit-example', sense, $event)"
            @add="emit('add-example', sense)"
            @delete="emit('delete-example', sense, $event)"
          />
        </div>
      </div>
      <div v-if="props.editable" class="flex shrink-0 gap-1">
        <Button variant="ghost" size="icon" class="h-11 w-11" :aria-label="$t('vocabulary.editSense')" @click="emit('edit', sense)">
          <Pencil class="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" class="h-11 w-11 text-red-500" :aria-label="$t('vocabulary.deleteSense')" @click="emit('delete', sense)">
          <Trash2 class="h-4 w-4" />
        </Button>
      </div>
    </div>
  </article>
</template>

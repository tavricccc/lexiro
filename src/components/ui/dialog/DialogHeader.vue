<script setup lang="ts">
import { X } from 'lucide-vue-next'
import Button from '../button/Button.vue'

defineProps<{
  title?: string
  description?: string
  titleId?: string
  descriptionId?: string
  showClose?: boolean
}>()

defineEmits<{
  close: []
}>()
</script>

<template>
  <div class="flex shrink-0 items-start justify-between gap-3 px-5 pt-4 pb-3">
    <div class="space-y-1 text-left">
      <h2 v-if="title" :id="titleId" class="text-lg font-bold tracking-tight text-ink-950 dark:text-ink-50">
        {{ title }}
      </h2>
      <p v-if="description" :id="descriptionId" class="text-xs font-medium leading-relaxed text-ink-500 dark:text-ink-400">
        {{ description }}
      </p>
    </div>
    <Button
      v-if="showClose"
      variant="ghost"
      size="icon"
      class="h-11 w-11 shrink-0 rounded-xl hover:bg-ink-200 dark:hover:bg-ink-200/60"
      :aria-label="$t('editor.cancel')"
      @click="$emit('close')"
    >
      <X class="h-4.5 w-4.5 text-ink-500 dark:text-ink-400" />
    </Button>
  </div>
</template>

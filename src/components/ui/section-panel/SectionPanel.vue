<script setup lang="ts">
import { cn } from '@/lib/cn'

withDefaults(defineProps<{
  title?: string
  description?: string
  class?: string
}>(), {
  title: '',
  description: '',
  class: '',
})
</script>

<template>
  <section :class="cn('surface-card p-4 sm:p-5 text-left', $props.class)">
    <div v-if="title || description || $slots.action" class="mb-4 flex items-start justify-between gap-4">
      <div class="min-w-0">
        <p v-if="title" class="text-sm font-extrabold text-ink-950 dark:text-ink-50">
          {{ title }}
        </p>
        <p v-if="description" class="mt-1 text-xs font-medium leading-relaxed text-ink-500 dark:text-ink-400">
          {{ description }}
        </p>
      </div>
      <slot name="action" />
    </div>
    <slot />
  </section>
</template>

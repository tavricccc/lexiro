<script setup lang="ts">
import { cn } from '@/lib/cn'

defineProps<{
  class?: string
}>()
</script>

<template>
  <div :class="cn('flex flex-col-reverse gap-2 border-t border-ink-200/70 pt-4 dark:border-ink-200/20 sm:flex-row sm:justify-end [&>button]:w-full sm:[&>button]:w-auto', $props.class)">
    <slot />
  </div>
</template>

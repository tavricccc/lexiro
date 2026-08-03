<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/cn'

const props = withDefaults(defineProps<{
  modelValue?: number
  class?: string
}>(), {
  modelValue: 0,
  class: '',
})

const scale = computed(() => Math.max(0, Math.min(100, props.modelValue)) / 100)
</script>

<template>
  <div
    role="progressbar"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-valuenow="Math.round(scale * 100)"
    :class="cn('relative h-1.5 w-full overflow-hidden rounded-full bg-ink-200/80 dark:bg-ink-800', $props.class)"
  >
    <div class="h-full w-full origin-left rounded-full bg-accent-primary transition-transform duration-300 motion-reduce:transition-none" :style="{ transform: `scaleX(${scale})` }" />
  </div>
</template>

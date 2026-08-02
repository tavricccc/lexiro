<script setup lang="ts">
import { cn } from '@/lib/cn'

defineProps<{
  class?: string
}>()
</script>

<template>
  <div :class="cn('dialog-scroll-region min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6 pt-1 text-left', $props.class)">
    <slot />
  </div>
</template>

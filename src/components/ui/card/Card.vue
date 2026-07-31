<script setup lang="ts">
import { cn } from '@/lib/cn'

defineProps<{
  class?: string
}>()
</script>

<template>
  <div :class="cn('surface-card relative overflow-hidden', $props.class)">
    <slot />
  </div>
</template>

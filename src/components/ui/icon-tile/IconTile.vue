<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/cn'

const props = withDefaults(defineProps<{
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  class?: string
}>(), {
  tone: 'neutral',
  size: 'md',
  class: '',
})

const classes = computed(() => cn(
  'icon-tile',
  `icon-tile--${props.size}`,
  props.tone !== 'neutral' && `icon-tile--${props.tone}`,
  props.class,
))
</script>

<template>
  <div :class="classes" aria-hidden="true">
    <slot />
  </div>
</template>

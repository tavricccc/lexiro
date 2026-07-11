<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/cn'

const props = withDefaults(defineProps<{
  score: number
  size?: number
  class?: string
}>(), {
  size: 88,
  class: '',
})

const radius = computed(() => (props.size - 10) / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)
const offset = computed(() => {
  const clamped = Math.max(0, Math.min(100, props.score))
  return circumference.value * (1 - clamped / 100)
})

const toneClass = computed(() => {
  if (props.score >= 90)
    return 'text-emerald-500'
  if (props.score >= 60)
    return 'text-accent-primary'
  return 'text-amber-500'
})
</script>

<template>
  <div
    :class="cn('relative inline-flex items-center justify-center', props.class)"
    :style="{ width: `${size}px`, height: `${size}px` }"
    role="img"
    :aria-label="$t('result.score', { score })"
  >
    <svg :width="size" :height="size" class="-rotate-90" aria-hidden="true">
      <circle
        class="text-ink-200/80 dark:text-ink-200/20"
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="none"
        stroke="currentColor"
        stroke-width="8"
      />
      <circle
        class="score-ring-progress"
        :class="toneClass"
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="none"
        stroke="currentColor"
        stroke-width="8"
        stroke-linecap="round"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="offset"
      />
    </svg>
    <div class="absolute inset-0 flex flex-col items-center justify-center">
      <span class="text-xl font-extrabold tabular-nums tracking-tight text-ink-950 dark:text-ink-50">
        {{ score }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { LoaderCircle } from 'lucide-vue-next'
import { computed, useAttrs } from 'vue'
import { cn } from '@/lib/cn'

const props = withDefaults(defineProps<{
  variant?: 'default' | 'outline' | 'ghost' | 'link' | 'secondary' | 'destructive'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  loading?: boolean
  disabled?: boolean
  class?: string
  type?: 'button' | 'submit' | 'reset'
  title?: string
}>(), {
  variant: 'default',
  size: 'default',
  loading: false,
  disabled: false,
  class: '',
  type: 'button',
  title: undefined,
})

const attrs = useAttrs()

const classes = computed(() =>
  cn(
    'relative inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap text-sm font-semibold rounded-[var(--radius-inner)] transition-[color,background-color,border-color,box-shadow,opacity] duration-200 outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/20 disabled:opacity-40 disabled:pointer-events-none disabled:cursor-not-allowed',
    {
      'button-primary': props.variant === 'default',
      'surface-control text-ink-600 dark:text-ink-300 hover:border-ink-400': props.variant === 'outline' || props.variant === 'secondary',
      'text-accent-primary hover:bg-ink-100 dark:hover:bg-ink-850': props.variant === 'ghost',
      'text-accent-primary underline-offset-4 hover:underline': props.variant === 'link',
      'bg-red-50 dark:bg-red-950/15 text-red-600 dark:text-red-400 border border-red-100/80 dark:border-red-900/30 hover:bg-red-100/80 dark:hover:bg-red-950/30': props.variant === 'destructive',

      'px-4 py-2.5': props.size === 'default',
      'min-h-8 px-3 py-1.5 text-xs rounded-[calc(var(--radius-inner)-0.25rem)]': props.size === 'sm',
      'h-11 w-11 min-h-11 p-0 rounded-[var(--radius-inner)]': props.size === 'icon',
      'min-h-11 px-6 py-2.5 text-sm': props.size === 'lg',
    },
    props.class,
  ),
)
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :aria-busy="loading"
    :title="title || (size === 'icon' ? String(attrs['aria-label'] ?? '') : undefined)"
    :class="classes"
  >
    <LoaderCircle v-if="loading" class="absolute h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
    <span class="inline-flex items-center justify-center gap-1.5" :class="{ 'opacity-0': loading }"><slot /></span>
  </button>
</template>

<script setup lang="ts">
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
    'inline-flex min-h-11 items-center justify-center gap-2.5 whitespace-nowrap text-sm font-semibold rounded-[var(--radius-inner)] transition-all duration-200 active:scale-[0.97] outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/20 disabled:opacity-40 disabled:pointer-events-none disabled:cursor-not-allowed',
    {
      'button-primary': props.variant === 'default',
      'surface-control text-ink-600 dark:text-ink-300 hover:-translate-y-px hover:shadow-floating': props.variant === 'outline' || props.variant === 'secondary',
      'text-accent-primary hover:bg-ink-100 dark:hover:bg-ink-850': props.variant === 'ghost',
      'text-accent-primary underline-offset-4 hover:underline active:scale-100': props.variant === 'link',
      'bg-red-50 dark:bg-red-950/15 text-red-600 dark:text-red-400 border border-red-100/80 dark:border-red-900/30 hover:bg-red-100/80 dark:hover:bg-red-950/30': props.variant === 'destructive',

      'px-4 py-2.5': props.size === 'default',
      'min-h-9 px-4 py-1.5 text-xs rounded-[calc(var(--radius-inner)-0.25rem)]': props.size === 'sm',
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
    :title="title || (size === 'icon' ? String(attrs['aria-label'] ?? '') : undefined)"
    :class="classes"
  >
    <svg v-if="loading" class="animate-spin h-4 w-4 text-current shrink-0" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
    <slot />
  </button>
</template>

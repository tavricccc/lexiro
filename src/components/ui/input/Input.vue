<script setup lang="ts">
import { ref } from 'vue'
import { cn } from '@/lib/cn'

withDefaults(defineProps<{
  modelValue?: string
  class?: string
  placeholder?: string
  type?: string
  disabled?: boolean
}>(), {
  modelValue: '',
  class: '',
  placeholder: '',
  type: 'text',
  disabled: false,
})
defineEmits<{
  'update:modelValue': [value: string]
}>()

const el = ref<HTMLInputElement | null>(null)

function focus() {
  el.value?.focus()
}

defineExpose({ focus, el })
</script>

<template>
  <input
    ref="el"
    :type="type"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :class="
      cn(
        'surface-control min-h-11 w-full px-4 py-3 text-ink-950 dark:text-ink-50 text-sm placeholder-ink-400 dark:placeholder-ink-600 focus:outline-none focus:ring-2 focus:ring-accent-primary/20 disabled:cursor-not-allowed disabled:opacity-40 transition-all duration-200',
        $props.class,
      )
    "
    @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  >
</template>

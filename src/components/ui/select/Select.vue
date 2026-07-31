<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'
import { Check, ChevronDown } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { cn } from '@/lib/cn'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

const props = withDefaults(
  defineProps<{
    modelValue?: string
    options: SelectOption[]
    placeholder?: string
    disabled?: boolean
    class?: string
  }>(),
  {
    modelValue: '',
    placeholder: '',
    disabled: false,
    class: '',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'change': [value: string]
}>()

const isOpen = ref(false)
const containerRef = ref<HTMLElement | null>(null)

onClickOutside(containerRef, () => {
  isOpen.value = false
})

const selectedOption = computed(() => props.options.find(opt => opt.value === props.modelValue))

function toggle() {
  if (props.disabled)
    return
  isOpen.value = !isOpen.value
}

function select(option: SelectOption) {
  if (option.disabled)
    return
  emit('update:modelValue', option.value)
  emit('change', option.value)
  isOpen.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (props.disabled)
    return
  if (e.key === 'Escape') {
    isOpen.value = false
  }
  else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    isOpen.value = !isOpen.value
  }
}
</script>

<template>
  <div ref="containerRef" class="relative inline-block w-full text-left">
    <button
      type="button"
      :disabled="disabled"
      :class="
        cn(
          'surface-control flex min-h-11 w-full items-center justify-between gap-2 px-4 py-2.5 text-sm font-bold text-ink-950 dark:text-ink-50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent-primary/20 disabled:cursor-not-allowed disabled:opacity-40',
          isOpen ? 'ring-2 ring-accent-primary/30 border-accent-primary' : '',
          props.class,
        )
      "
      @click="toggle"
      @keydown="onKeydown"
    >
      <span v-if="selectedOption" class="truncate">
        {{ selectedOption.label }}
      </span>
      <span v-else class="truncate text-ink-400 dark:text-ink-600 font-semibold">
        {{ placeholder }}
      </span>
      <ChevronDown
        class="h-4 w-4 shrink-0 text-ink-400 transition-transform duration-200"
        :class="isOpen ? 'rotate-180 text-accent-primary' : ''"
      />
    </button>

    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="transform scale-95 opacity-0 -translate-y-1"
      enter-to-class="transform scale-100 opacity-100 translate-y-0"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="transform scale-100 opacity-100 translate-y-0"
      leave-to-class="transform scale-95 opacity-0 -translate-y-1"
    >
      <div
        v-if="isOpen"
        class="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-60 overflow-y-auto rounded-2xl border border-ink-200/80 bg-white/95 p-1.5 shadow-floating backdrop-blur-xl dark:border-ink-700/80 dark:bg-ink-950/95"
        role="listbox"
      >
        <button
          v-for="option in options"
          :key="option.value"
          type="button"
          :disabled="option.disabled"
          class="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-bold transition-all duration-150"
          :class="[
            option.disabled
              ? 'cursor-not-allowed opacity-40'
              : 'hover:bg-ink-100/80 dark:hover:bg-ink-800/80 cursor-pointer',
            option.value === modelValue
              ? 'bg-accent-primary/10 text-accent-primary dark:bg-accent-primary/20'
              : 'text-ink-800 dark:text-ink-200',
          ]"
          @click="select(option)"
        >
          <span class="truncate">{{ option.label }}</span>
          <Check v-if="option.value === modelValue" class="h-4 w-4 shrink-0 text-accent-primary" />
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'
import { Check, ChevronDown } from 'lucide-vue-next'
import { computed, inject, nextTick, onUnmounted, ref, useId, watch } from 'vue'
import { DIALOG_CONTENT_LAYER_KEY, LAYERS } from '@/constants/layers'
import { cn } from '@/lib/cn'
import { useFloatingPanel } from '@/lib/floating-panel'

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
const activeIndex = ref(-1)
const containerRef = ref<HTMLElement | null>(null)
const idPrefix = useId().replace(/:/g, '-')
const listboxId = `${idPrefix}-listbox`
const typeahead = ref('')
let typeaheadTimer: number | undefined

const {
  triggerRef,
  panelRef,
  floatingStyle,
  activate,
  deactivate,
  refresh,
} = useFloatingPanel({ matchTriggerWidth: true, maxHeight: 240 })
const dialogContentLayer = inject(DIALOG_CONTENT_LAYER_KEY, null)
const panelStyle = computed(() => ({
  ...floatingStyle.value,
  zIndex: dialogContentLayer?.value ?? LAYERS.popover,
}))

function setTriggerRef(element: unknown) {
  triggerRef.value = element instanceof HTMLElement ? element : null
}

function setPanelRef(element: unknown) {
  panelRef.value = element instanceof HTMLElement ? element : null
}

const selectedOption = computed(() => props.options.find(option => option.value === props.modelValue))
const enabledIndexes = computed(() => props.options
  .map((option, index) => option.disabled ? -1 : index)
  .filter(index => index >= 0))
const activeOptionId = computed(() => activeIndex.value >= 0 ? optionId(activeIndex.value) : undefined)

function optionId(index: number): string {
  return `${idPrefix}-option-${index}`
}

function setInitialActive() {
  const selectedIndex = props.options.findIndex(option => option.value === props.modelValue && !option.disabled)
  activeIndex.value = selectedIndex >= 0 ? selectedIndex : enabledIndexes.value[0] ?? -1
}

function close() {
  isOpen.value = false
}

onClickOutside(containerRef, close, { ignore: [panelRef] })

watch(isOpen, async (open) => {
  if (!open) {
    deactivate()
    return
  }
  activate()
  await nextTick()
  refresh()
})

function toggle() {
  if (props.disabled)
    return
  if (!isOpen.value)
    setInitialActive()
  isOpen.value = !isOpen.value
}

function select(option: SelectOption) {
  if (option.disabled)
    return
  emit('update:modelValue', option.value)
  emit('change', option.value)
  close()
}

function moveActive(direction: 1 | -1) {
  const indexes = enabledIndexes.value
  if (!indexes.length)
    return
  const currentPosition = indexes.indexOf(activeIndex.value)
  const nextPosition = currentPosition < 0
    ? direction > 0 ? 0 : indexes.length - 1
    : (currentPosition + direction + indexes.length) % indexes.length
  activeIndex.value = indexes[nextPosition]
}

function searchTypeahead(character: string) {
  typeahead.value = `${typeahead.value}${character.toLocaleLowerCase()}`
  const matchIndex = props.options.findIndex(option => !option.disabled
    && option.label.toLocaleLowerCase().startsWith(typeahead.value))
  if (matchIndex >= 0)
    activeIndex.value = matchIndex
  window.clearTimeout(typeaheadTimer)
  typeaheadTimer = window.setTimeout(() => {
    typeahead.value = ''
  }, 500)
}

function onKeydown(event: KeyboardEvent) {
  if (props.disabled)
    return

  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }

  if (event.key === 'Tab') {
    close()
    return
  }

  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    if (!isOpen.value) {
      setInitialActive()
      isOpen.value = true
    }
    else {
      moveActive(event.key === 'ArrowDown' ? 1 : -1)
    }
    return
  }

  if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault()
    if (!isOpen.value)
      isOpen.value = true
    const indexes = enabledIndexes.value
    activeIndex.value = event.key === 'Home' ? indexes[0] ?? -1 : indexes.at(-1) ?? -1
    return
  }

  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    if (!isOpen.value) {
      setInitialActive()
      isOpen.value = true
    }
    else if (activeIndex.value >= 0) {
      const option = props.options[activeIndex.value]
      if (option)
        select(option)
    }
    return
  }

  if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
    if (!isOpen.value)
      isOpen.value = true
    searchTypeahead(event.key)
  }
}

onUnmounted(() => {
  if (typeof window !== 'undefined')
    window.clearTimeout(typeaheadTimer)
})
</script>

<template>
  <div ref="containerRef" class="inline-block w-full text-left">
    <button
      :ref="setTriggerRef"
      type="button"
      role="combobox"
      aria-haspopup="listbox"
      :disabled="disabled"
      :aria-expanded="isOpen"
      :aria-controls="isOpen ? listboxId : undefined"
      :aria-activedescendant="isOpen ? activeOptionId : undefined"
      :class="
        cn(
          'surface-control flex min-h-11 w-full items-center justify-between gap-2 px-4 py-2.5 text-sm font-bold text-ink-950 dark:text-ink-50 transition-[color,background-color,border-color,box-shadow,opacity] duration-200 focus:outline-none focus:ring-2 focus-visible:ring-accent-primary/20 disabled:cursor-not-allowed disabled:opacity-40',
          isOpen ? 'ring-2 ring-accent-primary/30 border-accent-primary' : '',
          props.class,
        )
      "
      @click="toggle"
      @keydown="onKeydown"
      @blur="close"
    >
      <span v-if="selectedOption" class="truncate">{{ selectedOption.label }}</span>
      <span v-else class="truncate text-ink-400 dark:text-ink-600 font-semibold">{{ placeholder }}</span>
      <ChevronDown class="h-4 w-4 shrink-0 text-ink-400 transition-transform duration-200" :class="isOpen ? 'rotate-180 text-accent-primary' : ''" />
    </button>

    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="isOpen"
          :id="listboxId"
          :ref="setPanelRef"
          :style="panelStyle"
          class="max-h-60 overflow-y-auto rounded-2xl border border-ink-200/80 bg-white/95 p-1.5 text-left shadow-floating backdrop-blur-xl dark:border-ink-700/80 dark:bg-ink-950/95"
          role="listbox"
        >
          <div
            v-for="(option, index) in options"
            :id="optionId(index)"
            :key="option.value"
            role="option"
            :aria-selected="option.value === modelValue"
            :aria-disabled="option.disabled || undefined"
            class="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-bold transition-[color,background-color] duration-150"
            :class="[
              option.disabled
                ? 'cursor-not-allowed opacity-40'
                : 'cursor-pointer hover:bg-ink-100/80 dark:hover:bg-ink-800/80',
              index === activeIndex && !option.disabled
                ? 'ring-1 ring-accent-primary/25'
                : '',
              option.value === modelValue
                ? 'bg-accent-primary/10 text-accent-primary dark:bg-accent-primary/20'
                : 'text-ink-800 dark:text-ink-200',
            ]"
            @mousedown.prevent
            @click="select(option)"
          >
            <span class="truncate">{{ option.label }}</span>
            <Check v-if="option.value === modelValue" class="h-4 w-4 shrink-0 text-accent-primary" />
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

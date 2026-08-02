<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'
import { nextTick, onUnmounted, ref, useId, watch } from 'vue'
import { LAYERS } from '@/constants/layers'
import { useFloatingPanel } from '@/lib/floating-panel'

const props = withDefaults(defineProps<{
  open: boolean
  align?: 'start' | 'end'
  widthClass?: string
  maxHeight?: number
  panelClass?: string
}>(), {
  align: 'start',
  widthClass: 'w-64',
  maxHeight: 320,
  panelClass: '',
})

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const menuId = `menu-${useId().replace(/:/g, '-')}`
const previousActive = ref<HTMLElement | null>(null)
const {
  triggerRef,
  panelRef,
  floatingStyle,
  activate,
  deactivate,
  refresh,
} = useFloatingPanel({ placement: props.align === 'end' ? 'bottom-end' : 'bottom-start', maxHeight: props.maxHeight })

onClickOutside(triggerRef, close, { ignore: [panelRef] })

watch(() => props.open, async (open) => {
  if (!open) {
    deactivate()
    if (previousActive.value) {
      previousActive.value.focus({ preventScroll: true })
      previousActive.value = null
    }
    return
  }
  previousActive.value = document.activeElement instanceof HTMLElement ? document.activeElement : null
  activate()
  await nextTick()
  refresh()
})

function toggle() {
  emit('update:open', !props.open)
}

function close() {
  if (props.open)
    emit('update:open', false)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
  }
}

onUnmounted(deactivate)
</script>

<template>
  <div ref="triggerRef" class="shrink-0" @keydown.esc="close">
    <slot name="trigger" :open="open" :toggle="toggle" :close="close" :menu-id="menuId" />
  </div>

  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="scale-95 opacity-0 -translate-y-1"
      enter-to-class="scale-100 opacity-100 translate-y-0"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="scale-100 opacity-100 translate-y-0"
      leave-to-class="scale-95 opacity-0 -translate-y-1"
    >
      <div
        v-if="open"
        :id="menuId"
        ref="panelRef"
        :style="{ ...floatingStyle, zIndex: LAYERS.popover }"
        class="overflow-y-auto rounded-2xl border border-ink-200/80 bg-white/95 p-1.5 text-left shadow-floating backdrop-blur-xl dark:border-ink-700/80 dark:bg-ink-950/95"
        :class="[widthClass, panelClass]"
        role="menu"
        tabindex="-1"
        @keydown="onKeydown"
      >
        <slot :close="close" />
      </div>
    </Transition>
  </Teleport>
</template>

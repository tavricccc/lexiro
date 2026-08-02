<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { lockDocumentScroll } from '@/lib/scrollLock'
import Button from '../button/Button.vue'

const props = withDefaults(defineProps<{
  open: boolean
  title?: string
  description?: string
  widthClass?: string
  showClose?: boolean
  overlayZIndex?: number
}>(), {
  title: '',
  description: '',
  widthClass: 'max-w-lg',
  showClose: true,
  overlayZIndex: 50,
})

const emit = defineEmits<{
  close: []
}>()

const panelRef = ref<HTMLElement | null>(null)
let previousActive: HTMLElement | null = null
let releaseScrollLock: (() => void) | null = null

function getFocusable(): HTMLElement[] {
  if (!panelRef.value)
    return []
  const nodes = panelRef.value.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )
  return Array.from(nodes).filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null)
}

function onKeydown(e: KeyboardEvent) {
  if (!props.open)
    return

  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    emit('close')
    return
  }

  if (e.key === 'Backspace' && e.target instanceof HTMLElement && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && !e.target.isContentEditable) {
    e.preventDefault()
  }

  if (e.key === 'Tab') {
    const focusable = getFocusable()
    if (focusable.length === 0)
      return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    }
    else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }
}

function focusWithoutScrolling(element: HTMLElement | undefined) {
  element?.focus({ preventScroll: true })
}

function openDialog() {
  previousActive = document.activeElement instanceof HTMLElement ? document.activeElement : null
  releaseScrollLock?.()
  releaseScrollLock = lockDocumentScroll()

  nextTick(() => {
    focusWithoutScrolling(getFocusable()[0])
  })
}

function closeDialog() {
  releaseScrollLock?.()
  releaseScrollLock = null
  focusWithoutScrolling(previousActive ?? undefined)
  previousActive = null
}

watch(() => props.open, (open) => {
  if (open) {
    openDialog()
  }
  else {
    closeDialog()
  }
})

onMounted(() => {
  window.addEventListener('keydown', onKeydown, true)
  if (props.open)
    openDialog()
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown, true)
  closeDialog()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div
        v-if="open"
        class="dialog-overlay fixed inset-0 z-50 flex items-end justify-center overflow-y-auto overscroll-contain bg-black/35 p-0 backdrop-blur-sm sm:items-center sm:p-6"
        :style="{ zIndex: overlayZIndex }"
        role="presentation"
        @click.self="$emit('close')"
      >
        <div
          ref="panelRef"
          role="dialog"
          aria-modal="true"
          :aria-label="title || undefined"
          class="dialog-content-panel flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[22px] border border-ink-200/60 bg-white shadow-2xl dark:border-ink-200/10 dark:bg-ink-800 sm:max-h-[calc(100dvh-3rem)] sm:rounded-[22px]"
          :class="[widthClass]"
        >
          <div class="w-12 h-1.5 rounded-full bg-ink-200 dark:bg-ink-300 mx-auto mt-3 shrink-0 sm:hidden" aria-hidden="true" />

          <div class="flex shrink-0 items-start justify-between gap-4 px-6 pt-4 pb-3">
            <div class="space-y-1 text-left">
              <h2 class="text-lg font-bold tracking-tight text-ink-950 dark:text-ink-50">
                {{ title }}
              </h2>
              <p v-if="description" class="text-xs text-ink-500 dark:text-ink-400 leading-relaxed font-medium">
                {{ description }}
              </p>
            </div>
            <Button
              v-if="showClose"
              variant="ghost"
              size="icon"
              class="h-8 w-8 hover:bg-ink-200 dark:hover:bg-ink-200/60 rounded-xl shrink-0"
              :aria-label="$t('editor.cancel')"
              @click="$emit('close')"
            >
              <X class="h-4.5 w-4.5 text-ink-500 dark:text-ink-400" />
            </Button>
          </div>

          <div class="dialog-scroll-region overflow-y-auto overscroll-contain px-6 pb-6 pt-1 text-left">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

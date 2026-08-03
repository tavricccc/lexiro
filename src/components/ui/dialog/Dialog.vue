<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, provide, ref, useId, watch } from 'vue'
import { DIALOG_CONTENT_LAYER_KEY, LAYERS } from '@/constants/layers'
import { lockDocumentScroll } from '@/lib/scrollLock'
import DialogBody from './DialogBody.vue'
import DialogHeader from './DialogHeader.vue'

type DialogCloseAction = 'escape' | 'backdrop' | 'explicit'
type DialogClosePolicy = 'all' | 'escape' | 'backdrop' | 'explicit' | 'blocked' | {
  escape?: boolean
  backdrop?: boolean
  explicit?: boolean
}

type DialogSize = 'sm' | 'md' | 'lg' | 'xl'
type DialogPresentation = 'center' | 'responsive-sheet'
type DialogTone = 'default' | 'destructive' | 'mandatory'

const props = withDefaults(defineProps<{
  open: boolean
  title?: string
  description?: string
  widthClass?: string
  size?: DialogSize
  presentation?: DialogPresentation
  tone?: DialogTone
  showClose?: boolean
  closePolicy?: DialogClosePolicy
  busy?: boolean
  initialFocus?: string
  overlayZIndex?: number
}>(), {
  title: '',
  description: '',
  widthClass: '',
  size: 'md',
  presentation: 'responsive-sheet',
  tone: 'default',
  showClose: true,
  closePolicy: 'all',
  busy: false,
  initialFocus: '',
  overlayZIndex: LAYERS.dialog,
})

const emit = defineEmits<{
  close: []
}>()

const panelRef = ref<HTMLElement | null>(null)
const idPrefix = useId().replace(/:/g, '-')
const titleId = `${idPrefix}-title`
const descriptionId = `${idPrefix}-description`
const panelLayer = computed(() => props.overlayZIndex + 1)
provide(DIALOG_CONTENT_LAYER_KEY, panelLayer)
const sizeClasses: Record<DialogSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}
const resolvedWidthClass = computed(() => props.widthClass || sizeClasses[props.size])
const overlayClasses = computed(() => props.presentation === 'center'
  ? 'items-center p-4 sm:p-5'
  : 'items-end p-0 sm:items-center sm:p-5')
const panelClasses = computed(() => [
  resolvedWidthClass.value,
  props.presentation === 'center'
    ? 'rounded-[var(--radius-outer)]'
    : 'rounded-t-[var(--radius-outer)] sm:rounded-[var(--radius-outer)]',
  props.tone === 'destructive' ? 'border-red-300/70 dark:border-red-900/70' : '',
])
let previousActive: HTMLElement | null = null
let releaseScrollLock: (() => void) | null = null

function canClose(action: DialogCloseAction): boolean {
  if (props.busy || props.closePolicy === 'blocked')
    return false
  if (props.closePolicy === 'all')
    return true
  if (typeof props.closePolicy === 'string')
    return props.closePolicy === action
  return props.closePolicy[action] ?? false
}

function requestClose(action: DialogCloseAction) {
  if (canClose(action))
    emit('close')
}

function isTopmostDialog(): boolean {
  if (typeof document === 'undefined')
    return true
  const overlays = Array.from(document.querySelectorAll<HTMLElement>('.dialog-overlay'))
  let highestLayer = Number.NEGATIVE_INFINITY
  let topmostOverlay: HTMLElement | null = null
  for (const overlay of overlays) {
    const layer = Number.parseInt(overlay.style.zIndex || '0', 10)
    if (layer >= highestLayer) {
      highestLayer = layer
      topmostOverlay = overlay
    }
  }
  return panelRef.value?.closest('.dialog-overlay') === topmostOverlay
}

function getFocusable(): HTMLElement[] {
  if (!panelRef.value)
    return []
  const nodes = panelRef.value.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )
  return Array.from(nodes).filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null)
}

function getInitialFocus(): HTMLElement | undefined {
  if (!panelRef.value || !props.initialFocus)
    return undefined
  try {
    return panelRef.value.querySelector<HTMLElement>(props.initialFocus) ?? undefined
  }
  catch {
    return undefined
  }
}

function onKeydown(e: KeyboardEvent) {
  if (!props.open || !isTopmostDialog())
    return

  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    requestClose('escape')
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
    focusWithoutScrolling(getInitialFocus() ?? getFocusable()[0])
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
        class="dialog-overlay fixed inset-0 flex justify-center overflow-y-auto overscroll-contain bg-black/35 backdrop-blur-sm"
        :style="{ zIndex: overlayZIndex }"
        role="presentation"
        :class="overlayClasses"
        @click.self="requestClose('backdrop')"
      >
        <div
          ref="panelRef"
          role="dialog"
          aria-modal="true"
          :aria-label="!title && !description ? undefined : title ? undefined : description"
          :aria-labelledby="title ? titleId : undefined"
          :aria-describedby="description ? descriptionId : undefined"
          class="dialog-content-panel flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[var(--radius-outer)] border border-ink-200/60 bg-white shadow-modal dark:border-ink-200/10 dark:bg-ink-800 sm:max-h-[calc(100dvh-3rem)] sm:rounded-[var(--radius-outer)]"
          :class="panelClasses"
        >
          <div class="w-12 h-1.5 rounded-full bg-ink-200 dark:bg-ink-300 mx-auto mt-3 shrink-0 sm:hidden" aria-hidden="true" />

          <slot name="header">
            <DialogHeader
              v-if="title || description || showClose"
              :title="title"
              :description="description"
              :title-id="title ? titleId : undefined"
              :description-id="description ? descriptionId : undefined"
              :show-close="showClose && canClose('explicit')"
              @close="requestClose('explicit')"
            />
          </slot>

          <DialogBody>
            <slot />
          </DialogBody>

          <div v-if="$slots.footer" class="shrink-0 px-5 pb-5 text-left">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

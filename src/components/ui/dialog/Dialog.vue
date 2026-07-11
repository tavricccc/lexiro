<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import Button from '../button/Button.vue'

const props = withDefaults(defineProps<{
  open: boolean
  title?: string
  description?: string
  widthClass?: string
  showClose?: boolean
}>(), {
  title: '',
  description: '',
  widthClass: 'max-w-lg',
  showClose: true,
})

const emit = defineEmits<{
  close: []
}>()

const panelRef = ref<HTMLElement | null>(null)
let previousOverflow = ''
let previousActive: HTMLElement | null = null

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

function lockBody() {
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
}

function unlockBody() {
  document.body.style.overflow = previousOverflow
}

watch(() => props.open, async (open) => {
  if (open) {
    previousActive = document.activeElement instanceof HTMLElement ? document.activeElement : null
    lockBody()
    await nextTick()
    const focusable = getFocusable()
    focusable[0]?.focus()
  }
  else {
    unlockBody()
    previousActive?.focus?.()
    previousActive = null
  }
})

onMounted(() => {
  window.addEventListener('keydown', onKeydown, true)
  if (props.open)
    lockBody()
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown, true)
  unlockBody()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-6 backdrop-blur-xl"
        role="presentation"
        @click.self="$emit('close')"
      >
        <div
          ref="panelRef"
          role="dialog"
          aria-modal="true"
          :aria-label="title || undefined"
          class="dialog-content-panel flex max-h-[92vh] w-full flex-col rounded-t-[22px] border border-ink-200/60 dark:border-ink-200/10 bg-white dark:bg-ink-800 shadow-2xl overflow-hidden sm:max-h-full sm:rounded-[22px]"
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

          <div class="overflow-y-auto px-6 pb-6 pt-1 text-left">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

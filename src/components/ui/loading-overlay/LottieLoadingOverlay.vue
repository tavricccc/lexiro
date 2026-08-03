<script setup lang="ts">
import { DotLottieVue } from '@lottiefiles/dotlottie-vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { BOOKS_STACK_LOTTIE, BOOKS_STACK_SEGMENT } from '@/constants/animations'
import { LAYERS } from '@/constants/layers'
import { useReducedMotion } from '@/lib/use-reduced-motion'
import Button from '../button/Button.vue'
import Progress from '../progress/Progress.vue'

const props = withDefaults(defineProps<{
  open: boolean
  message?: string
  detail?: string
  percent?: number | null
  progressLabel?: string
  hint?: string
  retryable?: boolean
  allowCancel?: boolean
  fullscreen?: boolean
  showMessage?: boolean
  showProgress?: boolean
  lottieSrc?: string
  revealDelay?: number
  minimumVisible?: number
}>(), {
  message: '',
  detail: '',
  percent: null,
  progressLabel: '',
  hint: '',
  retryable: false,
  allowCancel: false,
  fullscreen: true,
  showMessage: true,
  showProgress: true,
  lottieSrc: BOOKS_STACK_LOTTIE,
  revealDelay: 0,
  minimumVisible: 0,
})

const emit = defineEmits<{
  retry: []
  cancel: []
}>()

const reducedMotion = useReducedMotion()
const hasProgress = computed(() => props.percent !== null && props.percent !== undefined)
const normalizedPercent = computed(() => Math.max(0, Math.min(100, props.percent ?? 0)))
const showActions = computed(() => props.retryable || props.allowCancel)
const showDetails = computed(() => props.showMessage && Boolean(props.message || props.detail))
const player = ref<InstanceType<typeof DotLottieVue> | null>(null)
const renderedOpen = ref(props.open && props.revealDelay === 0)
let revealTimer: ReturnType<typeof setTimeout> | null = null
let hideTimer: ReturnType<typeof setTimeout> | null = null
let revealedAt = 0

function clearTimers() {
  if (revealTimer)
    clearTimeout(revealTimer)
  if (hideTimer)
    clearTimeout(hideTimer)
  revealTimer = null
  hideTimer = null
}

function updateRenderedOpen(open: boolean) {
  clearTimers()
  if (open) {
    if (props.revealDelay === 0) {
      renderedOpen.value = true
      revealedAt = Date.now()
      return
    }
    revealTimer = setTimeout(() => {
      renderedOpen.value = true
      revealedAt = Date.now()
      revealTimer = null
    }, props.revealDelay)
    return
  }
  if (!renderedOpen.value)
    return
  const remaining = Math.max(0, props.minimumVisible - (Date.now() - revealedAt))
  hideTimer = setTimeout(() => {
    renderedOpen.value = false
    hideTimer = null
  }, remaining)
}

function showReducedMotionFrame() {
  if (!reducedMotion.value)
    return
  lottieInstance()?.setFrame(BOOKS_STACK_SEGMENT[1])
}

function lottieInstance() {
  const component = player.value as (InstanceType<typeof DotLottieVue> & { getDotLottieInstance?: () => { addEventListener: (event: string, listener: () => void) => void, removeEventListener: (event: string, listener: () => void) => void, setFrame: (frame: number) => void } }) | null
  return component?.getDotLottieInstance?.()
}

onMounted(() => {
  updateRenderedOpen(props.open)
  lottieInstance()?.addEventListener('load', showReducedMotionFrame)
})
watch(() => props.open, updateRenderedOpen)
watch(reducedMotion, showReducedMotionFrame)
onBeforeUnmount(() => {
  clearTimers()
  lottieInstance()?.removeEventListener('load', showReducedMotionFrame)
})
</script>

<template>
  <Teleport to="body" :disabled="!fullscreen">
    <Transition name="loading-overlay">
      <div
        v-if="renderedOpen"
        class="overflow-hidden bg-ink-50/98 text-ink-950 dark:bg-ink-950/98 dark:text-ink-50"
        :class="fullscreen ? 'fixed inset-0 overflow-y-auto' : 'absolute inset-0 z-10'"
        :style="{ zIndex: fullscreen ? LAYERS.syncGate : 1 }"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-busy="true"
      >
        <div class="flex items-center justify-center overflow-y-auto px-6 sm:px-8" :class="fullscreen ? 'h-[100dvh] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]' : 'h-full min-h-64 py-6'">
          <section class="w-full max-w-md text-center">
            <div class="mx-auto flex items-center justify-center overflow-hidden" :class="fullscreen ? 'h-72 w-48 sm:h-80 sm:w-56' : 'h-48 w-32 sm:h-56 sm:w-36'">
              <DotLottieVue
                ref="player"
                :src="lottieSrc"
                :autoplay="!reducedMotion"
                :loop="!reducedMotion"
                :segment="BOOKS_STACK_SEGMENT"
                class="h-full w-full"
                aria-hidden="true"
              />
            </div>

            <div v-if="showProgress" class="mt-6">
              <Progress v-if="hasProgress" :model-value="normalizedPercent" class="h-1" />
              <div v-else class="relative h-1 overflow-hidden rounded-full bg-ink-200/80 dark:bg-ink-800" role="progressbar" :aria-label="$t('sync.progressTitle')">
                <div class="loading-progress-indeterminate absolute inset-y-0 left-0 w-2/5 rounded-full bg-accent-primary" />
              </div>
              <div v-if="showDetails" class="mt-2 space-y-0.5 text-[0.625rem] font-medium leading-relaxed text-ink-400 dark:text-ink-500">
                <p>{{ message }}</p>
                <p v-if="detail" class="font-normal">
                  {{ detail }}
                </p>
              </div>
              <div class="mt-1 flex min-h-4 items-center justify-between gap-3 text-[0.625rem] font-medium leading-relaxed text-ink-400 dark:text-ink-500">
                <span>{{ progressLabel }}</span>
                <span v-if="hasProgress" class="tabular-nums">{{ normalizedPercent }}%</span>
              </div>
            </div>

            <div v-if="showDetails && !showProgress" class="mt-2 space-y-0.5 text-[0.625rem] font-medium leading-relaxed text-ink-400 dark:text-ink-500">
              <p>{{ message }}</p>
              <p v-if="detail" class="font-normal">
                {{ detail }}
              </p>
            </div>

            <p v-if="hint" class="mt-4 text-xs font-semibold leading-relaxed text-ink-400 dark:text-ink-500">
              {{ hint }}
            </p>

            <div v-if="showActions" class="mt-6 flex justify-center gap-2">
              <Button v-if="allowCancel" variant="ghost" size="sm" @click="emit('cancel')">
                {{ $t('sync.cancel') }}
              </Button>
              <Button v-if="retryable" variant="default" size="sm" @click="emit('retry')">
                {{ $t('sync.retry') }}
              </Button>
            </div>
          </section>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

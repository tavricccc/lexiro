<script setup lang="ts">
import { DotLottieVue } from '@lottiefiles/dotlottie-vue'
import { computed } from 'vue'
import { STUDY_DISCUSSION_LOTTIE } from '@/constants/animations'
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
  lottieSrc: STUDY_DISCUSSION_LOTTIE,
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
</script>

<template>
  <Teleport to="body" :disabled="!fullscreen">
    <Transition name="loading-overlay">
      <div
        v-if="open"
        class="overflow-hidden bg-ink-50/98 text-ink-950 dark:bg-ink-950/98 dark:text-ink-50"
        :class="fullscreen ? 'fixed inset-0 overflow-y-auto' : 'absolute inset-0 z-10'"
        :style="{ zIndex: fullscreen ? LAYERS.syncGate : 1 }"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-busy="true"
      >
        <div class="flex min-h-full items-center justify-center px-6 py-10 sm:px-8">
          <section class="w-full max-w-md text-center">
            <DotLottieVue
              :src="lottieSrc"
              :autoplay="!reducedMotion"
              :loop="!reducedMotion"
              :class="fullscreen ? 'mx-auto h-52 w-52 sm:h-60 sm:w-60' : 'mx-auto h-40 w-40 sm:h-44 sm:w-44'"
              aria-hidden="true"
            />

            <div v-if="showDetails" class="mt-1 space-y-1">
              <h1 class="text-xl font-black tracking-tight text-ink-950 dark:text-ink-50">
                {{ message }}
              </h1>
              <p v-if="detail" class="text-sm font-semibold leading-relaxed text-ink-500 dark:text-ink-300">
                {{ detail }}
              </p>
            </div>

            <div v-if="showProgress" class="mt-6">
              <Progress v-if="hasProgress" :model-value="normalizedPercent" class="h-2" />
              <div v-else class="relative h-2 overflow-hidden rounded-full bg-ink-200/80 dark:bg-ink-800" role="progressbar" :aria-label="$t('sync.progressTitle')">
                <div class="loading-progress-indeterminate absolute inset-y-0 left-0 w-2/5 rounded-full bg-accent-primary" />
              </div>
              <div class="mt-2 flex min-h-5 items-center justify-between gap-3 text-xs font-bold text-ink-400 dark:text-ink-500">
                <span>{{ progressLabel }}</span>
                <span v-if="hasProgress" class="tabular-nums">{{ normalizedPercent }}%</span>
              </div>
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

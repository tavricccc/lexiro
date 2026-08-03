<script setup lang="ts">
import { LAYERS } from '@/constants/layers'

const props = withDefaults(defineProps<{
  message: string
  visible: boolean
  actionLabel?: string
  class?: string
}>(), {
  actionLabel: '',
  class: '',
})

const emit = defineEmits<{
  action: []
}>()
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-350 ease-out"
      enter-from-class="translate-y-6 scale-95 opacity-0"
      enter-to-class="translate-y-0 scale-100 opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="translate-y-0 scale-100 opacity-100"
      leave-to-class="translate-y-6 scale-95 opacity-0"
    >
      <div
        v-if="visible"
        role="status"
        aria-live="polite"
        class="fixed inset-x-0 bottom-8 mx-auto w-fit max-w-sm rounded-[var(--radius-outer)] bg-white/95 dark:bg-ink-100/95 text-ink-950 dark:text-ink-50 px-4 py-2.5 text-xs sm:text-sm font-semibold shadow-2xl border border-ink-200/40 dark:border-ink-200/10 flex items-center justify-center gap-1.5 backdrop-blur-xl"
        :style="{ zIndex: LAYERS.toast }"
      >
        <span class="inline-block h-2 w-2 shrink-0 rounded-full bg-accent-primary animate-pulse" />
        <span>{{ message }}</span>
        <button v-if="props.actionLabel" type="button" class="min-h-11 shrink-0 rounded-xl px-3 text-xs font-black text-accent-primary hover:bg-ink-100 dark:hover:bg-ink-800" @click="emit('action')">
          {{ props.actionLabel }}
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

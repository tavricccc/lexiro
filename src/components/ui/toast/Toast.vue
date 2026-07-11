<script setup lang="ts">
withDefaults(defineProps<{
  message: string
  visible: boolean
  class?: string
}>(), {
  class: '',
})
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
        class="fixed inset-x-0 bottom-8 z-[70] mx-auto w-fit max-w-sm rounded-[20px] bg-white/95 dark:bg-ink-100/95 text-ink-950 dark:text-ink-50 px-5 py-3 text-xs sm:text-sm font-semibold shadow-2xl border border-ink-200/40 dark:border-ink-200/10 flex items-center justify-center gap-2.5 backdrop-blur-xl"
      >
        <span class="inline-block h-2 w-2 rounded-full bg-accent-primary animate-pulse" />
        {{ message }}
      </div>
    </Transition>
  </Teleport>
</template>

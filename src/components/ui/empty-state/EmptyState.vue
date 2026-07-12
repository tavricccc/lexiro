<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  description?: string
}>(), {
  description: '',
})
</script>

<template>
  <div class="mx-auto flex max-w-md flex-col items-center justify-center py-10 text-center">
    <div v-if="$slots.icon" class="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-accent-primary/15 bg-accent-primary/10 text-accent-primary">
      <slot name="icon" />
    </div>
    <h2 class="text-2xl font-extrabold tracking-tight text-ink-950 dark:text-ink-50">
      {{ title }}
    </h2>
    <p v-if="description" class="mt-2 text-sm font-medium leading-relaxed text-ink-500 dark:text-ink-400">
      {{ description }}
    </p>
    <div v-if="$slots.default" class="mt-6 w-full text-left">
      <slot />
    </div>
    <div v-if="$slots.actions" class="mt-6 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
      <slot name="actions" />
    </div>
  </div>
</template>

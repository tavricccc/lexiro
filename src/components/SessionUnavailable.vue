<script setup lang="ts">
import { ArrowLeft, LoaderCircle } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'
import Button from './ui/button/Button.vue'
</script>

<template>
  <section class="mx-auto flex min-h-[55vh] max-w-md flex-col items-center justify-center gap-4 text-center">
    <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-100 dark:bg-ink-900">
      <LoaderCircle class="h-6 w-6 animate-spin text-ink-500" />
    </div>
    <div>
      <h1 class="text-lg font-black">
        {{ $t('session.loadingTitle') }}
      </h1>
      <p class="mt-2 text-sm font-semibold leading-relaxed text-ink-500">
        {{ $t('session.loadingDescription') }}
      </p>
    </div>
    <RouterLink to="/">
      <Button variant="outline" class="gap-2">
        <ArrowLeft class="h-4 w-4" />{{ $t('session.returnHome') }}
      </Button>
    </RouterLink>
  </section>
</template>

<script setup lang="ts">
import type { StatsMemorySummary } from '@/types'
import { Brain, ListChecks } from 'lucide-vue-next'
import Card from '../ui/card/Card.vue'

defineProps<{ memory: StatsMemorySummary, senseCount: number, questionTotal: number, longestStreak: number }>()
</script>

<template>
  <Card class="p-5">
    <div class="grid gap-6 lg:grid-cols-2 lg:divide-x lg:divide-ink-200/60 lg:dark:divide-ink-800">
      <div>
        <div class="flex items-center gap-2">
          <Brain class="h-5 w-5 text-accent-primary" />
          <h2 class="font-black">
            {{ $t('stats.memoryTitle') }}
          </h2>
        </div>
        <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div class="surface-inset p-3">
            <p class="text-xl font-black sm:text-2xl">
              {{ memory.total }}
            </p>
            <p class="mt-1 text-xs font-bold text-ink-500">
              {{ $t('stats.attempts') }}
            </p>
          </div>
          <div class="surface-inset p-3">
            <p class="text-xl font-black sm:text-2xl">
              {{ memory.accuracy }}%
            </p>
            <p class="mt-1 text-xs font-bold text-ink-500">
              {{ $t('stats.accuracy') }}
            </p>
          </div>
        </div>
      </div>

      <div class="lg:pl-6">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <ListChecks class="h-5 w-5 text-accent-primary" />
            <h2 class="font-black">
              {{ $t('stats.questionTitle') }}
            </h2>
          </div>
          <span class="text-xs font-bold text-ink-400">{{ questionTotal }} {{ $t('stats.attempts') }}</span>
        </div>
        <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div class="surface-inset p-3">
            <p class="text-xl font-black sm:text-2xl">
              {{ questionTotal }}
            </p>
            <p class="mt-1 text-xs font-bold text-ink-500">
              {{ $t('stats.attempts') }}
            </p>
          </div>
          <div class="surface-inset p-3">
            <p class="text-xl font-black sm:text-2xl">
              {{ longestStreak }}
            </p>
            <p class="mt-1 text-xs font-bold text-ink-500">
              {{ $t('stats.longestStreak', { count: longestStreak }) }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </Card>
</template>

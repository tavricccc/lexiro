<script setup lang="ts">
import type { FsrsStatusCounts, StatsMemorySummary } from '@/types'
import { Brain } from 'lucide-vue-next'
import Card from '../ui/card/Card.vue'

defineProps<{ memory: StatsMemorySummary, statuses: FsrsStatusCounts, senseCount: number }>()
</script>

<template>
  <Card class="p-5">
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <Brain class="h-5 w-5" /><h2 class="font-black">
          {{ $t('stats.memoryTitle') }}
        </h2>
      </div>
      <span class="text-xs font-bold text-ink-400">{{ $t('stats.senseCount', { count: senseCount }) }}</span>
    </div>
    <div class="mt-5 grid grid-cols-2 gap-3 text-sm">
      <div class="surface-inset p-3">
        <p class="text-2xl font-black">
          {{ memory.total }}
        </p><p class="mt-1 text-xs font-bold text-ink-500">
          {{ $t('stats.attempts') }}
        </p>
      </div>
      <div class="surface-inset p-3">
        <p class="text-2xl font-black">
          {{ memory.accuracy }}%
        </p><p class="mt-1 text-xs font-bold text-ink-500">
          {{ $t('stats.accuracy') }}
        </p>
      </div>
    </div>
    <div class="mt-5 grid grid-cols-2 gap-2 text-xs font-bold text-ink-500 sm:grid-cols-4">
      <div class="surface-inset p-3">
        <span class="text-ink-400">{{ $t('stats.fsrsUnlearned') }}</span><p class="mt-1 text-xl font-black text-ink-950 dark:text-ink-50">
          {{ statuses.unlearned }}
        </p>
      </div>
      <div class="surface-inset p-3">
        <span class="text-ink-400">{{ $t('stats.fsrsLearning') }}</span><p class="mt-1 text-xl font-black text-amber-600 dark:text-amber-400">
          {{ statuses.learning }}
        </p>
      </div>
      <div class="surface-inset p-3">
        <span class="text-ink-400">{{ $t('stats.fsrsScheduled') }}</span><p class="mt-1 text-xl font-black text-blue-600 dark:text-blue-400">
          {{ statuses.scheduled }}
        </p>
      </div>
      <div class="surface-inset p-3">
        <span class="text-ink-400">{{ $t('stats.fsrsDue') }}</span><p class="mt-1 text-xl font-black text-emerald-600 dark:text-emerald-400">
          {{ statuses.due }}
        </p>
      </div>
    </div>
  </Card>
</template>

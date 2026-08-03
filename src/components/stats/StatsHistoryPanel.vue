<script setup lang="ts">
import type { DailyActivity } from '@/types'
import { CalendarDays } from 'lucide-vue-next'
import Card from '../ui/card/Card.vue'

defineProps<{ activities: DailyActivity[] }>()
</script>

<template>
  <Card class="p-5">
    <div class="flex items-center gap-2">
      <CalendarDays class="h-5 w-5" /><h2 class="font-black">
        {{ $t('stats.historyTitle') }}
      </h2>
    </div>
    <div v-if="activities.length" class="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      <article v-for="activity in activities" :key="activity.date" class="surface-inset space-y-1 p-3 text-xs font-semibold text-ink-500">
        <p class="font-black text-ink-950 dark:text-ink-50">
          {{ activity.date }}
        </p>
        <p>{{ $t('stats.historyMemory', { count: activity.memoryAgain + activity.memoryGood }) }}</p>
        <p>{{ $t('stats.historyQuestions', { count: activity.questionTotal }) }}</p>
        <p>{{ $t('stats.historyXp', { count: activity.xpEarned }) }}</p>
      </article>
    </div>
    <p v-else class="mt-4 text-sm font-semibold text-ink-400">
      {{ $t('stats.historyEmpty') }}
    </p>
  </Card>
</template>

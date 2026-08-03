<script setup lang="ts">
import type { DashboardStats, StatsMemorySummary } from '@/types'
import { Flame, Gauge, Target, TrendingUp } from 'lucide-vue-next'
import Card from '../ui/card/Card.vue'

defineProps<{ memory: StatsMemorySummary, stats: DashboardStats }>()
</script>

<template>
  <div class="grid grid-cols-2 gap-3 xl:grid-cols-4">
    <Card class="p-4 sm:p-5">
      <Target class="h-4 w-4 text-ink-500" />
      <p class="mt-2 text-xl font-black sm:text-2xl">
        {{ memory.total }}
      </p>
      <p class="mt-0.5 text-xs font-bold text-ink-500">
        {{ $t('learning.totalReviews', { count: memory.total }) }}
      </p>
    </Card>
    <Card class="p-4 sm:p-5">
      <TrendingUp class="h-4 w-4 text-ink-500" />
      <p class="mt-2 text-xl font-black sm:text-2xl">
        {{ memory.accuracy }}%
      </p>
      <p class="mt-0.5 text-xs font-bold text-ink-500">
        {{ $t('learning.accuracy') }}
      </p>
    </Card>
    <Card class="p-4 sm:p-5">
      <Flame class="h-4 w-4 text-ink-500" />
      <p class="mt-2 text-xl font-black sm:text-2xl">
        {{ stats.streakDays }}
      </p>
      <p class="mt-0.5 text-xs font-bold text-ink-500">
        {{ $t('learning.streak') }}
      </p>
    </Card>
    <Card class="p-4 sm:p-5">
      <Gauge class="h-4 w-4 text-ink-500" />
      <p class="mt-2 text-xl font-black sm:text-2xl">
        {{ stats.level }}
      </p>
      <p class="mt-0.5 text-xs font-bold text-ink-500">
        {{ $t('stats.level') }} · {{ stats.xp }} XP
      </p>
    </Card>
  </div>
</template>

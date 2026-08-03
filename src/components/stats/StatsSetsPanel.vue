<script setup lang="ts">
import type { StatsSetRow } from '@/types'
import { BarChart3 } from 'lucide-vue-next'
import Card from '../ui/card/Card.vue'

defineProps<{ rows: StatsSetRow[] }>()
</script>

<template>
  <Card class="p-5">
    <div class="flex items-center gap-2">
      <BarChart3 class="h-5 w-5" /><h2 class="font-black">
        {{ $t('stats.bySet') }}
      </h2>
    </div>
    <div v-if="rows.length" class="mt-5 space-y-4">
      <div v-for="item in rows" :key="item.set.id" class="rounded-xl border border-ink-200/60 p-3.5 dark:border-ink-800/70">
        <div class="flex items-center justify-between gap-3 text-sm">
          <span class="min-w-0 truncate font-black text-ink-950 dark:text-ink-50">{{ item.set.setName }}</span>
          <span class="shrink-0 text-xs font-bold text-ink-500">{{ item.learned }}/{{ item.total }} {{ $t('learning.learned') }} · {{ item.due }} {{ $t('learning.due') }}</span>
        </div>
      </div>
    </div>
    <div v-else class="py-10 text-center text-sm font-semibold text-ink-400">
      {{ $t('stats.empty') }}
    </div>
  </Card>
</template>

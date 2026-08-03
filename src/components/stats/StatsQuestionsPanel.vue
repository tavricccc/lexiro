<script setup lang="ts">
import type { StatsQuestionRow } from '@/types'
import { ListChecks } from 'lucide-vue-next'
import Card from '../ui/card/Card.vue'

defineProps<{ rows: StatsQuestionRow[], total: number }>()
</script>

<template>
  <Card class="p-5">
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <ListChecks class="h-5 w-5" /><h2 class="font-black">
          {{ $t('stats.questionTitle') }}
        </h2>
      </div>
      <span class="text-xs font-bold text-ink-400">{{ total }} {{ $t('stats.attempts') }}</span>
    </div>
    <div class="mt-4 overflow-x-auto">
      <table class="w-full text-left text-xs">
        <thead class="text-ink-400">
          <tr>
            <th class="pb-2">
              {{ $t('stats.questionType') }}
            </th><th class="pb-2">
              {{ $t('stats.questionDifficulty') }}
            </th><th class="pb-2">
              {{ $t('stats.attempts') }}
            </th><th class="pb-2">
              {{ $t('stats.accuracy') }}
            </th><th class="pb-2">
              {{ $t('stats.retry') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.key" class="border-t border-ink-200/50 dark:border-ink-800/70">
            <td class="py-2.5 font-bold">
              {{ row.label }}
            </td><td class="py-2.5">
              {{ row.difficulty }}
            </td><td class="py-2.5">
              {{ row.total }}
            </td><td class="py-2.5">
              {{ row.accuracy }}%
            </td><td class="py-2.5">
              {{ row.retry }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </Card>
</template>

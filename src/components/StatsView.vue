<script setup lang="ts">
import { Award, BarChart3, Flame, Target, TrendingUp } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useLearningStore } from '@/stores/learning'
import { useSetsStore } from '@/stores/sets'
import Card from './ui/card/Card.vue'

const learningStore = useLearningStore()
const setsStore = useSetsStore()
const { stats, accuracy } = storeToRefs(learningStore)
const { sets } = storeToRefs(setsStore)
const setStats = computed(() => sets.value.map(set => ({ set, mastery: learningStore.getMasteryPercent(set), due: learningStore.getDueCount(set) })).sort((a, b) => b.mastery - a.mastery))
</script>

<template>
  <section class="space-y-6 text-left"><div><p class="text-xs font-black uppercase tracking-[0.18em] text-ink-400">{{ $t('stats.eyebrow') }}</p><h1 class="mt-2 text-3xl font-black tracking-tight">{{ $t('stats.title') }}</h1><p class="mt-2 text-sm font-semibold text-ink-500">{{ $t('stats.description') }}</p></div><div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Card class="p-5"><Target class="h-5 w-5 text-ink-500" /><p class="mt-4 text-3xl font-black">{{ stats.totalReviews }}</p><p class="mt-1 text-xs font-bold text-ink-500">{{ $t('learning.totalReviews', { count: stats.totalReviews }) }}</p></Card><Card class="p-5"><TrendingUp class="h-5 w-5 text-ink-500" /><p class="mt-4 text-3xl font-black">{{ accuracy }}%</p><p class="mt-1 text-xs font-bold text-ink-500">{{ $t('learning.accuracy') }}</p></Card><Card class="p-5"><Flame class="h-5 w-5 text-ink-500" /><p class="mt-4 text-3xl font-black">{{ stats.streakDays }}</p><p class="mt-1 text-xs font-bold text-ink-500">{{ $t('learning.streak') }}</p></Card><Card class="p-5"><Award class="h-5 w-5 text-ink-500" /><p class="mt-4 text-3xl font-black">{{ stats.level }}</p><p class="mt-1 text-xs font-bold text-ink-500">{{ $t('stats.level') }} · {{ stats.xp }} XP</p></Card></div><Card class="p-6"><div class="flex items-center gap-2"><BarChart3 class="h-5 w-5" /><h2 class="font-black">{{ $t('stats.bySet') }}</h2></div><div v-if="setStats.length" class="mt-6 space-y-5"><div v-for="item in setStats" :key="item.set.id"><div class="mb-2 flex items-center justify-between gap-3 text-sm"><span class="truncate font-black">{{ item.set.setName }}</span><span class="shrink-0 text-xs font-bold text-ink-500">{{ item.mastery }}% · {{ item.due }} {{ $t('learning.due') }}</span></div><div class="h-2 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800"><div class="h-full rounded-full bg-ink-950 transition-all dark:bg-white" :style="{ width: `${item.mastery}%` }" /></div></div></div><div v-else class="py-10 text-center text-sm font-semibold text-ink-400">{{ $t('stats.empty') }}</div></Card><Card v-if="stats.achievements.length" class="p-6"><div class="flex items-center gap-2"><Award class="h-5 w-5" /><h2 class="font-black">{{ $t('learning.achievements') }}</h2></div><div class="mt-5 grid gap-3 sm:grid-cols-3"><div v-for="achievement in stats.achievements" :key="achievement.id" class="rounded-2xl bg-ink-100/70 p-4 dark:bg-ink-900/70"><p class="text-sm font-black">{{ $t(achievement.titleKey) }}</p><p class="mt-1 text-xs font-semibold text-ink-500">{{ $t(achievement.descriptionKey) }}</p></div></div></Card></section>
</template>

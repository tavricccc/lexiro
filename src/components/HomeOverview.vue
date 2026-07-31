<script setup lang="ts">
import { BookOpenCheck, Cloud, Flame, Layers3, PlayCircle, Sparkles, Trophy } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useLearningStore } from '@/stores/learning'
import { useSessionStore } from '@/stores/session'
import { useSetsStore } from '@/stores/sets'
import { useUIStore } from '@/stores/ui'
import SyncProgressPanel from './SyncProgressPanel.vue'
import Button from './ui/button/Button.vue'
import Card from './ui/card/Card.vue'
import IconTile from './ui/icon-tile/IconTile.vue'

const setsStore = useSetsStore()
const sessionStore = useSessionStore()
const uiStore = useUIStore()
const learningStore = useLearningStore()
const router = useRouter()
const { sets, totalWordCount } = storeToRefs(setsStore)
const { stats, todayProgress, accuracy } = storeToRefs(learningStore)

const inProgressCount = computed(() => sets.value.filter(set => sessionStore.isSetInProgress(set.id)).length)
const dueCount = computed(() => sets.value.reduce((total, set) => total + learningStore.getDueCount(set), 0))

function startTodayReview() {
  const target = sets.value.find(set => learningStore.getDueCount(set) > 0)
  if (target && learningStore.startReview(target.id))
    router.push({ name: 'review', params: { setId: target.id } })
}
</script>

<template>
  <Card class="overflow-hidden p-0 text-left">
    <div class="grid lg:grid-cols-[1fr_280px]">
      <div class="p-5 sm:p-6">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="text-xs font-extrabold uppercase tracking-widest text-ink-400 dark:text-ink-500">
              {{ $t('home.overviewEyebrow') }}
            </p>
            <h2 class="mt-1 text-xl font-extrabold tracking-tight text-ink-950 dark:text-ink-50">
              {{ $t('home.overviewTitle') }}
            </h2>
          </div>
          <Button variant="outline" size="sm" class="gap-2 self-start" @click="uiStore.openTransfer">
            <Cloud class="h-3.5 w-3.5" />
            {{ $t('home.manageBackup') }}
          </Button>
          <Button v-if="dueCount" variant="default" size="sm" class="gap-2 self-start" @click="startTodayReview">
            <Sparkles class="h-3.5 w-3.5" />
            {{ $t('learning.startToday', { count: dueCount }) }}
          </Button>
        </div>

        <dl class="mt-5 grid grid-cols-3 gap-2">
          <div class="surface-inset p-3">
            <IconTile size="sm">
              <Layers3 class="h-4 w-4" />
            </IconTile>
            <dd class="mt-2 text-xl font-extrabold tabular-nums">
              {{ sets.length }}
            </dd>
            <dt class="text-[11px] font-semibold text-ink-400">
              {{ $t('home.metricSets') }}
            </dt>
          </div>
          <div class="surface-inset p-3">
            <IconTile size="sm">
              <BookOpenCheck class="h-4 w-4" />
            </IconTile>
            <dd class="mt-2 text-xl font-extrabold tabular-nums">
              {{ totalWordCount }}
            </dd>
            <dt class="text-[11px] font-semibold text-ink-400">
              {{ $t('home.metricWords') }}
            </dt>
          </div>
          <div class="surface-inset p-3">
            <IconTile size="sm">
              <PlayCircle class="h-4 w-4" />
            </IconTile>
            <dd class="mt-2 text-xl font-extrabold tabular-nums">
              {{ inProgressCount }}
            </dd>
            <dt class="text-[11px] font-semibold text-ink-400">
              {{ $t('home.metricProgress') }}
            </dt>
          </div>
        </dl>

        <div class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div class="surface-inset p-3">
            <p class="text-[11px] font-bold text-ink-400">
              {{ $t('learning.todayGoal') }}
            </p>
            <p class="mt-1 text-xl font-extrabold tabular-nums">
              {{ stats.todayReviews }}/{{ stats.dailyGoal }}
            </p>
            <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-200 dark:bg-ink-800">
              <div class="h-full rounded-full bg-accent-primary transition-all duration-500" :style="{ width: `${todayProgress}%` }" />
            </div>
          </div>
          <div class="surface-inset p-3">
            <IconTile size="sm" tone="warning">
              <Flame class="h-4 w-4" />
            </IconTile>
            <p class="mt-2 text-xl font-extrabold tabular-nums">
              {{ stats.streakDays }}
            </p>
            <p class="text-[11px] font-semibold text-ink-400">
              {{ $t('learning.streak') }}
            </p>
          </div>
          <div class="surface-inset p-3">
            <p class="text-[11px] font-bold text-ink-400">
              {{ $t('learning.accuracy') }}
            </p>
            <p class="mt-2 text-xl font-extrabold tabular-nums">
              {{ accuracy }}%
            </p>
            <p class="text-[11px] font-semibold text-ink-400">
              {{ $t('learning.totalReviews', { count: stats.totalReviews }) }}
            </p>
          </div>
          <div class="surface-inset p-3">
            <IconTile size="sm" tone="info">
              <Sparkles class="h-4 w-4" />
            </IconTile>
            <p class="mt-2 text-xl font-extrabold tabular-nums">
              Lv. {{ stats.level }}
            </p>
            <p class="text-[11px] font-semibold text-ink-400">
              {{ stats.xp }} XP
            </p>
          </div>
        </div>

        <div v-if="stats.achievements.length" class="surface-inset mt-4 p-4">
          <div class="flex items-center gap-2">
            <Trophy class="h-4 w-4 text-accent-primary" />
            <p class="text-xs font-extrabold text-ink-950 dark:text-ink-50">
              {{ $t('learning.achievements') }}
            </p>
          </div>
          <div class="mt-3 grid gap-2 sm:grid-cols-3">
            <div v-for="achievement in stats.achievements.slice(-3).reverse()" :key="achievement.id" class="rounded-[var(--radius-inner)] bg-white/70 p-3 dark:bg-ink-900/70">
              <p class="text-xs font-extrabold text-accent-primary">
                {{ $t(achievement.titleKey) }}
              </p>
              <p class="mt-1 text-[11px] font-semibold text-ink-500 dark:text-ink-400">
                {{ $t(achievement.descriptionKey) }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div class="surface-inset rounded-none p-5 lg:rounded-l-none lg:rounded-r-[var(--radius-outer)]">
        <p class="mb-3 text-xs font-extrabold uppercase tracking-widest text-ink-400 dark:text-ink-500">
          {{ $t('home.dataSafety') }}
        </p>
        <SyncProgressPanel compact />
        <p class="mt-3 text-[11px] font-semibold leading-relaxed text-ink-400">
          {{ $t('home.localSaveHint') }}
        </p>
      </div>
    </div>
  </Card>
</template>

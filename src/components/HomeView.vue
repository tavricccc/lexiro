<script setup lang="ts">
import { ArrowRight, BookOpen, Flame, Library, Plus, RotateCcw, Search, Sparkles, Target } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useLearningStore } from '@/stores/learning'
import { useSessionStore } from '@/stores/session'
import { useSetsStore } from '@/stores/sets'
import Button from './ui/button/Button.vue'
import Card from './ui/card/Card.vue'
import Progress from './ui/progress/Progress.vue'

const router = useRouter()
const setsStore = useSetsStore()
const sessionStore = useSessionStore()
const learningStore = useLearningStore()
const { sets, hasSets, totalWordCount } = storeToRefs(setsStore)
const { stats, todayProgress, accuracy } = storeToRefs(learningStore)
const { openImport } = setsStore

const dailyReviewCount = computed(() => learningStore.getDailyReviewEntries().length)
const activeSessions = computed(() => sets.value.filter(set => sessionStore.isSetInProgress(set.id)).slice(0, 3))
const recentSets = computed(() => [...sets.value].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')).slice(0, 3))

function startReview() {
  if (learningStore.startDailyReview())
    router.push({ name: 'review' })
}
</script>

<template>
  <section class="space-y-6 text-left">
    <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <h1 class="text-3xl font-black tracking-tight text-ink-950 dark:text-ink-50">
          {{ $t('home.todayTitle') }}
        </h1>
      </div>
      <div class="flex gap-2">
        <Button variant="outline" class="gap-2" @click="openImport">
          <Plus class="h-4 w-4" />
          {{ $t('home.addSet') }}
        </Button>
        <RouterLink to="/dictionary">
          <Button variant="default" class="gap-2">
            <Search class="h-4 w-4" />
            {{ $t('nav.lookup') }}
          </Button>
        </RouterLink>
      </div>
    </div>

    <div v-if="!hasSets" class="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <Card class="min-w-0 border-0 bg-ink-950 p-6 text-white dark:bg-white dark:text-ink-950 sm:p-8">
        <Sparkles class="h-6 w-6" />
        <h2 class="mt-10 text-2xl font-black tracking-tight">
          {{ $t('home.emptyTitle') }}
        </h2>
        <p class="mt-3 max-w-md text-sm font-semibold leading-relaxed opacity-70">
          {{ $t('home.emptyDescription') }}
        </p>
        <Button variant="secondary" class="mt-6 gap-2" @click="openImport">
          <Plus class="h-4 w-4" />
          {{ $t('home.addSet') }}
        </Button>
      </Card>
      <Card class="min-w-0 p-6 sm:p-8">
        <p class="text-xs font-black uppercase tracking-[0.18em] text-ink-400">
          {{ $t('home.howItWorks') }}
        </p>
        <div class="mt-6 space-y-5">
          <div v-for="(step, index) in [$t('home.emptyStepWords'), $t('home.emptyStepAi'), $t('home.emptyStepPaste')]" :key="step" class="flex gap-3">
            <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-100 text-xs font-black dark:bg-ink-800">{{ index + 1 }}</span>
            <p class="pt-1 text-sm font-bold text-ink-600 dark:text-ink-300">
              {{ step }}
            </p>
          </div>
        </div>
      </Card>
    </div>

    <template v-else>
      <div class="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card class="min-w-0 overflow-hidden border-0 bg-ink-950 p-6 text-white dark:bg-white dark:text-ink-950 sm:p-8">
          <div class="flex items-start justify-between gap-5">
            <div>
              <p class="text-xs font-black uppercase tracking-[0.18em] opacity-60">
                {{ $t('learning.todayGoal') }}
              </p>
              <p class="mt-3 text-4xl font-black tabular-nums">
                {{ stats.todayLearningReviews }}<span class="text-xl opacity-50">/{{ stats.dailyGoal }}</span>
              </p>
              <p class="mt-2 text-sm font-semibold opacity-70">
                {{ dailyReviewCount ? $t('home.dailyQueueHint', { count: dailyReviewCount }) : $t('learning.noDue') }}
              </p>
            </div>
            <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
              <Target class="h-6 w-6" />
            </div>
          </div>
          <Progress :model-value="todayProgress" class="mt-7 bg-white/15 [&>div]:bg-white dark:bg-ink-200/30 dark:[&>div]:bg-ink-950" />
          <Button v-if="dailyReviewCount" variant="secondary" class="mt-6 gap-2" @click="startReview">
            <RotateCcw class="h-4 w-4" />
            {{ $t('learning.startToday', { count: dailyReviewCount }) }}
            <ArrowRight class="h-4 w-4" />
          </Button>
          <RouterLink v-else to="/library" class="mt-6 inline-flex items-center gap-2 text-sm font-black underline-offset-4 hover:underline">
            {{ $t('home.exploreStudy') }} <ArrowRight class="h-4 w-4" />
          </RouterLink>
        </Card>

        <Card class="min-w-0 p-6 sm:p-8">
          <div class="flex items-center justify-between">
            <p class="text-xs font-black uppercase tracking-[0.18em] text-ink-400">
              {{ $t('home.snapshot') }}
            </p>
            <RouterLink to="/stats" class="text-xs font-black text-ink-500 hover:text-ink-950 dark:hover:text-white">
              {{ $t('home.viewStats') }}
            </RouterLink>
          </div>
          <div class="mt-6 grid grid-cols-2 gap-3">
            <div class="rounded-2xl bg-ink-100/70 p-4 dark:bg-ink-900/70">
              <Library class="h-4 w-4 text-ink-500" /><p class="mt-3 text-2xl font-black">
                {{ sets.length }}
              </p><p class="text-xs font-bold text-ink-500">
                {{ $t('home.metricSets') }}
              </p>
            </div>
            <div class="rounded-2xl bg-ink-100/70 p-4 dark:bg-ink-900/70">
              <BookOpen class="h-4 w-4 text-ink-500" /><p class="mt-3 text-2xl font-black">
                {{ totalWordCount }}
              </p><p class="text-xs font-bold text-ink-500">
                {{ $t('home.metricWords') }}
              </p>
            </div>
            <div class="rounded-2xl bg-ink-100/70 p-4 dark:bg-ink-900/70">
              <Flame class="h-4 w-4 text-ink-500" /><p class="mt-3 text-2xl font-black">
                {{ stats.streakDays }}
              </p><p class="text-xs font-bold text-ink-500">
                {{ $t('learning.streak') }}
              </p>
            </div>
            <div class="rounded-2xl bg-ink-100/70 p-4 dark:bg-ink-900/70">
              <Target class="h-4 w-4 text-ink-500" /><p class="mt-3 text-2xl font-black">
                {{ accuracy }}%
              </p><p class="text-xs font-bold text-ink-500">
                {{ $t('learning.accuracy') }}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div v-if="activeSessions.length" class="space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-black">
            {{ $t('home.continueTitle') }}
          </h2><RouterLink to="/library" class="text-xs font-black text-ink-500">
            {{ $t('home.viewAll') }}
          </RouterLink>
        </div>
        <div class="grid gap-3 md:grid-cols-3">
          <Card v-for="set in activeSessions" :key="set.id" class="p-4">
            <p class="truncate text-sm font-black">
              {{ set.setName }}
            </p>
            <p class="mt-1 text-xs font-semibold text-ink-500">
              {{ $t('home.inProgress') }} · {{ set.items.length }} {{ $t('home.wordUnit') }}
            </p>
            <RouterLink to="/library" class="mt-4 inline-flex items-center gap-1 text-xs font-black text-ink-600 dark:text-ink-300">
              {{ $t('home.continue') }} <ArrowRight class="h-3.5 w-3.5" />
            </RouterLink>
          </Card>
        </div>
      </div>

      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-black">
            {{ $t('home.recentTitle') }}
          </h2><RouterLink to="/library" class="text-xs font-black text-ink-500">
            {{ $t('home.viewLibrary') }}
          </RouterLink>
        </div>
        <div class="grid gap-3 md:grid-cols-3">
          <RouterLink v-for="set in recentSets" :key="set.id" to="/library" class="group min-w-0 rounded-2xl border border-ink-200/60 bg-white/70 p-4 transition hover:-translate-y-0.5 hover:shadow-soft dark:border-ink-800 dark:bg-ink-950/50">
            <p class="truncate text-sm font-black group-hover:text-accent-primary">
              {{ set.setName }}
            </p>
            <p class="mt-1 text-xs font-semibold text-ink-500">
              {{ set.items.length }} {{ $t('home.wordUnit') }} · {{ $t('setCard.difficulty') }} {{ set.difficulty }}
            </p>
          </RouterLink>
        </div>
      </div>
    </template>
  </section>
</template>

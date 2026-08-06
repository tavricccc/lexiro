<script setup lang="ts">
import { ArrowRight, BarChart3, BookOpen, Flame, Library, Plus, RotateCcw, Sparkles, Target } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'
import { useLearningStore } from '@/stores/learning'
import { useLibraryStore } from '@/stores/library'
import { useSessionStore } from '@/stores/session'
import { useSetsStore } from '@/stores/sets'
import { useUIStore } from '@/stores/ui'
import Button from './ui/button/Button.vue'
import Card from './ui/card/Card.vue'
import Progress from './ui/progress/Progress.vue'

const router = useRouter()
const setsStore = useSetsStore()
const sessionStore = useSessionStore()
const learningStore = useLearningStore()
const libraryStore = useLibraryStore()
const { sets, hasSets, totalWordCount } = storeToRefs(setsStore)
const { stats, todayProgress, memoryAccuracy } = storeToRefs(learningStore)
const uiStore = useUIStore()
const { t } = useI18n()
const reviewPreparing = ref(false)

const dailyReviewCount = computed(() => learningStore.getDailyReviewEntries().length)
const canStartDailyReview = computed(() => dailyReviewCount.value > 0 || (!libraryStore.fullyHydrated && hasSets.value))
const activeSessions = computed(() => sets.value.filter(set => sessionStore.isSetInProgress(set.id)).slice(0, 3))
const recentSets = computed(() => [...sets.value].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')).slice(0, 3))

const questionPreparing = ref(false)

async function startReview() {
  reviewPreparing.value = true
  try {
    if (await learningStore.startDailyReviewFromRepository())
      await router.push({ name: 'review' })
  }
  catch {
    uiStore.showToast(t('sync.errorPersistence'))
  }
  finally {
    reviewPreparing.value = false
  }
}

async function startDailyQuiz() {
  questionPreparing.value = true
  try {
    const started = await sessionStore.startDailyQuestionRound()
    if (!started)
      uiStore.showToast(t('learning.noDailyQuestions'))
  }
  catch {
    uiStore.showToast(t('sync.errorPersistence'))
  }
  finally {
    questionPreparing.value = false
  }
}

async function continueSet(setId: string) {
  await libraryStore.hydrateSet(setId)
  const mode = sessionStore.getInProgressModes(setId)[0]
  if (mode && await sessionStore.resumeSession(setId, mode))
    return

  await router.push({ name: 'set-overview', params: { setId } })
}
</script>

<template>
  <section class="space-y-5 text-left">
    <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-ink-950 dark:text-ink-50">
          {{ $t('home.todayTitle') }}
        </h1>
      </div>
    </div>

    <div v-if="!hasSets" class="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <Card class="min-w-0 border-0 bg-ink-950 p-4 text-white dark:bg-white dark:text-ink-950 sm:p-5">
        <Sparkles class="h-6 w-6" />
        <h2 class="mt-8 text-xl font-black tracking-tight">
          {{ $t('home.emptyTitle') }}
        </h2>
        <p class="mt-3 max-w-md text-sm font-semibold leading-relaxed opacity-70">
          {{ $t('home.emptyDescription') }}
        </p>
        <Button variant="secondary" class="mt-5 gap-2" @click="router.push({ name: 'set-create' })">
          <Plus class="h-4 w-4" />
          {{ $t('home.addSet') }}
        </Button>
      </Card>
      <Card class="min-w-0 p-4 sm:p-5">
        <p class="text-xs font-black uppercase tracking-[0.18em] text-ink-400">
          {{ $t('home.howItWorks') }}
        </p>
        <div class="mt-5 space-y-4">
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
        <Card class="min-w-0 overflow-hidden border-0 bg-ink-950 p-4 text-white dark:bg-white dark:text-ink-950 sm:p-5">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-xs font-black uppercase tracking-[0.18em] opacity-60">
                {{ $t('learning.todayGoal') }}
              </p>
              <p class="mt-3 text-3xl font-black tabular-nums">
                {{ stats.todayMemoryReviews }}<span class="text-lg opacity-50">/{{ stats.dailyWordGoal }}</span>
              </p>
              <p class="mt-2 text-sm font-semibold opacity-70">
                {{ dailyReviewCount ? $t('home.dailyQueueHint', { count: dailyReviewCount }) : canStartDailyReview ? $t('home.reviewPreparing') : $t('learning.noDue') }}
              </p>
              <p class="mt-1 text-xs font-semibold opacity-60">
                {{ $t('learning.todayQuestions') }}：{{ stats.todayQuestionReviews }}/{{ stats.dailyQuestionGoal }}
              </p>
            </div>
            <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
              <Target class="h-6 w-6" />
            </div>
          </div>
          <Progress :model-value="todayProgress" class="mt-5 bg-white/15 [&>div]:bg-white dark:bg-ink-200/30 dark:[&>div]:bg-ink-950" />
          <div class="mt-5 flex flex-wrap gap-2">
            <Button v-if="canStartDailyReview" variant="secondary" class="gap-2" :loading="reviewPreparing" @click="startReview">
              <RotateCcw class="h-4 w-4" />
              {{ dailyReviewCount ? $t('learning.startToday', { count: dailyReviewCount }) : $t('home.startReview') }}
            </Button>
            <Button variant="secondary" class="gap-2" :loading="questionPreparing" @click="startDailyQuiz">
              <BookOpen class="h-4 w-4" />
              {{ $t('learning.startDailyQuiz') }}
            </Button>
          </div>
        </Card>

        <Card class="min-w-0 p-4 sm:p-5">
          <div class="flex items-center justify-between">
            <p class="text-xs font-black uppercase tracking-[0.18em] text-ink-400">
              {{ $t('home.snapshot') }}
            </p>
            <RouterLink to="/stats" class="inline-flex h-9 w-9 items-center justify-center rounded-xl text-ink-500 hover:bg-ink-100 hover:text-ink-950 dark:hover:bg-ink-900 dark:hover:text-white" :aria-label="$t('home.viewStats')" :title="$t('home.viewStats')">
              <BarChart3 class="h-4 w-4" aria-hidden="true" />
            </RouterLink>
          </div>
          <div class="mt-5 grid grid-cols-2 gap-3">
            <div class="rounded-2xl bg-ink-100/70 p-4 dark:bg-ink-900/70">
              <Library class="h-4 w-4 text-ink-500" /><p class="mt-2 text-xl font-black">
                {{ sets.length }}
              </p><p class="text-xs font-bold text-ink-500">
                {{ $t('home.metricSets') }}
              </p>
            </div>
            <div class="rounded-2xl bg-ink-100/70 p-4 dark:bg-ink-900/70">
              <BookOpen class="h-4 w-4 text-ink-500" /><p class="mt-2 text-xl font-black">
                {{ totalWordCount }}
              </p><p class="text-xs font-bold text-ink-500">
                {{ $t('home.metricWords') }}
              </p>
            </div>
            <div class="rounded-2xl bg-ink-100/70 p-4 dark:bg-ink-900/70">
              <Flame class="h-4 w-4 text-ink-500" /><p class="mt-2 text-xl font-black">
                {{ stats.streakDays }}
              </p><p class="text-xs font-bold text-ink-500">
                {{ $t('learning.streak') }}
              </p>
            </div>
            <div class="rounded-2xl bg-ink-100/70 p-4 dark:bg-ink-900/70">
              <Target class="h-4 w-4 text-ink-500" /><p class="mt-2 text-xl font-black">
                {{ memoryAccuracy }}%
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
          </h2>
          <RouterLink to="/library" class="inline-flex h-9 w-9 items-center justify-center rounded-xl text-ink-500 hover:bg-ink-100 hover:text-ink-950 dark:hover:bg-ink-900 dark:hover:text-white" :aria-label="$t('home.viewAll')" :title="$t('home.viewAll')">
            <Library class="h-4 w-4" aria-hidden="true" />
          </RouterLink>
        </div>
        <Card class="p-4 sm:p-5">
          <div class="grid gap-4 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-ink-200/60 dark:divide-ink-800">
            <div v-for="(set, idx) in activeSessions" :key="set.id" :class="idx > 0 ? 'md:pl-4' : ''" class="pt-3 md:pt-0">
              <p class="truncate text-sm font-black">
                {{ set.setName }}
              </p>
              <p class="mt-1 text-xs font-semibold text-ink-500">
                {{ $t('home.inProgress') }} · {{ setsStore.getSetWordCount(set.id) }} {{ $t('home.wordUnit') }}
              </p>
              <button type="button" class="mt-4 inline-flex min-h-11 items-center gap-1 text-xs font-black text-ink-600 dark:text-ink-300 hover:text-accent-primary" @click="continueSet(set.id)">
                {{ $t('home.continue') }} <ArrowRight class="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </Card>
      </div>

      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-black">
            {{ $t('home.recentTitle') }}
          </h2>
          <RouterLink to="/library" class="inline-flex h-9 w-9 items-center justify-center rounded-xl text-ink-500 hover:bg-ink-100 hover:text-ink-950 dark:hover:bg-ink-900 dark:hover:text-white" :aria-label="$t('home.viewLibrary')" :title="$t('home.viewLibrary')">
            <Library class="h-4 w-4" aria-hidden="true" />
          </RouterLink>
        </div>
        <Card class="p-4 sm:p-5">
          <div class="grid gap-4 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-ink-200/60 dark:divide-ink-800">
            <RouterLink v-for="(set, idx) in recentSets" :key="set.id" :to="{ name: 'set-overview', params: { setId: set.id } }" :class="idx > 0 ? 'md:pl-4' : ''" class="group min-w-0 pt-3 md:pt-0">
              <p class="truncate text-sm font-black group-hover:text-accent-primary">
                {{ set.setName }}
              </p>
              <p class="mt-1 text-xs font-semibold text-ink-500">
                {{ setsStore.getSetWordCount(set.id) }} {{ $t('home.wordUnit') }}
              </p>
            </RouterLink>
          </div>
        </Card>
      </div>
    </template>
  </section>
</template>

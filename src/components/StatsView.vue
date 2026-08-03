<script setup lang="ts">
import { BarChart3, Brain, CalendarDays, Flame, Gauge, ListChecks, Target, TrendingUp } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { isDue } from '@/lib/fsrs'
import { getLibraryRepository } from '@/lib/library-repository'
import { useLearningStore } from '@/stores/learning'
import { useSetsStore } from '@/stores/sets'
import Button from './ui/button/Button.vue'
import Card from './ui/card/Card.vue'
import Select from './ui/select/Select.vue'

type StatsTab = 'overview' | 'memory' | 'questions' | 'sets' | 'history'

const learningStore = useLearningStore()
const setsStore = useSetsStore()
const { t } = useI18n()
const { stats } = storeToRefs(learningStore)
const { sets } = storeToRefs(setsStore)
const selectedSetId = ref('')
const activeTab = ref<StatsTab>('overview')
const studySenseIdsBySet = ref<Record<string, string[]>>({})
const studyIndexReady = ref(false)
const studyIndexError = ref(false)
let studyIndexRequest = 0

async function loadStudyIndex() {
  const request = ++studyIndexRequest
  studyIndexReady.value = false
  studyIndexError.value = false
  try {
    const next = new Map<string, Set<string>>()
    for await (const batch of getLibraryRepository().streamMemberships()) {
      if (request !== studyIndexRequest)
        return
      for (const entry of batch) {
        const senseIds = next.get(entry.setId) ?? new Set<string>()
        for (const membership of entry.memberships)
          membership.senseIds.forEach(senseId => senseIds.add(senseId))
        next.set(entry.setId, senseIds)
      }
    }
    if (request !== studyIndexRequest)
      return
    studySenseIdsBySet.value = Object.fromEntries(Array.from(next.entries()).map(([setId, senseIds]) => [setId, Array.from(senseIds)]))
    studyIndexReady.value = true
  }
  catch {
    if (request === studyIndexRequest)
      studyIndexError.value = true
  }
}

onMounted(() => void loadStudyIndex())
onUnmounted(() => {
  studyIndexRequest += 1
})

const setOptions = computed(() => [
  { value: '', label: t('stats.allSets') },
  ...sets.value.map(set => ({ value: set.id, label: set.setName })),
])
const scopedSets = computed(() => selectedSetId.value ? sets.value.filter(set => set.id === selectedSetId.value) : sets.value)
const uniqueSenseIds = computed(() => Array.from(new Set(scopedSets.value.flatMap(set => studySenseIdsBySet.value[set.id] ?? []))))

const setStats = computed(() => scopedSets.value
  .map(set => ({
    set,
    learned: (studySenseIdsBySet.value[set.id] ?? []).filter(senseId => (learningStore.getCardProgress(senseId)?.reviewCount ?? 0) > 0).length,
    due: (studySenseIdsBySet.value[set.id] ?? []).filter((senseId) => {
      const card = learningStore.getCardProgress(senseId)
      return Boolean(card && isDue(card))
    }).length,
    total: setsStore.getSetWordCount(set.id),
  }))
  .sort((a, b) => b.learned - a.learned))

const fsrsStatuses = computed(() => {
  const counts = { unlearned: 0, learning: 0, scheduled: 0, due: 0 }
  for (const senseId of uniqueSenseIds.value) {
    const card = learningStore.getCardProgress(senseId)
    if (!card)
      counts.unlearned += 1
    else if (card.state === 1 || card.state === 3)
      counts.learning += 1
    else if (isDue(card))
      counts.due += 1
    else
      counts.scheduled += 1
  }
  return counts
})

const memoryStats = computed(() => {
  const total = uniqueSenseIds.value.reduce((sum, senseId) => sum + (learningStore.getCardProgress(senseId)?.reviewCount ?? 0), 0)
  const correct = uniqueSenseIds.value.reduce((sum, senseId) => sum + (learningStore.getCardProgress(senseId)?.correctCount ?? 0), 0)
  return { total, correct, accuracy: total ? Math.round((correct / total) * 100) : 0 }
})

const scopedQuestionStats = computed(() => {
  const result = Object.fromEntries(Object.keys(stats.value.questionStats).map(key => [key, { total: 0, correct: 0, retry: 0 }])) as typeof stats.value.questionStats
  for (const senseId of uniqueSenseIds.value) {
    const senseStats = stats.value.questionStatsBySense[senseId]
    if (!senseStats)
      continue
    for (const [key, value] of Object.entries(senseStats)) {
      result[key as keyof typeof result].total += value.total
      result[key as keyof typeof result].correct += value.correct
      result[key as keyof typeof result].retry += value.retry
    }
  }
  return result
})

const scopedQuestionTotal = computed(() => Object.values(scopedQuestionStats.value).reduce((sum, value) => sum + value.total, 0))

const recentActivities = computed(() => Object.values(stats.value.dailyHistory)
  .filter(activity => activity.memoryAgain + activity.memoryGood + activity.questionTotal > 0)
  .sort((a, b) => b.date.localeCompare(a.date))
  .slice(0, 14))

const questionStatRows = computed(() => Object.entries(scopedQuestionStats.value).map(([key, value]) => {
  const [questionType, difficulty] = key.split(':')
  const typeKey = questionType === 'fillBlank'
    ? 'practice.fillBlank'
    : questionType === 'reading' ? 'practice.reading' : 'practice.quiz'
  return {
    key,
    label: t(typeKey),
    difficulty: t(`library.difficulty${difficulty}`),
    ...value,
    accuracy: value.total ? Math.round((value.correct / value.total) * 100) : 0,
  }
}))

const tabs: { key: StatsTab, labelKey: string }[] = [
  { key: 'overview', labelKey: 'stats.tabOverview' },
  { key: 'memory', labelKey: 'stats.tabMemory' },
  { key: 'questions', labelKey: 'stats.tabQuestions' },
  { key: 'sets', labelKey: 'stats.tabSets' },
  { key: 'history', labelKey: 'stats.tabHistory' },
]
</script>

<template>
  <section class="space-y-4 text-left">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h1 class="text-2xl font-black tracking-tight">
        {{ $t('stats.title') }}
      </h1>
      <div v-if="sets.length && studyIndexReady" class="w-full sm:w-64">
        <Select v-model="selectedSetId" :options="setOptions" class="w-full text-xs" />
      </div>
    </div>

    <Card v-if="!sets.length" class="mx-auto max-w-xl p-6 text-center">
      <BarChart3 class="mx-auto h-8 w-8 text-accent-primary" />
      <h2 class="mt-4 text-xl font-black">
        {{ $t('stats.emptyTitle') }}
      </h2>
      <p class="mt-2 text-sm font-semibold leading-relaxed text-ink-500">
        {{ $t('stats.emptyDescription') }}
      </p>
      <RouterLink to="/library" class="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-accent-primary px-4 text-sm font-bold text-white">
        {{ $t('stats.openLibrary') }}
      </RouterLink>
    </Card>

    <template v-else-if="!studyIndexReady">
      <Card class="mx-auto max-w-xl p-6 text-center" role="status" aria-live="polite">
        <BarChart3 class="mx-auto h-8 w-8 text-accent-primary" />
        <h2 class="mt-4 text-xl font-black">
          {{ studyIndexError ? $t('stats.loadingFailed') : $t('stats.loading') }}
        </h2>
        <Button v-if="studyIndexError" class="mt-5" @click="loadStudyIndex">
          {{ $t('sync.retry') }}
        </Button>
      </Card>
    </template>

    <template v-else>
      <!-- Top 4 KPIs -->
      <div class="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Card class="p-4 sm:p-5">
          <Target class="h-4 w-4 text-ink-500" />
          <p class="mt-2 text-xl font-black sm:text-2xl">
            {{ memoryStats.total }}
          </p>
          <p class="mt-0.5 text-xs font-bold text-ink-500">
            {{ $t('learning.totalReviews', { count: memoryStats.total }) }}
          </p>
        </Card>
        <Card class="p-4 sm:p-5">
          <TrendingUp class="h-4 w-4 text-ink-500" />
          <p class="mt-2 text-xl font-black sm:text-2xl">
            {{ memoryStats.accuracy }}%
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

      <!-- Segmented Tab Nav (Mobile Horizontal Scrollable) -->
      <nav class="flex overflow-x-auto rounded-2xl bg-ink-100/70 p-1 no-scrollbar dark:bg-ink-900/70" role="tablist" :aria-label="$t('stats.title')">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          role="tab"
          :aria-selected="activeTab === tab.key"
          class="flex shrink-0 min-h-10 items-center justify-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all"
          :class="activeTab === tab.key ? 'bg-white text-accent-primary shadow-sm dark:bg-ink-800' : 'text-ink-500 hover:text-ink-900 dark:hover:text-ink-100'"
          @click="activeTab = tab.key"
        >
          {{ $t(tab.labelKey) }}
        </button>
      </nav>

      <!-- Tab Content 1: Overview -->
      <div v-if="activeTab === 'overview'" class="grid gap-4 lg:grid-cols-2">
        <Card class="p-5">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <Brain class="h-5 w-5" />
              <h2 class="font-black">
                {{ $t('stats.memoryTitle') }}
              </h2>
            </div>
            <span class="text-xs font-bold text-ink-400">{{ $t('stats.senseCount', { count: uniqueSenseIds.length }) }}</span>
          </div>
          <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div class="surface-inset p-3">
              <p class="text-xl font-black sm:text-2xl">
                {{ memoryStats.total }}
              </p>
              <p class="mt-1 text-xs font-bold text-ink-500">
                {{ $t('stats.attempts') }}
              </p>
            </div>
            <div class="surface-inset p-3">
              <p class="text-xl font-black sm:text-2xl">
                {{ memoryStats.accuracy }}%
              </p>
              <p class="mt-1 text-xs font-bold text-ink-500">
                {{ $t('stats.accuracy') }}
              </p>
            </div>
          </div>
        </Card>

        <Card class="p-5">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <ListChecks class="h-5 w-5" />
              <h2 class="font-black">
                {{ $t('stats.questionTitle') }}
              </h2>
            </div>
            <span class="text-xs font-bold text-ink-400">{{ scopedQuestionTotal }} {{ $t('stats.attempts') }}</span>
          </div>
          <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div class="surface-inset p-3">
              <p class="text-xl font-black sm:text-2xl">
                {{ scopedQuestionTotal }}
              </p>
              <p class="mt-1 text-xs font-bold text-ink-500">
                {{ $t('stats.attempts') }}
              </p>
            </div>
            <div class="surface-inset p-3">
              <p class="text-xl font-black sm:text-2xl">
                {{ stats.longestStreak }}
              </p>
              <p class="mt-1 text-xs font-bold text-ink-500">
                {{ $t('stats.longestStreak', { count: stats.longestStreak }) }}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <!-- Tab Content 2: Memory & FSRS -->
      <Card v-else-if="activeTab === 'memory'" class="p-5">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <Brain class="h-5 w-5" />
            <h2 class="font-black">
              {{ $t('stats.memoryTitle') }}
            </h2>
          </div>
          <span class="text-xs font-bold text-ink-400">{{ $t('stats.senseCount', { count: uniqueSenseIds.length }) }}</span>
        </div>
        <div class="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div class="surface-inset p-3">
            <p class="text-2xl font-black">
              {{ memoryStats.total }}
            </p>
            <p class="mt-1 text-xs font-bold text-ink-500">
              {{ $t('stats.attempts') }}
            </p>
          </div>
          <div class="surface-inset p-3">
            <p class="text-2xl font-black">
              {{ memoryStats.accuracy }}%
            </p>
            <p class="mt-1 text-xs font-bold text-ink-500">
              {{ $t('stats.accuracy') }}
            </p>
          </div>
        </div>
        <div class="mt-5 grid grid-cols-2 gap-2 text-xs font-bold text-ink-500 sm:grid-cols-4">
          <div class="surface-inset p-3">
            <span class="text-ink-400">{{ $t('stats.fsrsUnlearned') }}</span>
            <p class="mt-1 text-xl font-black text-ink-950 dark:text-ink-50">
              {{ fsrsStatuses.unlearned }}
            </p>
          </div>
          <div class="surface-inset p-3">
            <span class="text-ink-400">{{ $t('stats.fsrsLearning') }}</span>
            <p class="mt-1 text-xl font-black text-amber-600 dark:text-amber-400">
              {{ fsrsStatuses.learning }}
            </p>
          </div>
          <div class="surface-inset p-3">
            <span class="text-ink-400">{{ $t('stats.fsrsScheduled') }}</span>
            <p class="mt-1 text-xl font-black text-blue-600 dark:text-blue-400">
              {{ fsrsStatuses.scheduled }}
            </p>
          </div>
          <div class="surface-inset p-3">
            <span class="text-ink-400">{{ $t('stats.fsrsDue') }}</span>
            <p class="mt-1 text-xl font-black text-emerald-600 dark:text-emerald-400">
              {{ fsrsStatuses.due }}
            </p>
          </div>
        </div>
      </Card>

      <!-- Tab Content 3: Questions -->
      <Card v-else-if="activeTab === 'questions'" class="p-5">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <ListChecks class="h-5 w-5" />
            <h2 class="font-black">
              {{ $t('stats.questionTitle') }}
            </h2>
          </div>
          <span class="text-xs font-bold text-ink-400">{{ scopedQuestionTotal }} {{ $t('stats.attempts') }}</span>
        </div>
        <div class="mt-4 overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="text-ink-400">
              <tr>
                <th class="pb-2">
                  {{ $t('stats.questionType') }}
                </th>
                <th class="pb-2">
                  {{ $t('stats.questionDifficulty') }}
                </th>
                <th class="pb-2">
                  {{ $t('stats.attempts') }}
                </th>
                <th class="pb-2">
                  {{ $t('stats.accuracy') }}
                </th>
                <th class="pb-2">
                  {{ $t('stats.retry') }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in questionStatRows" :key="row.key" class="border-t border-ink-200/50 dark:border-ink-800/70">
                <td class="py-2.5 font-bold">
                  {{ row.label }}
                </td>
                <td class="py-2.5">
                  {{ row.difficulty }}
                </td>
                <td class="py-2.5">
                  {{ row.total }}
                </td>
                <td class="py-2.5">
                  {{ row.accuracy }}%
                </td>
                <td class="py-2.5">
                  {{ row.retry }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <!-- Tab Content 4: Sets -->
      <Card v-else-if="activeTab === 'sets'" class="p-5">
        <div class="flex items-center gap-2">
          <BarChart3 class="h-5 w-5" />
          <h2 class="font-black">
            {{ $t('stats.bySet') }}
          </h2>
        </div>
        <div v-if="setStats.length" class="mt-5 space-y-4">
          <div v-for="item in setStats" :key="item.set.id" class="rounded-xl border border-ink-200/60 p-3.5 dark:border-ink-800/70">
            <div class="flex items-center justify-between gap-3 text-sm">
              <span class="truncate font-black text-ink-950 dark:text-ink-50">{{ item.set.setName }}</span>
              <span class="shrink-0 text-xs font-bold text-ink-500">{{ item.learned }}/{{ item.total }} {{ $t('learning.learned') }} · {{ item.due }} {{ $t('learning.due') }}</span>
            </div>
          </div>
        </div>
        <div v-else class="py-10 text-center text-sm font-semibold text-ink-400">
          {{ $t('stats.empty') }}
        </div>
      </Card>

      <!-- Tab Content 5: Activity History -->
      <Card v-else-if="activeTab === 'history'" class="p-5">
        <div class="flex items-center gap-2">
          <CalendarDays class="h-5 w-5" />
          <h2 class="font-black">
            {{ $t('stats.historyTitle') }}
          </h2>
        </div>
        <div v-if="recentActivities.length" class="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <article v-for="activity in recentActivities" :key="activity.date" class="surface-inset space-y-1 p-3 text-xs font-semibold text-ink-500">
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
  </section>
</template>

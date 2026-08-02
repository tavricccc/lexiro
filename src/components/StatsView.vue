<script setup lang="ts">
import { BarChart3, Brain, CalendarDays, Flame, Gauge, ListChecks, Target, TrendingUp } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { isDue } from '@/lib/fsrs'
import { useLearningStore } from '@/stores/learning'
import { useLibraryStore } from '@/stores/library'
import { useSetsStore } from '@/stores/sets'
import Card from './ui/card/Card.vue'
import Select from './ui/select/Select.vue'

const learningStore = useLearningStore()
const libraryStore = useLibraryStore()
const setsStore = useSetsStore()
const { t } = useI18n()
const { stats } = storeToRefs(learningStore)
const { sets } = storeToRefs(setsStore)
const selectedSetId = ref('')

const setOptions = computed(() => [
  { value: '', label: t('stats.allSets') },
  ...sets.value.map(set => ({ value: set.id, label: set.setName })),
])
const scopedSets = computed(() => selectedSetId.value ? sets.value.filter(set => set.id === selectedSetId.value) : sets.value)

const setStats = computed(() => scopedSets.value
  .map(set => ({
    set,
    learned: learningStore.getLearnedCount(set.id),
    due: learningStore.getDueCount(set.id),
    total: setsStore.getSetWordCount(set.id),
  }))
  .sort((a, b) => b.learned - a.learned))

const uniqueSenseItems = computed(() => Array.from(new Map(
  scopedSets.value.flatMap(set => libraryStore.getSetStudyWords(set.id)).map(item => [item.id, item]),
).values()))

const fsrsStatuses = computed(() => {
  const counts = { unlearned: 0, learning: 0, scheduled: 0, due: 0 }
  for (const item of uniqueSenseItems.value) {
    const card = learningStore.getCardProgress(item.id)
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
  const total = uniqueSenseItems.value.reduce((sum, item) => sum + (learningStore.getCardProgress(item.id)?.reviewCount ?? 0), 0)
  const correct = uniqueSenseItems.value.reduce((sum, item) => sum + (learningStore.getCardProgress(item.id)?.correctCount ?? 0), 0)
  return { total, correct, accuracy: total ? Math.round((correct / total) * 100) : 0 }
})

const scopedQuestionStats = computed(() => {
  const result = Object.fromEntries(Object.keys(stats.value.questionStats).map(key => [key, { total: 0, correct: 0, retry: 0 }])) as typeof stats.value.questionStats
  for (const item of uniqueSenseItems.value) {
    const senseStats = stats.value.questionStatsBySense[item.id]
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
</script>

<template>
  <section class="space-y-6 text-left">
    <div>
      <h1 class="text-3xl font-black tracking-tight">
        {{ $t('stats.title') }}
      </h1>
    </div>

    <Card class="p-4">
      <label class="block text-xs font-black uppercase tracking-wider text-ink-400">{{ $t('stats.setFilter') }}</label>
      <Select v-model="selectedSetId" class="mt-2" :options="setOptions" />
    </Card>

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card class="p-5">
        <Target class="h-5 w-5 text-ink-500" />
        <p class="mt-4 text-3xl font-black">
          {{ memoryStats.total }}
        </p>
        <p class="mt-1 text-xs font-bold text-ink-500">
          {{ $t('learning.totalReviews', { count: memoryStats.total }) }}
        </p>
      </Card>
      <Card class="p-5">
        <TrendingUp class="h-5 w-5 text-ink-500" />
        <p class="mt-4 text-3xl font-black">
          {{ memoryStats.accuracy }}%
        </p>
        <p class="mt-1 text-xs font-bold text-ink-500">
          {{ $t('learning.accuracy') }}
        </p>
      </Card>
      <Card class="p-5">
        <Flame class="h-5 w-5 text-ink-500" />
        <p class="mt-4 text-3xl font-black">
          {{ stats.streakDays }}
        </p>
        <p class="mt-1 text-xs font-bold text-ink-500">
          {{ $t('learning.streak') }}
        </p>
        <p class="mt-1 text-[11px] font-semibold text-ink-400">
          {{ $t('stats.longestStreak', { count: stats.longestStreak }) }}
        </p>
      </Card>
      <Card class="p-5">
        <Gauge class="h-5 w-5 text-ink-500" />
        <p class="mt-4 text-3xl font-black">
          {{ stats.level }}
        </p>
        <p class="mt-1 text-xs font-bold text-ink-500">
          {{ $t('stats.level') }} · {{ stats.xp }} XP
        </p>
      </Card>
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      <Card class="p-6">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <Brain class="h-5 w-5" />
            <h2 class="font-black">
              {{ $t('stats.memoryTitle') }}
            </h2>
          </div>
          <span class="text-xs font-bold text-ink-400">{{ $t('stats.senseCount', { count: uniqueSenseItems.length }) }}</span>
        </div>
        <div class="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div class="surface-inset p-3">
            <p class="text-2xl font-black">
              {{ memoryStats.total }}
            </p><p class="mt-1 text-xs font-bold text-ink-500">
              {{ $t('stats.attempts') }}
            </p>
          </div>
          <div class="surface-inset p-3">
            <p class="text-2xl font-black">
              {{ memoryStats.accuracy }}%
            </p><p class="mt-1 text-xs font-bold text-ink-500">
              {{ $t('stats.accuracy') }}
            </p>
          </div>
        </div>
        <div class="mt-5 grid grid-cols-2 gap-2 text-xs font-bold text-ink-500 sm:grid-cols-4">
          <span>{{ $t('stats.fsrsUnlearned') }}：{{ fsrsStatuses.unlearned }}</span>
          <span>{{ $t('stats.fsrsLearning') }}：{{ fsrsStatuses.learning }}</span>
          <span>{{ $t('stats.fsrsScheduled') }}：{{ fsrsStatuses.scheduled }}</span>
          <span>{{ $t('stats.fsrsDue') }}：{{ fsrsStatuses.due }}</span>
        </div>
      </Card>

      <Card class="p-6">
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
                <td class="py-2 font-bold">
                  {{ row.label }}
                </td>
                <td class="py-2">
                  {{ row.difficulty }}
                </td>
                <td class="py-2">
                  {{ row.total }}
                </td>
                <td class="py-2">
                  {{ row.accuracy }}%
                </td>
                <td class="py-2">
                  {{ row.retry }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>

    <Card class="p-6">
      <div class="flex items-center gap-2">
        <BarChart3 class="h-5 w-5" />
        <h2 class="font-black">
          {{ $t('stats.bySet') }}
        </h2>
      </div>
      <div v-if="setStats.length" class="mt-6 space-y-5">
        <div v-for="item in setStats" :key="item.set.id">
          <div class="flex items-center justify-between gap-3 text-sm">
            <span class="truncate font-black">{{ item.set.setName }}</span>
            <span class="shrink-0 text-xs font-bold text-ink-500">{{ item.learned }}/{{ item.total }} {{ $t('learning.learned') }} · {{ item.due }} {{ $t('learning.due') }}</span>
          </div>
        </div>
      </div>
      <div v-else class="py-10 text-center text-sm font-semibold text-ink-400">
        {{ $t('stats.empty') }}
      </div>
    </Card>

    <Card class="p-6">
      <div class="flex items-center gap-2">
        <CalendarDays class="h-5 w-5" />
        <h2 class="font-black">
          {{ $t('stats.historyTitle') }}
        </h2>
      </div>
      <div v-if="recentActivities.length" class="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <article v-for="activity in recentActivities" :key="activity.date" class="surface-inset space-y-1 p-3 text-xs font-semibold text-ink-500">
          <p class="font-black text-ink-950 dark:text-ink-50">
            {{ activity.date }}
          </p>
          <p>{{ $t('stats.historyMemory', { count: activity.memoryAgain + activity.memoryGood }) }}</p>
          <p>{{ $t('stats.historyQuestions', { count: activity.questionTotal }) }}</p>
          <p>{{ $t('stats.historyXp', { count: activity.xpEarned }) }}</p>
        </article>
      </div>
      <p v-else class="mt-5 text-sm font-semibold text-ink-400">
        {{ $t('stats.historyEmpty') }}
      </p>
    </Card>
  </section>
</template>

<script setup lang="ts">
import { BarChart3 } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { isDue } from '@/lib/fsrs'
import { getLibraryRepository } from '@/lib/library-repository'
import { useLearningStore } from '@/stores/learning'
import { useSetsStore } from '@/stores/sets'
import StatsHistoryPanel from './stats/StatsHistoryPanel.vue'
import StatsKpiGrid from './stats/StatsKpiGrid.vue'
import StatsMemoryPanel from './stats/StatsMemoryPanel.vue'
import StatsOverviewPanel from './stats/StatsOverviewPanel.vue'
import StatsQuestionsPanel from './stats/StatsQuestionsPanel.vue'
import StatsSetsPanel from './stats/StatsSetsPanel.vue'
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

const setOptions = computed(() => [{ value: '', label: t('stats.allSets') }, ...sets.value.map(set => ({ value: set.id, label: set.setName }))])
const scopedSets = computed(() => selectedSetId.value ? sets.value.filter(set => set.id === selectedSetId.value) : sets.value)
const uniqueSenseIds = computed(() => Array.from(new Set(scopedSets.value.flatMap(set => studySenseIdsBySet.value[set.id] ?? []))))
const setStats = computed(() => scopedSets.value.map(set => ({
  set,
  learned: (studySenseIdsBySet.value[set.id] ?? []).filter(senseId => (learningStore.getCardProgress(senseId)?.reviewCount ?? 0) > 0).length,
  due: (studySenseIdsBySet.value[set.id] ?? []).filter((senseId) => {
    const card = learningStore.getCardProgress(senseId)
    return Boolean(card && isDue(card))
  }).length,
  total: setsStore.getSetWordCount(set.id),
})).sort((left, right) => right.learned - left.learned))

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
const recentActivities = computed(() => Object.values(stats.value.dailyHistory).filter(activity => activity.memoryAgain + activity.memoryGood + activity.questionTotal > 0).sort((left, right) => right.date.localeCompare(left.date)).slice(0, 14))
const questionStatRows = computed(() => Object.entries(scopedQuestionStats.value).map(([key, value]) => {
  const [questionType, difficulty] = key.split(':')
  const typeKey = questionType === 'fillBlank' ? 'practice.fillBlank' : questionType === 'reading' ? 'practice.reading' : 'practice.quiz'
  return { key, label: t(typeKey), difficulty: t(`library.difficulty${difficulty}`), ...value, accuracy: value.total ? Math.round((value.correct / value.total) * 100) : 0 }
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
      <BarChart3 class="mx-auto h-8 w-8 text-accent-primary" /><h2 class="mt-4 text-xl font-black">
        {{ $t('stats.emptyTitle') }}
      </h2>
      <p class="mt-2 text-sm font-semibold leading-relaxed text-ink-500">
        {{ $t('stats.emptyDescription') }}
      </p>
      <RouterLink to="/library" class="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-accent-primary px-4 text-sm font-bold text-white">
        {{ $t('stats.openLibrary') }}
      </RouterLink>
    </Card>
    <Card v-else-if="!studyIndexReady" class="mx-auto max-w-xl p-6 text-center" role="status" aria-live="polite">
      <BarChart3 class="mx-auto h-8 w-8 text-accent-primary" /><h2 class="mt-4 text-xl font-black">
        {{ studyIndexError ? $t('stats.loadingFailed') : $t('stats.loading') }}
      </h2>
      <Button v-if="studyIndexError" class="mt-5" @click="loadStudyIndex">
        {{ $t('sync.retry') }}
      </Button>
    </Card>
    <template v-else>
      <StatsKpiGrid :memory="memoryStats" :stats="stats" />
      <nav class="flex overflow-x-auto rounded-2xl bg-ink-100/70 p-1 no-scrollbar dark:bg-ink-900/70" role="tablist" :aria-label="$t('stats.title')">
        <button v-for="tab in tabs" :key="tab.key" type="button" role="tab" :aria-selected="activeTab === tab.key" class="flex min-h-10 shrink-0 items-center justify-center rounded-xl px-3.5 py-1.5 text-xs font-bold transition-[color,background-color]" :class="activeTab === tab.key ? 'bg-white text-accent-primary shadow-sm dark:bg-ink-800' : 'text-ink-500 hover:text-ink-900 dark:hover:text-ink-100'" @click="activeTab = tab.key">
          {{ $t(tab.labelKey) }}
        </button>
      </nav>
      <StatsOverviewPanel v-if="activeTab === 'overview'" :memory="memoryStats" :sense-count="uniqueSenseIds.length" :question-total="scopedQuestionTotal" :longest-streak="stats.longestStreak" />
      <StatsMemoryPanel v-else-if="activeTab === 'memory'" :memory="memoryStats" :statuses="fsrsStatuses" :sense-count="uniqueSenseIds.length" />
      <StatsQuestionsPanel v-else-if="activeTab === 'questions'" :rows="questionStatRows" :total="scopedQuestionTotal" />
      <StatsSetsPanel v-else-if="activeTab === 'sets'" :rows="setStats" />
      <StatsHistoryPanel v-else :activities="recentActivities" />
    </template>
  </section>
</template>

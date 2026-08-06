<script setup lang="ts">
import { BookOpenCheck, Brain, CircleHelp, Flame } from 'lucide-vue-next'
import { computed } from 'vue'
import { useLearningStore } from '@/stores/learning'
import { useLibraryStore } from '@/stores/library'
import Card from '../ui/card/Card.vue'

const props = defineProps<{
  setId: string
}>()

const libraryStore = useLibraryStore()
const learningStore = useLearningStore()
const set = computed(() => libraryStore.getSet(props.setId))
const words = computed(() => libraryStore.getSetWords(props.setId))
const studyWords = computed(() => libraryStore.getSetStudyWords(props.setId))
const questions = computed(() => libraryStore.questions.filter(question => libraryStore.getQuestionSetIds(question).includes(props.setId)))
const dueCount = computed(() => learningStore.getDueCount(props.setId))
const learnedCount = computed(() => learningStore.getLearnedCount(props.setId))
const recentWords = computed(() => words.value.slice().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 5))
const metrics = computed(() => [
  { label: 'set.metricWords', value: words.value.length, icon: BookOpenCheck },
  { label: 'set.metricQuestions', value: questions.value.length, icon: CircleHelp },
  { label: 'set.metricDue', value: dueCount.value, icon: Flame },
  { label: 'set.metricLearned', value: `${learnedCount.value}/${studyWords.value.length}`, icon: Brain },
])
</script>

<template>
  <section v-if="set" class="space-y-4 text-left sm:space-y-5">
    <Card class="p-4 sm:p-5">
      <div class="grid grid-cols-2 gap-4 xl:grid-cols-4 divide-y divide-ink-200/50 sm:divide-y-0 xl:divide-x dark:divide-ink-800">
        <div v-for="(metric, idx) in metrics" :key="metric.label" :class="idx > 0 ? 'xl:pl-5' : ''" class="pt-2 sm:pt-0">
          <div class="flex items-center justify-between gap-3">
            <span class="text-xs font-black uppercase tracking-wider text-ink-400">{{ $t(metric.label) }}</span>
            <component :is="metric.icon" class="h-4 w-4 text-accent-primary" />
          </div>
          <p class="mt-2 text-xl font-black tabular-nums">
            {{ metric.value }}
          </p>
        </div>
      </div>
    </Card>

    <Card class="p-4 sm:p-5">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-black">
            {{ $t('set.recentTitle') }}
          </h2>
          <p class="mt-1 text-sm font-semibold text-ink-500">
            {{ $t('set.recentWord') }}
          </p>
        </div>
      </div>
      <div v-if="recentWords.length" class="mt-4 grid gap-2 sm:grid-cols-2">
        <RouterLink v-for="word in recentWords" :key="word.wordKey" :to="{ name: 'set-word', params: { setId, wordKey: word.wordKey } }" class="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-ink-200/60 px-4 py-2.5 text-sm font-bold transition-colors hover:border-accent-primary/40 hover:bg-accent-primary/5 dark:border-ink-200/15">
          <span class="truncate">{{ word.word }}</span>
        </RouterLink>
      </div>
      <p v-else class="mt-4 text-sm font-semibold text-ink-400">
        {{ $t('set.recentEmpty') }}
      </p>
    </Card>
  </section>
</template>

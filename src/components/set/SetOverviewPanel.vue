<script setup lang="ts">
import { BookOpenCheck, Brain, CircleHelp, Flame, Play } from 'lucide-vue-next'
import { computed } from 'vue'
import { useLearningStore } from '@/stores/learning'
import { useLibraryStore } from '@/stores/library'
import Button from '../ui/button/Button.vue'
import Card from '../ui/card/Card.vue'

const props = defineProps<{
  setId: string
}>()

defineEmits<{
  'start-practice': []
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
  <section v-if="set" class="space-y-5 text-left">
    <Card class="overflow-hidden p-4 sm:p-5">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="max-w-2xl">
          <p class="text-xs font-black uppercase tracking-wider text-accent-primary">
            {{ $t('set.overviewTab') }}
          </p>
          <h2 class="mt-2 text-xl font-black tracking-tight">
            {{ set.setName }}
          </h2>
          <p class="mt-2 text-sm font-semibold leading-relaxed text-ink-500">
            {{ $t('set.overviewDescription') }}
          </p>
        </div>
        <Button class="shrink-0 gap-2 px-4 font-black" @click="$emit('start-practice')">
          <Play class="h-4 w-4" />{{ $t('set.startPractice') }}
        </Button>
      </div>
    </Card>

    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card v-for="metric in metrics" :key="metric.label" class="p-4">
        <div class="flex items-center justify-between gap-3">
          <span class="text-xs font-black uppercase tracking-wider text-ink-400">{{ $t(metric.label) }}</span>
          <component :is="metric.icon" class="h-4 w-4 text-accent-primary" />
        </div>
        <p class="mt-2 text-xl font-black tabular-nums">
          {{ metric.value }}
        </p>
      </Card>
    </div>

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
          <span class="shrink-0 text-xs font-semibold text-ink-400">{{ $t('set.senseCount', { count: word.senses.length }) }}</span>
        </RouterLink>
      </div>
      <p v-else class="mt-4 text-sm font-semibold text-ink-400">
        {{ $t('set.recentEmpty') }}
      </p>
    </Card>
  </section>
</template>

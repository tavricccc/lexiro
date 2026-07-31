<script setup lang="ts">
import type { PracticeMode } from '@/types'
import { ArrowLeft, ArrowRight, BookOpenText, CheckCircle2, FileText, Folder } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useLibraryStore } from '@/stores/library'
import { useSessionStore } from '@/stores/session'
import { useSetsStore } from '@/stores/sets'
import QuestionGenerationPanel from './QuestionGenerationPanel.vue'
import Button from './ui/button/Button.vue'
import Card from './ui/card/Card.vue'
import WordDetailCard from './WordDetailCard.vue'

const route = useRoute()
const router = useRouter()
const setsStore = useSetsStore()
const libraryStore = useLibraryStore()
const sessionStore = useSessionStore()
const { t } = useI18n()
const { sets } = storeToRefs(setsStore)
const setId = computed(() => typeof route.params.setId === 'string' ? route.params.setId : '')
const activeSet = computed(() => sets.value.find(set => set.id === setId.value) ?? null)
const words = computed(() => activeSet.value ? libraryStore.getSetWords(activeSet.value.id) : [])
const selectedIndex = ref(0)
const selectedMode = ref<Extract<PracticeMode, 'cloze' | 'reading'>>('cloze')
const selectedCount = ref(5)

const selectedWord = computed(() => words.value[selectedIndex.value] ?? words.value[0] ?? null)
const availableCount = computed(() => activeSet.value ? sessionStore.getAvailablePracticeCount(activeSet.value.id, selectedMode.value) : 0)
const countOptions = computed(() => {
  const total = availableCount.value
  if (total <= 5)
    return [total]
  const options = Array.from({ length: Math.floor(total / 5) }, (_, index) => (index + 1) * 5)
  if (options.at(-1) !== total)
    options.push(total)
  return options
})
const selectedCountIndex = computed(() => Math.max(0, countOptions.value.indexOf(Math.min(selectedCount.value, countOptions.value.at(-1) ?? 1))))
const folderName = computed(() => {
  const folderId = activeSet.value?.folderId
  return libraryStore.folders.find(folder => folder.id === folderId)?.name ?? t('study.folderNone')
})

watch([setId, words], () => {
  selectedIndex.value = Math.min(selectedIndex.value, Math.max(0, words.value.length - 1))
  selectedCount.value = countOptions.value.at(-1) ?? 1
}, { immediate: true })

watch(selectedMode, () => {
  selectedCount.value = countOptions.value.at(-1) ?? 1
})

function updateSelectedCount(event: Event) {
  selectedCount.value = countOptions.value[Number((event.target as HTMLInputElement).value)] ?? 1
}

function startPractice() {
  if (!activeSet.value || !availableCount.value)
    return
  sessionStore.handlePracticeCountChange(activeSet.value.id, selectedCount.value, availableCount.value)
  void sessionStore.startRound(selectedMode.value, activeSet.value.id)
}

function enterSet() {
  if (!activeSet.value)
    return
  setsStore.ensureActiveSet(activeSet.value.id)
}

onMounted(enterSet)
</script>

<template>
  <section v-if="activeSet" class="space-y-6 text-left">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div class="min-w-0">
        <Button variant="ghost" class="mb-3 -ml-3 gap-2 text-ink-500" @click="router.push({ name: 'library' })">
          <ArrowLeft class="h-4 w-4" />{{ $t('study.backToLibrary') }}
        </Button>
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="break-words text-3xl font-black tracking-tight">
            {{ activeSet.setName }}
          </h1>
          <span class="inline-flex items-center gap-1 text-xs font-semibold text-ink-400"><Folder class="h-3.5 w-3.5" />{{ folderName }}</span>
        </div>
        <p class="mt-1 text-sm font-semibold text-ink-500">
          {{ words.length }} {{ $t('home.wordUnit') }}
        </p>
      </div>
    </div>

    <div v-if="words.length" class="grid gap-5 lg:grid-cols-[minmax(12rem,16rem)_minmax(0,1fr)]">
      <Card class="p-3 lg:max-h-[35rem] lg:overflow-y-auto">
        <p class="px-2 pb-2 text-xs font-black uppercase tracking-wider text-ink-400">
          {{ $t('study.wordList') }}
        </p>
        <div class="space-y-1">
          <button v-for="(word, index) in words" :key="word.wordKey" type="button" class="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left transition-colors" :class="selectedIndex === index ? 'bg-accent-primary/10 text-accent-primary' : 'text-ink-700 hover:bg-ink-100 dark:text-ink-200 dark:hover:bg-ink-800'" @click="selectedIndex = index">
            <span class="truncate text-sm font-bold">{{ word.word }}</span>
            <CheckCircle2 v-if="selectedIndex === index" class="h-4 w-4 shrink-0" />
          </button>
        </div>
      </Card>

      <WordDetailCard :word="selectedWord" />
    </div>
    <Card v-else class="p-8 text-center text-sm font-semibold text-ink-400">
      {{ $t('study.noWords') }}
    </Card>

    <Card v-if="words.length" class="p-5 sm:p-6">
      <div class="flex flex-col gap-1">
        <h2 class="text-xl font-black">
          {{ $t('study.practiceTitle') }}
        </h2>
        <p class="text-sm font-semibold text-ink-500">
          {{ $t('study.practiceDescription') }}
        </p>
      </div>
      <div class="mt-5 grid gap-3 sm:grid-cols-2">
        <button type="button" class="rounded-2xl border p-4 text-left transition-colors" :class="selectedMode === 'cloze' ? 'border-accent-primary bg-accent-primary/10' : 'border-ink-200/70 hover:border-accent-primary/40 dark:border-ink-200/20'" @click="selectedMode = 'cloze'">
          <div class="flex items-center gap-3">
            <FileText class="h-5 w-5 text-accent-primary" /><span class="font-extrabold">{{ $t('practice.fillBlank') }}</span>
          </div>
          <p class="mt-2 text-xs font-semibold text-ink-500">
            {{ $t('study.available', { count: sessionStore.getAvailablePracticeCount(activeSet.id, 'cloze') }) }}
          </p>
        </button>
        <button type="button" class="rounded-2xl border p-4 text-left transition-colors" :class="selectedMode === 'reading' ? 'border-accent-primary bg-accent-primary/10' : 'border-ink-200/70 hover:border-accent-primary/40 dark:border-ink-200/20'" @click="selectedMode = 'reading'">
          <div class="flex items-center gap-3">
            <BookOpenText class="h-5 w-5 text-accent-primary" /><span class="font-extrabold">{{ $t('practice.reading') }}</span>
          </div>
          <p class="mt-2 text-xs font-semibold text-ink-500">
            {{ $t('study.available', { count: sessionStore.getAvailablePracticeCount(activeSet.id, 'reading') }) }}
          </p>
        </button>
      </div>
      <div class="mt-5 space-y-2">
        <label class="flex items-center justify-between text-xs font-black uppercase tracking-wider text-ink-400"><span>{{ $t('practice.countLabel') }}</span><span class="text-ink-950 dark:text-ink-50">{{ $t('study.selectedQuestionCount', { count: selectedCount }) }}</span></label>
        <input type="range" :min="0" :max="Math.max(countOptions.length - 1, 0)" :value="selectedCountIndex" class="h-2 w-full cursor-pointer appearance-none rounded-full bg-ink-200 accent-accent-primary dark:bg-ink-800" :disabled="!availableCount" @input="updateSelectedCount">
        <div class="flex justify-between text-[11px] font-semibold text-ink-400">
          <span>{{ countOptions[0] ?? 0 }}</span><span>{{ countOptions.at(-1) ?? 0 }}</span>
        </div>
      </div>
      <Button class="mt-5 w-full gap-2 sm:w-auto" :disabled="!availableCount" @click="startPractice">
        <ArrowRight class="h-4 w-4" />{{ $t('study.startPractice') }}
      </Button>
    </Card>

    <QuestionGenerationPanel v-if="activeSet" :set-id="activeSet.id" />
  </section>
  <div v-else class="py-20 text-center text-sm font-semibold text-ink-400">
    {{ $t('study.noWords') }}
  </div>
</template>

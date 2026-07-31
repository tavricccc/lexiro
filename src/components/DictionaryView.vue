<script setup lang="ts">
import type { DictionaryEntry, LibraryQuestion, WordEntry } from '@/types'
import { AudioLines, BookOpen, ExternalLink, LoaderCircle, Search, Volume2 } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { dictionaryAudio, dictionaryDefinitions, lookupDictionary } from '@/lib/dictionary'
import { normalizeWordKey } from '@/lib/library'
import { useLibraryStore } from '@/stores/library'
import { useSetsStore } from '@/stores/sets'
import Badge from './ui/badge/Badge.vue'
import Button from './ui/button/Button.vue'
import Card from './ui/card/Card.vue'
import Input from './ui/input/Input.vue'

const libraryStore = useLibraryStore()
const setsStore = useSetsStore()
const { words } = storeToRefs(libraryStore)
const { sets } = storeToRefs(setsStore)

const query = ref('')
const loading = ref(false)
const error = ref('')
const entries = ref<DictionaryEntry[]>([])
const selectedWordKey = ref('')

const localMatches = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q)
    return []
  return words.value
    .filter(word => word.word.toLowerCase().includes(q) || word.senses.some(sense => [sense.meaningZh, sense.definitionEn ?? '', ...sense.examples].some(value => value.toLowerCase().includes(q))))
    .slice(0, 8)
})

const selectedWord = computed<WordEntry | null>(() => words.value.find(word => word.wordKey === selectedWordKey.value) ?? null)

const selectedQuestions = computed(() => libraryStore.questions.filter((question) => {
  if (question.kind === 'reading')
    return question.wordKeys.includes(selectedWordKey.value)
  return question.wordKey === selectedWordKey.value
}))

const savedSetNames = computed(() => {
  if (!selectedWord.value)
    return []
  const names = sets.value
    .filter(set => set.items.some(item => normalizeWordKey(item.word) === selectedWord.value!.wordKey))
    .map(set => set.setName)
  return Array.from(new Set(names))
})

async function search() {
  const word = query.value.trim()
  if (!word)
    return
  loading.value = true
  error.value = ''
  selectedWordKey.value = normalizeWordKey(word)
  try {
    entries.value = await lookupDictionary(word)
  }
  catch (err) {
    entries.value = []
    error.value = (err as Error).message
  }
  finally {
    loading.value = false
  }
}

function selectLocalWord(word: WordEntry) {
  query.value = word.word
  selectedWordKey.value = word.wordKey
  void search()
}

function playAudio(entry: DictionaryEntry) {
  const url = dictionaryAudio(entry)
  if (url)
    new Audio(url).play().catch(() => undefined)
}

function questionLabel(question: LibraryQuestion): string {
  if (question.kind === 'multipleChoice')
    return '選擇題'
  if (question.kind === 'cloze')
    return '填空題'
  return '閱讀理解'
}
</script>

<template>
  <section class="space-y-6 text-left">
    <div>
      <h1 class="text-3xl font-black tracking-tight">
        {{ $t('dictionary.title') }}
      </h1>
    </div>

    <Card class="p-4 sm:p-5">
      <form class="flex gap-2" @submit.prevent="search">
        <Input v-model="query" autofocus :placeholder="$t('dictionary.searchPlaceholder')" class="h-12 rounded-2xl text-base" />
        <Button type="submit" variant="default" size="icon" class="h-12 w-12 shrink-0 rounded-2xl" :aria-label="$t('dictionary.search')">
          <LoaderCircle v-if="loading" class="h-5 w-5 animate-spin" /><Search v-else class="h-5 w-5" />
        </Button>
      </form>
      <div v-if="localMatches.length" class="mt-4 flex flex-wrap gap-2">
        <button v-for="word in localMatches" :key="word.wordKey" type="button" class="rounded-full bg-ink-100 px-3 py-1.5 text-xs font-semibold text-ink-600 transition-colors hover:bg-ink-200 dark:bg-ink-900 dark:text-ink-300" @click="selectLocalWord(word)">
          {{ word.word }} · {{ word.senses.length }} 個詞義
        </button>
      </div>
    </Card>

    <div v-if="error" class="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
      {{ error }}
    </div>

    <Card v-if="selectedWord" class="border border-accent-primary/15 p-5 sm:p-6">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wider text-accent-primary">
            {{ $t('dictionary.savedTitle') }}
          </p>
          <h2 class="mt-1 text-2xl font-bold tracking-tight">
            {{ selectedWord.word }}
          </h2>
        </div>
        <div class="flex flex-wrap justify-end gap-1.5">
          <Badge v-for="name in savedSetNames" :key="name" variant="secondary" class="rounded-lg text-xs">
            {{ name }}
          </Badge>
        </div>
      </div>
      <div class="mt-5 space-y-3">
        <article v-for="sense in selectedWord.senses" :key="sense.id" class="surface-inset p-4">
          <div class="flex flex-wrap items-center gap-2">
            <Badge v-if="sense.pos" variant="secondary" class="rounded-md text-[10px]">
              {{ sense.pos }}
            </Badge>
            <p class="text-sm font-bold leading-relaxed">
              {{ sense.meaningZh }}
            </p>
          </div>
          <p v-if="sense.definitionEn" class="mt-2 text-sm leading-relaxed text-ink-600 dark:text-ink-300">
            {{ sense.definitionEn }}
          </p>
          <ul v-if="sense.examples.length" class="mt-3 space-y-1 text-sm font-medium italic leading-relaxed text-ink-500">
            <li v-for="example in sense.examples" :key="example">
              “{{ example }}”
            </li>
          </ul>
        </article>
      </div>
      <div v-if="selectedQuestions.length" class="mt-4 space-y-3">
        <div class="flex items-center gap-2 text-xs font-semibold text-ink-400">
          <BookOpen class="h-4 w-4" />{{ $t('dictionary.savedQuestion') }}
        </div>
        <article v-for="question in selectedQuestions.slice(0, 8)" :key="question.id" class="surface-inset p-4">
          <Badge variant="secondary" class="rounded-md text-[10px]">
            {{ questionLabel(question) }}
          </Badge>
          <template v-if="question.kind === 'reading'">
            <p class="mt-2 text-sm font-bold">
              {{ question.title }}
            </p>
            <p class="mt-1 line-clamp-3 text-sm leading-relaxed text-ink-600 dark:text-ink-300">
              {{ question.passage }}
            </p>
          </template>
          <template v-else>
            <p class="mt-2 text-sm font-bold leading-relaxed">
              {{ question.prompt }}
            </p>
            <div v-if="question.kind === 'multipleChoice'" class="mt-3 grid gap-2 sm:grid-cols-2">
              <div v-for="(option, index) in question.options" :key="`${question.id}-${option}`" class="rounded-xl bg-white/70 px-3 py-2 text-sm dark:bg-ink-900/70" :class="index === question.answerIndex ? 'font-semibold text-emerald-700 dark:text-emerald-300' : 'text-ink-600 dark:text-ink-300'">
                {{ String.fromCharCode(65 + index) }}. {{ option }}
              </div>
            </div>
          </template>
        </article>
      </div>
    </Card>

    <div v-if="!entries.length && !loading && !error" class="grid gap-4 lg:grid-cols-3">
      <div class="surface-inset p-4">
        <Search class="h-5 w-5 text-ink-400" /><h2 class="mt-3 text-sm font-semibold">
          {{ $t('dictionary.featureLookup') }}
        </h2>
      </div>
      <div class="surface-inset p-4">
        <AudioLines class="h-5 w-5 text-ink-400" /><h2 class="mt-3 text-sm font-semibold">
          {{ $t('dictionary.featurePronunciation') }}
        </h2>
      </div>
      <div class="surface-inset p-4">
        <BookOpen class="h-5 w-5 text-ink-400" /><h2 class="mt-3 text-sm font-semibold">
          {{ $t('dictionary.featureSave') }}
        </h2>
      </div>
    </div>

    <div v-for="entry in entries" :key="`${entry.word}-${entry.phonetic}`" class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Card class="p-6 sm:p-8">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="text-3xl font-black tracking-tight">
                {{ entry.word }}
              </h2>
              <Badge v-if="entry.phonetic" variant="secondary" class="rounded-lg">
                {{ entry.phonetic }}
              </Badge>
              <Badge v-if="selectedWord" variant="default" class="rounded-lg">
                已儲存
              </Badge>
            </div>
            <p v-if="entry.origin" class="mt-3 text-xs font-semibold leading-relaxed text-ink-500">
              {{ entry.origin }}
            </p>
          </div>
          <Button v-if="dictionaryAudio(entry)" variant="outline" size="icon" class="rounded-xl" :aria-label="$t('dictionary.playAudio')" @click="playAudio(entry)">
            <Volume2 class="h-5 w-5" />
          </Button>
        </div>
        <div class="mt-8 space-y-6">
          <article v-for="(definition, index) in dictionaryDefinitions(entry)" :key="`${definition.definition}-${index}`" class="border-t border-ink-200/60 pt-5 dark:border-ink-800">
            <div class="flex items-start gap-3">
              <span class="mt-0.5 text-xs font-black text-ink-400">{{ index + 1 }}</span>
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <Badge v-if="definition.partOfSpeech" variant="secondary" class="rounded-md text-[10px]">
                    {{ definition.partOfSpeech }}
                  </Badge>
                  <p class="font-bold leading-relaxed">
                    {{ definition.definition }}
                  </p>
                </div>
                <p v-if="definition.example" class="mt-3 text-left text-sm font-semibold italic leading-relaxed text-ink-500">
                  “{{ definition.example }}”
                </p>
                <div v-if="definition.synonyms?.length || definition.antonyms?.length" class="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-ink-500">
                  <span v-if="definition.synonyms?.length">{{ $t('dictionary.synonyms') }}：{{ definition.synonyms.join('、') }}</span>
                  <span v-if="definition.antonyms?.length">{{ $t('dictionary.antonyms') }}：{{ definition.antonyms.join('、') }}</span>
                </div>
              </div>
            </div>
          </article>
        </div>
        <div class="mt-8 flex items-center justify-between border-t border-ink-200/60 pt-4 text-xs font-semibold text-ink-400 dark:border-ink-800">
          <span>{{ $t('dictionary.source') }}：Free Dictionary API</span>
          <a href="https://dictionaryapi.dev/" target="_blank" rel="noreferrer" class="inline-flex items-center gap-1 hover:text-ink-900 dark:hover:text-white">dictionaryapi.dev <ExternalLink class="h-3 w-3" /></a>
        </div>
      </Card>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { DictionaryEntry, WordEntry } from '@/types'
import { ExternalLink, LoaderCircle, Search, Volume2 } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { dictionaryAudio, dictionaryDefinitions, DictionaryLookupError, lookupDictionary } from '@/lib/dictionary'
import { normalizeWordKey } from '@/lib/library'
import { useLibraryStore } from '@/stores/library'
import DictionaryAddDialog from './dialogs/DictionaryAddDialog.vue'
import Badge from './ui/badge/Badge.vue'
import Button from './ui/button/Button.vue'
import Card from './ui/card/Card.vue'
import Input from './ui/input/Input.vue'

const libraryStore = useLibraryStore()
const { t } = useI18n()
const { words } = storeToRefs(libraryStore)

const query = ref('')
const loading = ref(false)
const error = ref('')
const entries = ref<DictionaryEntry[]>([])
const selectedWordKey = ref('')
const addDialogOpen = ref(false)
const addEntry = ref<DictionaryEntry | null>(null)

const localMatches = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q)
    return []
  return words.value
    .filter(word => word.word.toLowerCase().includes(q) || word.senses.some(sense => [sense.meaningZh, ...sense.examples].some(value => value.toLowerCase().includes(q))))
    .slice(0, 8)
})

const selectedWord = computed<WordEntry | null>(() => words.value.find(word => word.wordKey === selectedWordKey.value) ?? null)

function senseSetNames(senseId: string): string[] {
  return selectedWord.value ? libraryStore.getSenseSetNames(selectedWord.value.wordKey, senseId) : []
}

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
    error.value = err instanceof DictionaryLookupError
      ? t(`dictionary.${err.code}`)
      : t('dictionary.lookupFailed')
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

function openAddDialog(entry: DictionaryEntry) {
  addEntry.value = entry
  addDialogOpen.value = true
}
</script>

<template>
  <section class="space-y-6 text-left">
    <div>
      <h1 class="text-3xl font-black tracking-tight">
        {{ $t('dictionary.title') }}
      </h1>
      <p class="mt-2 text-sm font-semibold leading-relaxed text-ink-500 dark:text-ink-400">
        {{ $t('dictionary.featureLookup') }} · {{ $t('dictionary.featurePronunciation') }} · {{ $t('dictionary.featureSave') }}
      </p>
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
          {{ $t('dictionary.localMatchSummary', { word: word.word, count: word.senses.length }) }}
        </button>
      </div>
    </Card>

    <div v-if="error" class="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
      {{ error }}
    </div>

    <Card v-if="selectedWord" class="border border-accent-primary/15 p-5 sm:p-6">
      <div>
        <p class="text-xs font-semibold uppercase tracking-wider text-accent-primary">
          {{ $t('dictionary.savedTitle') }}
        </p>
        <h2 class="mt-1 text-2xl font-bold tracking-tight">
          {{ selectedWord.word }}
        </h2>
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
          <div v-if="senseSetNames(sense.id).length" class="mt-3 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-ink-500">
            <span>{{ $t('dictionary.senseSets') }}</span>
            <Badge v-for="name in senseSetNames(sense.id)" :key="name" variant="secondary" class="rounded-md text-[10px]">
              {{ name }}
            </Badge>
          </div>
          <ul v-if="sense.examples.length" class="mt-3 space-y-1 text-sm font-medium italic leading-relaxed text-ink-500">
            <li v-for="example in sense.examples" :key="example">
              “{{ example }}”
            </li>
          </ul>
        </article>
      </div>
    </Card>

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
                {{ $t('dictionary.savedBadge') }}
              </Badge>
            </div>
            <p v-if="entry.origin" class="mt-3 text-xs font-semibold leading-relaxed text-ink-500">
              {{ entry.origin }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <Button variant="default" class="gap-2" @click="openAddDialog(entry)">
              {{ $t('dictionary.addToSet') }}
            </Button>
            <Button v-if="dictionaryAudio(entry)" variant="outline" size="icon" class="rounded-xl" :aria-label="$t('dictionary.playAudio')" @click="playAudio(entry)">
              <Volume2 class="h-5 w-5" />
            </Button>
          </div>
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

    <DictionaryAddDialog
      v-if="addEntry"
      :open="addDialogOpen"
      :word="addEntry.word"
      :entries="entries"
      :existing-word="selectedWord"
      @close="addDialogOpen = false"
    />
  </section>
</template>

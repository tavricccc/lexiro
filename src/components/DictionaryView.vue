<script setup lang="ts">
import type { DictionaryEntry } from '@/types'
import { AudioLines, BookOpen, ExternalLink, LoaderCircle, Plus, Search, Volume2 } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { dictionaryAudio, dictionaryDefinitions, lookupDictionary } from '@/lib/dictionary'
import { useSetsStore } from '@/stores/sets'
import Badge from './ui/badge/Badge.vue'
import Button from './ui/button/Button.vue'
import Card from './ui/card/Card.vue'
import Input from './ui/input/Input.vue'
import Textarea from './ui/textarea/Textarea.vue'

const setsStore = useSetsStore()
const { sets } = storeToRefs(setsStore)
const { addItemToSet } = setsStore

const query = ref('')
const loading = ref(false)
const error = ref('')
const entries = ref<DictionaryEntry[]>([])
const selectedEntry = ref<DictionaryEntry | null>(null)
const selectedSetId = ref('')
const meaning = ref('')
const example = ref('')
const saved = ref(false)

const localMatches = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q)
    return []
  return sets.value.flatMap(set => set.items.filter(item => [item.word, item.meaning, item.definition ?? ''].some(value => value.toLowerCase().includes(q))).map(item => ({ ...item, setName: set.setName })))
})

async function search() {
  const word = query.value.trim()
  if (!word)
    return
  loading.value = true
  error.value = ''
  saved.value = false
  try {
    entries.value = await lookupDictionary(word)
    selectedEntry.value = entries.value[0] ?? null
  }
  catch (err) {
    entries.value = []
    selectedEntry.value = null
    error.value = (err as Error).message
  }
  finally {
    loading.value = false
  }
}

function chooseDefinition(definition: ReturnType<typeof dictionaryDefinitions>[number]) {
  example.value = definition.example ?? ''
}

function playAudio(entry: DictionaryEntry) {
  const url = dictionaryAudio(entry)
  if (url)
    new Audio(url).play().catch(() => undefined)
}

function addToLibrary() {
  if (!selectedEntry.value || !selectedSetId.value || !meaning.value.trim())
    return
  const firstMeaning = selectedEntry.value.meanings[0]
  const definitions = dictionaryDefinitions(selectedEntry.value)
  const definition = definitions[0]
  const audioUrl = dictionaryAudio(selectedEntry.value) ?? undefined
  const success = addItemToSet(selectedSetId.value, {
    word: selectedEntry.value.word,
    pos: firstMeaning?.partOfSpeech ?? '',
    meaning: meaning.value,
    example: example.value,
    definition: definition?.definition,
    phonetic: selectedEntry.value.phonetic ?? selectedEntry.value.phonetics?.find(item => item.text)?.text,
    audioUrl,
    origin: selectedEntry.value.origin,
    dictionarySource: 'Free Dictionary API',
    synonyms: definition?.synonyms ?? [],
    antonyms: definition?.antonyms ?? [],
  })
  if (success) {
    saved.value = true
    meaning.value = ''
  }
}
</script>

<template>
  <section class="space-y-6 text-left">
    <div>
      <p class="text-xs font-black uppercase tracking-[0.18em] text-ink-400">
        {{ $t('dictionary.eyebrow') }}
      </p><h1 class="mt-2 text-3xl font-black tracking-tight">
        {{ $t('dictionary.title') }}
      </h1><p class="mt-2 max-w-2xl text-sm font-semibold leading-relaxed text-ink-500">
        {{ $t('dictionary.description') }}
      </p>
    </div>

    <Card class="p-4 sm:p-5">
      <form class="flex gap-2" @submit.prevent="search">
        <Input v-model="query" autofocus :placeholder="$t('dictionary.searchPlaceholder')" class="h-12 rounded-2xl text-base" /><Button type="submit" variant="default" size="icon" class="h-12 w-12 shrink-0 rounded-2xl" :aria-label="$t('dictionary.search')">
          <LoaderCircle v-if="loading" class="h-5 w-5 animate-spin" /><Search v-else class="h-5 w-5" />
        </Button>
      </form>
      <div v-if="localMatches.length" class="mt-4 flex flex-wrap gap-2">
        <button v-for="item in localMatches.slice(0, 6)" :key="item.id" type="button" class="rounded-full bg-ink-100 px-3 py-1.5 text-xs font-bold text-ink-600 hover:bg-ink-200 dark:bg-ink-900 dark:text-ink-300" @click="query = item.word; search()">
          {{ item.word }} · {{ item.setName }}
        </button>
      </div>
    </Card>

    <div v-if="error" class="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
      {{ error }}
    </div>
    <div v-if="!entries.length && !loading && !error" class="grid gap-4 lg:grid-cols-3">
      <Card class="p-6">
        <Search class="h-5 w-5 text-ink-400" /><h2 class="mt-6 text-lg font-black">
          {{ $t('dictionary.featureLookup') }}
        </h2><p class="mt-2 text-sm font-semibold leading-relaxed text-ink-500">
          {{ $t('dictionary.featureLookupDescription') }}
        </p>
      </Card><Card class="p-6">
        <AudioLines class="h-5 w-5 text-ink-400" /><h2 class="mt-6 text-lg font-black">
          {{ $t('dictionary.featurePronunciation') }}
        </h2><p class="mt-2 text-sm font-semibold leading-relaxed text-ink-500">
          {{ $t('dictionary.featurePronunciationDescription') }}
        </p>
      </Card><Card class="p-6">
        <BookOpen class="h-5 w-5 text-ink-400" /><h2 class="mt-6 text-lg font-black">
          {{ $t('dictionary.featureSave') }}
        </h2><p class="mt-2 text-sm font-semibold leading-relaxed text-ink-500">
          {{ $t('dictionary.featureSaveDescription') }}
        </p>
      </Card>
    </div>

    <div v-for="entry in entries" :key="`${entry.word}-${entry.phonetic}`" class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Card class="p-6 sm:p-8">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="text-3xl font-black tracking-tight">
                {{ entry.word }}
              </h2><Badge v-if="entry.phonetic" variant="secondary" class="rounded-lg">
                {{ entry.phonetic }}
              </Badge>
            </div><p v-if="entry.origin" class="mt-3 text-xs font-semibold leading-relaxed text-ink-500">
              {{ entry.origin }}
            </p>
          </div><Button v-if="dictionaryAudio(entry)" variant="outline" size="icon" class="rounded-xl" :aria-label="$t('dictionary.playAudio')" @click="playAudio(entry)">
            <Volume2 class="h-5 w-5" />
          </Button>
        </div>
        <div class="mt-8 space-y-6">
          <article v-for="(definition, index) in dictionaryDefinitions(entry)" :key="`${definition.definition}-${index}`" class="border-t border-ink-200/60 pt-5 dark:border-ink-800">
            <div class="flex items-start gap-3">
              <span class="mt-0.5 text-xs font-black text-ink-400">{{ index + 1 }}</span><div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <Badge v-if="definition.partOfSpeech" variant="secondary" class="rounded-md text-[10px]">
                    {{ definition.partOfSpeech }}
                  </Badge><p class="font-bold leading-relaxed">
                    {{ definition.definition }}
                  </p>
                </div><button v-if="definition.example" type="button" class="mt-3 text-left text-sm font-semibold italic leading-relaxed text-ink-500 hover:text-ink-900 dark:hover:text-white" @click="chooseDefinition(definition)">
                  “{{ definition.example }}”
                </button><div v-if="definition.synonyms?.length || definition.antonyms?.length" class="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-ink-500">
                  <span v-if="definition.synonyms?.length">{{ $t('dictionary.synonyms') }}：{{ definition.synonyms.join('、') }}</span><span v-if="definition.antonyms?.length">{{ $t('dictionary.antonyms') }}：{{ definition.antonyms.join('、') }}</span>
                </div>
              </div>
            </div>
          </article>
        </div>
        <div class="mt-8 flex items-center justify-between border-t border-ink-200/60 pt-4 text-xs font-semibold text-ink-400 dark:border-ink-800">
          <span>{{ $t('dictionary.source') }}：Free Dictionary API</span><a href="https://dictionaryapi.dev/" target="_blank" rel="noreferrer" class="inline-flex items-center gap-1 hover:text-ink-900 dark:hover:text-white">dictionaryapi.dev <ExternalLink class="h-3 w-3" /></a>
        </div>
      </Card>

      <Card class="h-fit p-6 sm:p-7">
        <div class="flex items-center gap-2">
          <Plus class="h-4 w-4" /><h2 class="font-black">
            {{ $t('dictionary.addTitle') }}
          </h2>
        </div><p class="mt-2 text-xs font-semibold leading-relaxed text-ink-500">
          {{ $t('dictionary.addDescription') }}
        </p><div v-if="sets.length" class="mt-6 space-y-4">
          <label class="block text-xs font-black text-ink-500">{{ $t('dictionary.chooseSet') }}<select v-model="selectedSetId" class="mt-2 h-11 w-full rounded-xl border border-ink-200 bg-white px-3 text-sm font-bold dark:border-ink-700 dark:bg-ink-900"><option value="">{{ $t('dictionary.chooseSetPlaceholder') }}</option><option v-for="set in sets" :key="set.id" :value="set.id">{{ set.setName }}</option></select></label><label class="block text-xs font-black text-ink-500">{{ $t('dictionary.myMeaning') }}<Input v-model="meaning" class="mt-2" :placeholder="$t('dictionary.myMeaningPlaceholder')" /></label><label class="block text-xs font-black text-ink-500">{{ $t('dictionary.myExample') }}<Textarea v-model="example" :rows="3" class="mt-2" :placeholder="$t('dictionary.myExamplePlaceholder')" /></label><Button class="w-full gap-2" :disabled="!selectedSetId || !meaning.trim()" @click="addToLibrary">
            <Plus class="h-4 w-4" />{{ $t('dictionary.addButton') }}
          </Button><p v-if="saved" class="text-center text-xs font-bold text-emerald-600">
            {{ $t('dictionary.added') }}
          </p>
        </div><RouterLink v-else to="/library" class="mt-6 block rounded-2xl bg-ink-100 p-4 text-sm font-bold text-ink-600 dark:bg-ink-900 dark:text-ink-300">
          {{ $t('dictionary.noSetHint') }}
        </RouterLink>
      </Card>
    </div>
  </section>
</template>

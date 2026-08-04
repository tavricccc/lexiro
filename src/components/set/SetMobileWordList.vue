<script setup lang="ts">
import type { WordEntry, WordSense } from '@/types'
import { Pencil, Search, Trash2, Volume2 } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { syncAfterLocalCommit } from '@/lib/commit-sync'
import { useLibraryStore } from '@/stores/library'
import { useUIStore } from '@/stores/ui'
import Button from '../ui/button/Button.vue'
import Input from '../ui/input/Input.vue'
import SenseCard from '../word/SenseCard.vue'

const props = defineProps<{
  setId: string
  words: WordEntry[]
  search: string
}>()

const emit = defineEmits<{
  'update:search': [value: string]
}>()

const router = useRouter()
const { t } = useI18n()
const libraryStore = useLibraryStore()
const uiStore = useUIStore()
const deletingKey = ref<string | null>(null)
const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window

const filteredWords = computed(() => {
  const query = props.search.trim().toLocaleLowerCase()
  if (!query)
    return props.words
  return props.words.filter((word) => {
    const searchable = [word.word, ...word.senses.flatMap(sense => [sense.pos, sense.meaningZh, ...sense.examples])]
    return searchable.some(value => value.toLocaleLowerCase().includes(query))
  })
})

function wordSenses(word: WordEntry): WordSense[] {
  const allowed = new Set(libraryStore.getMembership(props.setId, word.wordKey)?.senseIds ?? [])
  return word.senses.filter(sense => allowed.has(sense.id))
}

function speak(wordText: string) {
  if (!canSpeak)
    return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(wordText)
  utterance.lang = 'en-US'
  utterance.rate = 0.85
  window.speechSynthesis.speak(utterance)
}

function openVocabulary(wordKey: string) {
  void router.push({ name: 'vocabulary', params: { wordKey }, query: { setId: props.setId } })
}

async function removeWord(word: WordEntry) {
  if (deletingKey.value)
    return
  const set = libraryStore.getSet(props.setId)
  if (!set)
    return

  const otherSetNames = libraryStore.getWordSetIds(word.wordKey)
    .filter(id => id !== props.setId)
    .map(id => libraryStore.getSet(id)?.setName)
    .filter((name): name is string => Boolean(name))

  const confirmed = await uiStore.showConfirm(
    t('vocabulary.deleteWordTitle'),
    t('vocabulary.deleteWordMessage', {
      word: word.word,
      set: set.setName,
      otherSets: otherSetNames.length ? otherSetNames.join('、') : t('vocabulary.noOtherSets'),
    }),
    { confirmLabel: t('vocabulary.confirmDeleteWord'), destructive: true },
  )
  if (!confirmed)
    return

  deletingKey.value = word.wordKey
  try {
    await libraryStore.loadAllContent()
    if (!libraryStore.removeWordFromSet(props.setId, word.wordKey))
      return
    await syncAfterLocalCommit()
  }
  catch {
    uiStore.showToast(t('vocabulary.deleteWordFailed'))
  }
  finally {
    deletingKey.value = null
  }
}
</script>

<template>
  <div class="space-y-4">
    <label class="relative block">
      <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
      <Input :model-value="search" :placeholder="$t('set.searchWords')" class="pl-9" :aria-label="$t('set.searchWords')" @update:model-value="emit('update:search', $event)" />
    </label>

    <div v-if="filteredWords.length" class="space-y-4">
      <article
        v-for="word in filteredWords"
        :key="word.wordKey"
        class="rounded-2xl border border-ink-200/60 p-4 text-left dark:border-ink-800"
      >
        <div class="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div class="flex flex-wrap items-center gap-2">
            <h3 class="break-words text-2xl font-black tracking-tight text-ink-950 dark:text-ink-50">
              {{ word.word }}
            </h3>
            <Button v-if="canSpeak" variant="outline" size="icon" class="h-9 w-9" :aria-label="$t('dictionary.playAudio')" @click="speak(word.word)">
              <Volume2 class="h-4 w-4" />
            </Button>
          </div>
          <div class="flex shrink-0 gap-1">
            <Button variant="outline" size="icon" class="h-9 w-9" :aria-label="$t('vocabulary.editWord')" :disabled="deletingKey === word.wordKey" @click="openVocabulary(word.wordKey)">
              <Pencil class="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" class="h-9 w-9 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20" :aria-label="$t('vocabulary.deleteWord')" :loading="deletingKey === word.wordKey" @click="removeWord(word)">
              <Trash2 class="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div class="space-y-3">
          <SenseCard
            v-for="sense in wordSenses(word)"
            :key="sense.id"
            :sense="sense"
            :editable="false"
          />
        </div>
      </article>
    </div>

    <p v-else class="rounded-2xl border border-dashed border-ink-200/70 px-4 py-8 text-center text-sm font-semibold text-ink-400 dark:border-ink-200/20">
      {{ $t('set.noMatchingWords') }}
    </p>
  </div>
</template>

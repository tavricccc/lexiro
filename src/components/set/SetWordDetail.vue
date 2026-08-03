<script setup lang="ts">
import { ArrowLeft, Pencil, Trash2, Volume2 } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'
import { syncAfterLocalCommit } from '@/lib/commit-sync'
import { useLibraryStore } from '@/stores/library'
import { useUIStore } from '@/stores/ui'
import Button from '../ui/button/Button.vue'
import Card from '../ui/card/Card.vue'
import SenseCard from '../word/SenseCard.vue'

const props = defineProps<{
  setId: string
  wordKey: string
}>()

const router = useRouter()
const { t } = useI18n()
const libraryStore = useLibraryStore()
const uiStore = useUIStore()
const deleting = ref(false)
const set = computed(() => libraryStore.getSet(props.setId))
const word = computed(() => libraryStore.getWord(props.wordKey))
const membership = computed(() => libraryStore.getMembership(props.setId, props.wordKey))
const senses = computed(() => {
  const allowed = new Set(membership.value?.senseIds ?? [])
  return word.value?.senses.filter(sense => allowed.has(sense.id)) ?? []
})
const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window

function speak() {
  if (!word.value || !('speechSynthesis' in window))
    return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(word.value.word)
  utterance.lang = 'en-US'
  utterance.rate = 0.85
  window.speechSynthesis.speak(utterance)
}

function openVocabulary() {
  if (!word.value)
    return
  void router.push({ name: 'vocabulary', params: { wordKey: word.value.wordKey }, query: { setId: props.setId } })
}

async function removeWord() {
  if (!word.value || !set.value || deleting.value)
    return
  const otherSetNames = libraryStore.getWordSetIds(word.value.wordKey)
    .filter(setId => setId !== props.setId)
    .map(setId => libraryStore.getSet(setId)?.setName)
    .filter((name): name is string => Boolean(name))
  const confirmed = await uiStore.showConfirm(
    t('vocabulary.deleteWordTitle'),
    t('vocabulary.deleteWordMessage', {
      word: word.value.word,
      set: set.value.setName,
      otherSets: otherSetNames.length ? otherSetNames.join('、') : t('vocabulary.noOtherSets'),
    }),
    { confirmLabel: t('vocabulary.confirmDeleteWord'), destructive: true },
  )
  if (!confirmed)
    return

  deleting.value = true
  try {
    await libraryStore.loadAllContent()
    if (!libraryStore.removeWordFromSet(props.setId, props.wordKey))
      return
    await syncAfterLocalCommit()
    await router.push(libraryStore.getSet(props.setId)
      ? { name: 'set-words', params: { setId: props.setId } }
      : { name: 'library' })
  }
  catch {
    uiStore.showToast(t('vocabulary.deleteWordFailed'))
  }
  finally {
    deleting.value = false
  }
}
</script>

<template>
  <section v-if="set && word && senses.length" class="space-y-5 text-left">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0">
        <Button variant="ghost" class="mb-3 -ml-3 gap-2 lg:hidden" @click="router.push({ name: 'set-words', params: { setId } })">
          <ArrowLeft class="h-4 w-4" />{{ $t('set.backToWords') }}
        </Button>
        <div class="flex flex-wrap items-center gap-3">
          <h2 class="break-words text-3xl font-black tracking-tight text-ink-950 dark:text-ink-50 sm:text-4xl">
            {{ word.word }}
          </h2>
          <Button v-if="canSpeak" variant="outline" size="icon" :aria-label="$t('dictionary.playAudio')" @click="speak">
            <Volume2 class="h-4 w-4" />
          </Button>
        </div>
        <p class="mt-2 text-sm font-semibold text-ink-500">
          {{ $t('set.senseCount', { count: senses.length }) }}
        </p>
      </div>
      <div class="flex shrink-0 gap-1">
        <Button variant="outline" size="icon" :aria-label="$t('vocabulary.editWord')" :disabled="deleting" @click="openVocabulary">
          <Pencil class="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" class="text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20" :aria-label="$t('vocabulary.deleteWord')" :disabled="deleting" @click="removeWord">
          <Trash2 class="h-4 w-4" />
        </Button>
      </div>
    </div>

    <div class="space-y-4">
      <SenseCard
        v-for="sense in senses"
        :key="sense.id"
        :sense="sense"
        :editable="false"
      />
    </div>
  </section>

  <Card v-else class="space-y-3 p-6 text-center">
    <h2 class="text-lg font-black">
      {{ $t('set.invalidWordTitle') }}
    </h2>
    <p class="text-sm font-semibold text-ink-500">
      {{ $t('set.invalidWordDescription') }}
    </p>
    <RouterLink :to="{ name: 'set-words', params: { setId } }" class="inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-bold text-accent-primary hover:bg-ink-100 dark:hover:bg-ink-800">
      {{ $t('set.backToWords') }}
    </RouterLink>
  </Card>
</template>

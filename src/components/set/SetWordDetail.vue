<script setup lang="ts">
import { ArrowLeft, Volume2 } from 'lucide-vue-next'
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useSenseManagement } from '@/lib/use-sense-management'
import { useLibraryStore } from '@/stores/library'
import SenseDeleteImpactDialog from '../dialogs/SenseDeleteImpactDialog.vue'
import SenseEditorDialog from '../dialogs/SenseEditorDialog.vue'
import Button from '../ui/button/Button.vue'
import Card from '../ui/card/Card.vue'
import SenseCard from '../word/SenseCard.vue'

const props = defineProps<{
  setId: string
  wordKey: string
}>()

const router = useRouter()
const libraryStore = useLibraryStore()
const set = computed(() => libraryStore.getSet(props.setId))
const word = computed(() => libraryStore.getWord(props.wordKey))
const membership = computed(() => libraryStore.getMembership(props.setId, props.wordKey))
const senses = computed(() => {
  const allowed = new Set(membership.value?.senseIds ?? [])
  return word.value?.senses.filter(sense => allowed.has(sense.id)) ?? []
})
const senseManager = useSenseManagement({
  getWordKey: () => props.wordKey,
  getSetId: () => props.setId,
  onRemoved: async () => {
    if (!libraryStore.getMembership(props.setId, props.wordKey))
      await router.push({ name: 'set-words', params: { setId: props.setId } })
  },
})
const senseEditorOpen = senseManager.editorOpen
const senseToEdit = senseManager.editingSense
const senseEditorError = senseManager.editorError
const senseDeleteImpactOpen = senseManager.deleteImpactOpen
const senseOtherSetNames = senseManager.otherSetNames
const senseImpact = senseManager.impact
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
      <Button variant="outline" class="min-h-11 gap-2" @click="openVocabulary">
        {{ $t('vocabulary.openEditor') }}
      </Button>
    </div>

    <div class="space-y-4">
      <SenseCard
        v-for="sense in senses"
        :key="sense.id"
        :sense="sense"
        :editable="true"
        @edit="senseManager.openEditor"
        @delete="senseManager.requestRemove"
        @edit-example="(sense) => senseManager.openEditor(sense)"
        @add-example="senseManager.openEditor"
        @delete-example="(sense) => senseManager.openEditor(sense)"
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

  <SenseEditorDialog
    :open="senseEditorOpen"
    :sense="senseToEdit"
    :error="senseEditorError"
    :save-handler="senseManager.saveEditor"
    @close="senseManager.closeEditor"
  />
  <SenseDeleteImpactDialog
    :open="senseDeleteImpactOpen"
    :set-name="set?.setName ?? ''"
    :other-set-names="senseOtherSetNames"
    :impact="senseImpact"
    @cancel="senseManager.cancelRemove"
    @confirm="senseManager.confirmRemove"
  />
</template>

<script setup lang="ts">
import { ArrowLeft, ArrowRight, Check, RotateCcw } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { useSetsStore } from '@/stores/sets'
import FlashcardView from './FlashcardView.vue'
import SessionUnavailable from './SessionUnavailable.vue'
import Button from './ui/button/Button.vue'
import Progress from './ui/progress/Progress.vue'

const setsStore = useSetsStore()
const sessionStore = useSessionStore()
const route = useRoute()
const router = useRouter()
const { activeSet } = storeToRefs(setsStore)
const {
  currentSession,
  flashcardIndex,
  flashcardEntry,
  totalItems,
  progressPercent,
} = storeToRefs(sessionStore)
const { advanceFlashcard, prevFlashcard, completeFlashcards, saveState, startFlashcards } = sessionStore

const flipped = ref(false)

const isFlashcardSession = computed(() =>
  currentSession.value?.mode === 'flashcard' && (currentSession.value.entries?.length ?? 0) > 0,
)

const isLast = computed(() => totalItems.value > 0 && flashcardIndex.value >= totalItems.value - 1)
const isFirst = computed(() => flashcardIndex.value <= 0)

const currentItem = computed(() => flashcardEntry.value?.item ?? null)

watch(flashcardIndex, () => {
  flipped.value = false
})

function next() {
  flipped.value = false
  if (isLast.value) {
    completeFlashcards()
    return
  }
  advanceFlashcard()
}

function prev() {
  flipped.value = false
  prevFlashcard()
}

function toggleFlip() {
  flipped.value = !flipped.value
}

function onKeydown(e: KeyboardEvent) {
  if (e.target instanceof HTMLElement) {
    const tag = e.target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable)
      return
  }
  if (e.key === 'ArrowRight') {
    e.preventDefault()
    next()
  }
  else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    prev()
  }
  else if (e.key === 'Enter') {
    e.preventDefault()
    next()
  }
  else if (e.key === ' ' || e.key === 'Spacebar') {
    e.preventDefault()
    toggleFlip()
  }
}

onMounted(async () => {
  if (!isFlashcardSession.value) {
    const setId = typeof route.params.setId === 'string' ? route.params.setId : null
    if (setId && setsStore.sets.some(s => s.id === setId)) {
      await startFlashcards(setId)
    }
    else {
      router.replace({ name: 'home' })
      return
    }
  }

  if (!isFlashcardSession.value) {
    router.replace({ name: 'home' })
    return
  }

  window.addEventListener('keydown', onKeydown)
  saveState(true)
})

onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <section v-if="activeSet && isFlashcardSession && currentItem" class="mx-auto max-w-2xl space-y-6">
    <div class="flex items-center justify-between gap-3">
      <p class="text-sm font-bold tabular-nums text-ink-950 dark:text-ink-50">
        {{ flashcardIndex + 1 }}<span class="text-ink-400">/{{ totalItems }}</span>
      </p>
      <Progress :model-value="progressPercent" class="h-1.5 flex-1 max-w-xs" />
    </div>

    <FlashcardView
      :key="`${currentItem.id}-${flashcardIndex}`"
      v-model:flipped="flipped"
      :item="currentItem"
      :index="flashcardIndex"
    />

    <div class="flex flex-wrap items-center justify-center gap-3">
      <Button variant="outline" class="gap-2 min-w-[7rem]" :disabled="isFirst" @click="prev">
        <ArrowLeft class="h-4 w-4" />
        <span>{{ $t('flashcard.prev') }}</span>
      </Button>
      <Button variant="secondary" class="gap-2 min-w-[7rem]" @click.stop="toggleFlip">
        <RotateCcw class="h-4 w-4" />
        <span>{{ $t('flashcard.flip') }}</span>
      </Button>
      <Button variant="default" class="gap-2 min-w-[7rem]" @click="next">
        <span>{{ isLast ? $t('flashcard.finish') : $t('flashcard.next') }}</span>
        <Check v-if="isLast" class="h-4 w-4" />
        <ArrowRight v-else class="h-4 w-4" />
      </Button>
    </div>

    <p class="text-center text-[11px] font-semibold text-ink-400 dark:text-ink-500">
      {{ $t('flashcard.keyboardHint') }}
    </p>
  </section>
  <SessionUnavailable v-else />
</template>

<script setup lang="ts">
import { CheckCircle2 } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useSetsStore } from '@/stores/sets'
import QuizCard from './QuizCard.vue'
import SessionUnavailable from './SessionUnavailable.vue'
import SpellingCard from './SpellingCard.vue'

const setsStore = useSetsStore()
const sessionStore = useSessionStore()
const { activeSet } = storeToRefs(setsStore)
const { currentView, currentSession, currentIndex, currentEntry, totalItems } = storeToRefs(sessionStore)
const { handleQuizDraftChange, toggleReviewMark, handleSpellingDraftChange, advanceToNext } = sessionStore
const canRenderPractice = computed(() => Boolean(currentSession.value && currentEntry.value && (activeSet.value || currentSession.value.sourceSetId === 'daily')))

const currentDraft = computed(() => {
  return currentSession.value?.drafts[currentIndex.value] ?? null
})

const quizDraft = computed<{ selectedIndex: number | null } | null>(() => {
  const d = currentDraft.value
  if (d && 'selectedIndex' in d)
    return { selectedIndex: d.selectedIndex }
  return null
})
const spellingDraft = computed<{ answer: string } | null>(() => {
  const d = currentDraft.value
  if (d && 'answer' in d)
    return { answer: d.answer }
  return null
})
</script>

<template>
  <section v-if="canRenderPractice" class="min-h-[65vh]">
    <p class="mb-3 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-ink-400" role="status">
      <CheckCircle2 class="h-3.5 w-3.5 text-emerald-500" />
      {{ $t('practice.autoSaved') }}
    </p>
    <Transition name="practice-card" mode="out-in">
      <div :key="`${currentView}-${currentIndex}`">
        <QuizCard
          v-if="currentEntry && ['quiz', 'cloze', 'reading'].includes(currentView)"
          :entry="currentEntry"
          :index="currentIndex"
          :total="totalItems"
          :review="currentSession?.review"
          :draft="quizDraft"
          :marked-for-review="currentSession?.markedForReview[currentIndex] ?? false"
          @draft-change="(payload) => handleQuizDraftChange(currentIndex, payload)"
          @toggle-review-mark="toggleReviewMark(currentIndex)"
          @next="advanceToNext"
        />

        <SpellingCard
          v-else-if="currentEntry"
          :entry="currentEntry"
          :index="currentIndex"
          :total="totalItems"
          :review="currentSession?.review"
          :draft="spellingDraft"
          @draft-change="(payload) => handleSpellingDraftChange(currentIndex, payload)"
          @next="advanceToNext"
        />
      </div>
    </Transition>
  </section>
  <SessionUnavailable v-else />
</template>

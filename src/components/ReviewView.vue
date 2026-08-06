<script setup lang="ts">
import type { ReviewRating } from '@/types'
import { Check, ChevronRight, Volume2 } from 'lucide-vue-next'
import { motion } from 'motion-v'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { syncAfterLocalCommit } from '@/lib/commit-sync'
import { useLearningStore } from '@/stores/learning'
import { useLibraryStore } from '@/stores/library'
import { useSessionStore } from '@/stores/session'
import { useSetsStore } from '@/stores/sets'
import { useUIStore } from '@/stores/ui'
import SessionUnavailable from './SessionUnavailable.vue'
import Button from './ui/button/Button.vue'
import Card from './ui/card/Card.vue'

const route = useRoute()
const router = useRouter()
const learningStore = useLearningStore()
const libraryStore = useLibraryStore()
const sessionStore = useSessionStore()
const setsStore = useSetsStore()
const uiStore = useUIStore()
const { t } = useI18n()
const { currentReviewEntry, reviewSetId, reviewIndex, reviewTotal, reviewAnswered, reviewContext } = storeToRefs(learningStore)
const { answerCurrent, nextReview, startReview, startDailyReviewFromRepository, clearReview } = learningStore
const { startDailyQuestionRound } = sessionStore
const routeSetId = computed(() => typeof route.params.setId === 'string' ? route.params.setId : null)
const activeSet = computed(() => {
  const currentSetId = currentReviewEntry.value?.setId ?? routeSetId.value
  return currentSetId ? setsStore.sets.find(set => set.id === currentSetId) ?? null : null
})

const ratingKeys: ReviewRating[] = ['again', 'good']

const completedMilestone = ref(false)

function speak() {
  const word = currentReviewEntry.value?.item.word
  if (!word || !('speechSynthesis' in window))
    return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(word)
  utterance.lang = 'en-US'
  utterance.rate = 0.85
  window.speechSynthesis.speak(utterance)
}

function rate(rating: ReviewRating) {
  answerCurrent(rating)
}

async function next() {
  const wasDaily = reviewContext.value === 'daily'
  if (nextReview())
    return
  if (!(await syncAfterLocalCommit()).localPersisted) {
    uiStore.showToast(t('sync.error'))
    clearReview()
    void router.push({ name: 'home' })
    return
  }
  if (wasDaily) {
    completedMilestone.value = true
    return
  }
  clearReview()
  router.push({ name: 'home' })
}

async function startQuizConsolidation() {
  clearReview()
  void startDailyQuestionRound().then((started) => {
    if (!started) {
      uiStore.showToast(t('learning.noDailyQuestions'))
      router.push({ name: 'home' })
    }
  }).catch(() => {
    uiStore.showToast(t('sync.errorPersistence'))
    void router.push({ name: 'home' })
  })
}

function goHome() {
  clearReview()
  router.push({ name: 'home' })
}

function onKeydown(event: KeyboardEvent) {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
    return
  const shortcuts: Record<string, ReviewRating> = { a: 'again', g: 'good' }
  if (!reviewAnswered.value && shortcuts[event.key.toLowerCase()]) {
    event.preventDefault()
    rate(shortcuts[event.key.toLowerCase()])
  }
  else if (reviewAnswered.value && event.key === 'Enter') {
    event.preventDefault()
    if (completedMilestone.value)
      void startQuizConsolidation()
    else
      void next()
  }
}

async function initializeReview() {
  if (routeSetId.value)
    await libraryStore.hydrateSet(routeSetId.value)
  if (!activeSet.value || reviewSetId.value !== routeSetId.value || !currentReviewEntry.value) {
    const started = routeSetId.value ? startReview(routeSetId.value) : await startDailyReviewFromRepository()
    if (!started) {
      uiStore.showToast(t('learning.noDue'))
      router.replace({ name: 'home' })
      return
    }
  }
  window.addEventListener('keydown', onKeydown)
}

onMounted(() => {
  void initializeReview().catch(() => {
    uiStore.showToast(t('sync.errorPersistence'))
    void router.replace({ name: 'home' })
  })
})

onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <section v-if="completedMilestone" class="mx-auto max-w-2xl text-center">
    <Card class="p-6 sm:p-8 space-y-4">
      <h2 class="text-2xl font-black tracking-tight text-ink-950 dark:text-ink-50">
        {{ $t('learning.reviewFinishedTitle') }}
      </h2>
      <p class="text-sm font-semibold text-ink-500 leading-relaxed">
        {{ $t('learning.reviewFinishedDesc') }}
      </p>
      <div class="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
        <Button variant="default" class="w-full sm:w-auto px-6 font-bold" @click="startQuizConsolidation">
          {{ $t('learning.startQuizConsolidation') }}
        </Button>
        <Button variant="outline" class="w-full sm:w-auto px-6 font-bold" @click="goHome">
          {{ $t('learning.returnHome') }}
        </Button>
      </div>
    </Card>
  </section>

  <section v-else-if="activeSet && currentReviewEntry" class="mx-auto max-w-2xl">
    <motion.div :key="currentReviewEntry.item.id" :initial="{ opacity: 0 }" :animate="{ opacity: 1 }" :transition="{ duration: 0.18 }">
      <Card class="p-5 text-center sm:p-6">
        <p class="text-xs font-extrabold uppercase tracking-widest text-ink-400">
          {{ $t('learning.rememberPrompt') }}
        </p>
        <div class="mt-5 flex items-center justify-center gap-3">
          <h2 class="break-words text-3xl font-extrabold tracking-tight text-accent-primary sm:text-4xl">
            {{ currentReviewEntry.item.word }}
          </h2>
          <Button variant="ghost" size="icon" :aria-label="$t('learning.speak')" @click="speak">
            <Volume2 class="h-5 w-5" />
          </Button>
        </div>
        <p class="mt-3 text-sm font-semibold text-ink-400">
          {{ currentReviewEntry.item.pos }}
        </p>

        <div v-if="reviewAnswered" class="mt-6 rounded-2xl bg-ink-100/80 p-4 text-left dark:bg-ink-900" role="status" aria-live="polite">
          <p class="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
            {{ $t('learning.answerRevealed') }}
          </p>
          <p class="mt-2 text-base font-bold text-ink-950 dark:text-ink-50">
            {{ currentReviewEntry.item.meaning }}
          </p>
          <p class="mt-3 text-sm leading-relaxed text-ink-600 dark:text-ink-400">
            {{ currentReviewEntry.item.example }}
          </p>
        </div>

        <div v-else class="mt-6 rounded-2xl border border-dashed border-ink-300 p-4 text-sm font-semibold text-ink-400 dark:border-ink-700">
          {{ $t('learning.chooseRating') }}
        </div>

        <div v-if="!reviewAnswered" class="mt-6 grid grid-cols-2 gap-3">
          <Button v-for="rating in ratingKeys" :key="rating" variant="outline" class="h-auto min-h-12 flex-col gap-1 rounded-2xl" @click="rate(rating)">
            <span class="font-extrabold">{{ $t(`learning.rating.${rating}`) }}</span>
            <span class="text-[0.6875rem] font-semibold text-ink-400">{{ $t(`learning.ratingHint.${rating}`) }}</span>
          </Button>
        </div>
        <Button v-else variant="default" class="mt-6 w-full gap-2 sm:w-auto" @click="next">
          {{ reviewIndex + 1 >= reviewTotal ? $t('learning.finishReview') : $t('learning.nextReview') }}
          <Check v-if="reviewIndex + 1 >= reviewTotal" class="h-4 w-4" />
          <ChevronRight v-else class="h-4 w-4" />
        </Button>
        <p class="mt-5 text-[0.6875rem] font-semibold text-ink-400 keyboard-hint">
          {{ $t('learning.keyboardHint') }}
        </p>
      </Card>
    </motion.div>
  </section>
  <SessionUnavailable v-else />
</template>

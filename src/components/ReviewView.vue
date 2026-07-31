<script setup lang="ts">
import type { ReviewRating } from '@/types'
import { Check, ChevronRight, Volume2 } from 'lucide-vue-next'
import { motion } from 'motion-v'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useLearningStore } from '@/stores/learning'
import { useSetsStore } from '@/stores/sets'
import { useUIStore } from '@/stores/ui'
import Button from './ui/button/Button.vue'
import Card from './ui/card/Card.vue'
import Progress from './ui/progress/Progress.vue'

const route = useRoute()
const router = useRouter()
const learningStore = useLearningStore()
const setsStore = useSetsStore()
const uiStore = useUIStore()
const { t } = useI18n()
const { currentReviewEntry, reviewIndex, reviewTotal, reviewProgress, reviewAnswered } = storeToRefs(learningStore)
const { answerCurrent, nextReview, startReview, clearReview } = learningStore
const setId = computed(() => typeof route.params.setId === 'string' ? route.params.setId : '')
const activeSet = computed(() => setsStore.sets.find(set => set.id === setId.value) ?? null)

const ratingKeys: ReviewRating[] = ['again', 'hard', 'good', 'easy']

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

function next() {
  if (nextReview())
    return
  clearReview()
  router.push({ name: 'home' })
}

function onKeydown(event: KeyboardEvent) {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
    return
  const shortcuts: Record<string, ReviewRating> = { a: 'again', h: 'hard', g: 'good', e: 'easy' }
  if (!reviewAnswered.value && shortcuts[event.key.toLowerCase()]) {
    event.preventDefault()
    rate(shortcuts[event.key.toLowerCase()])
  }
  else if (reviewAnswered.value && event.key === 'Enter') {
    event.preventDefault()
    next()
  }
}

onMounted(() => {
  if (!activeSet.value || learningStore.reviewSetId !== setId.value || !currentReviewEntry.value) {
    if (!setId.value || !startReview(setId.value)) {
      uiStore.showToast(t('learning.noDue'))
      router.replace({ name: 'home' })
      return
    }
  }
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <section v-if="activeSet && currentReviewEntry" class="mx-auto max-w-2xl space-y-5">
    <div class="flex items-center justify-between gap-3">
      <div>
        <p class="text-xs font-extrabold uppercase tracking-widest text-ink-400">
          {{ $t('learning.todayReview') }}
        </p>
        <p class="mt-1 text-sm font-bold text-ink-950 dark:text-ink-50">
          {{ activeSet.setName }}
        </p>
      </div>
      <span class="text-sm font-extrabold tabular-nums">{{ reviewIndex + 1 }}/{{ reviewTotal }}</span>
    </div>
    <Progress :model-value="reviewProgress" class="h-2" />

    <motion.div :initial="{ opacity: 0, y: 12 }" :animate="{ opacity: 1, y: 0 }" :transition="{ type: 'spring', stiffness: 260, damping: 24 }">
      <Card class="p-6 text-center sm:p-10">
        <p class="text-xs font-extrabold uppercase tracking-widest text-ink-400">
          {{ $t('learning.rememberPrompt') }}
        </p>
        <div class="mt-5 flex items-center justify-center gap-3">
          <h2 class="break-words text-4xl font-extrabold tracking-tight text-accent-primary sm:text-5xl">
            {{ currentReviewEntry.item.word }}
          </h2>
          <Button variant="ghost" size="icon" :aria-label="$t('learning.speak')" @click="speak">
            <Volume2 class="h-5 w-5" />
          </Button>
        </div>
        <p class="mt-3 text-sm font-semibold text-ink-400">
          {{ currentReviewEntry.item.pos }}
        </p>

        <div v-if="reviewAnswered" class="mt-8 rounded-2xl bg-ink-100/80 p-5 text-left dark:bg-ink-900" role="status" aria-live="polite">
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

        <div v-else class="mt-8 rounded-2xl border border-dashed border-ink-300 p-5 text-sm font-semibold text-ink-400 dark:border-ink-700">
          {{ $t('learning.chooseRating') }}
        </div>

        <div v-if="!reviewAnswered" class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Button v-for="rating in ratingKeys" :key="rating" variant="outline" class="h-auto min-h-14 flex-col gap-1 rounded-2xl" @click="rate(rating)">
            <span class="font-extrabold">{{ $t(`learning.rating.${rating}`) }}</span>
            <span class="text-[11px] font-semibold text-ink-400">{{ $t(`learning.ratingHint.${rating}`) }}</span>
          </Button>
        </div>
        <Button v-else variant="default" class="mt-6 w-full gap-2 sm:w-auto" @click="next">
          {{ reviewIndex + 1 >= reviewTotal ? $t('learning.finishReview') : $t('learning.nextReview') }}
          <Check v-if="reviewIndex + 1 >= reviewTotal" class="h-4 w-4" />
          <ChevronRight v-else class="h-4 w-4" />
        </Button>
        <p class="mt-5 text-[11px] font-semibold text-ink-400">
          {{ $t('learning.keyboardHint') }}
        </p>
      </Card>
    </motion.div>
  </section>
</template>

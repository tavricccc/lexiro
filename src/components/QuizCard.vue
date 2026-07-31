<script setup lang="ts">
import type { SessionEntry } from '@/types'
import { ArrowRight, Bookmark, BookmarkCheck } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { cn } from '@/lib/cn'
import Button from './ui/button/Button.vue'
import Card from './ui/card/Card.vue'

const props = defineProps<{
  entry: SessionEntry
  index: number
  total: number
  review?: boolean
  draft: { selectedIndex: number | null } | null
  markedForReview?: boolean
}>()

const emit = defineEmits<{
  'draft-change': [payload: { selectedIndex: number | null }]
  'toggle-review-mark': []
  'next': []
}>()

const labels = ['A', 'B', 'C', 'D']
const selectedIndex = ref<number | null>(null)
const answered = ref(false)
const feedbackClass = ref('')
const question = computed(() => props.entry.question!)

const answerText = computed(() => question.value.opts[question.value.ans])
const promptParts = computed(() => question.value.prompt.split('_____'))
const hasBlank = computed(() => question.value.prompt.includes('_____'))

watch(
  () => props.draft?.selectedIndex,
  (val) => {
    selectedIndex.value = val ?? null
    answered.value = val !== null && val !== undefined
  },
  { immediate: true },
)

watch(() => props.index, () => {
  feedbackClass.value = ''
})

function choose(index: number) {
  if (answered.value)
    return
  answered.value = true
  selectedIndex.value = index
  const correct = index === question.value.ans
  feedbackClass.value = correct ? 'feedback-correct' : 'feedback-wrong'
  emit('draft-change', { selectedIndex: index })
}

function next() {
  emit('next')
}

function skip() {
  if (answered.value)
    return
  answered.value = true
  selectedIndex.value = null
  emit('draft-change', { selectedIndex: null })
}

function optionClass(index: number) {
  const isCorrect = index === question.value.ans
  const isSelected = index === selectedIndex.value

  return cn(
    'flex w-full items-start gap-3 rounded-2xl border px-4 py-3.5 text-left text-sm font-semibold transition-all duration-200 outline-none',
    !answered.value && 'border-ink-200/80 dark:border-ink-200/30 bg-white dark:bg-ink-850 text-ink-700 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-accent-primary/20',
    !answered.value && isSelected && 'border-accent-primary bg-accent-primary/5 text-accent-primary ring-1 ring-accent-primary/25',
    answered.value && 'cursor-default',
    answered.value && isCorrect && 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold',
    answered.value && isSelected && !isCorrect && 'border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400 font-bold',
    answered.value && !isSelected && !isCorrect && 'border-ink-200/60 dark:border-ink-200/20 bg-ink-50/50 dark:bg-ink-900 text-ink-400 dark:text-ink-500 opacity-45',
  )
}

function onKeydown(e: KeyboardEvent) {
  if (e.target instanceof HTMLElement) {
    const tag = e.target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable)
      return
  }
  if (!answered.value) {
    const map: Record<string, number> = { 1: 0, 2: 1, 3: 2, 4: 3, a: 0, b: 1, c: 2, d: 3, A: 0, B: 1, C: 2, D: 3 }
    if (e.key in map) {
      e.preventDefault()
      choose(map[e.key])
      return
    }
  }
  if (e.key === 'Enter' && answered.value) {
    e.preventDefault()
    next()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Card v-if="question" :class="cn('p-5 sm:p-8', feedbackClass)">
    <div class="mb-4 flex justify-end">
      <Button
        variant="outline"
        size="sm"
        class="gap-2"
        :aria-pressed="props.markedForReview"
        :aria-label="props.markedForReview ? $t('practice.unmarkForReview') : $t('practice.markForReview')"
        @click="emit('toggle-review-mark')"
      >
        <BookmarkCheck v-if="props.markedForReview" class="h-4 w-4" />
        <Bookmark v-else class="h-4 w-4" />
        <span>{{ props.markedForReview ? $t('practice.markedForReview') : $t('practice.markForReview') }}</span>
      </Button>
    </div>
    <div class="rounded-2xl bg-ink-100/80 dark:bg-ink-900 border border-ink-200/70 dark:border-ink-200/25 p-5 text-left">
      <div v-if="entry.readingPassage" class="mb-5 rounded-xl border border-ink-200/60 bg-white/70 p-4 text-sm leading-relaxed text-ink-700 dark:border-ink-200/15 dark:bg-ink-950/30 dark:text-ink-200">
        <p class="mb-2 text-xs font-extrabold uppercase tracking-widest text-ink-400">
          {{ $t('practice.reading') }}
        </p>
        <p>{{ entry.readingPassage }}</p>
      </div>
      <p class="text-xs font-extrabold uppercase tracking-widest text-ink-400 dark:text-ink-500">
        {{ $t('practice.quizPromptLabel') }}
      </p>
      <p class="mt-3 text-[15px] leading-relaxed text-ink-950 dark:text-ink-50 font-bold sm:text-base">
        <template v-if="!answered && hasBlank">
          {{ promptParts[0] }}
          <span class="mx-1.5 inline-block w-16 border-b-2 border-ink-300 dark:border-ink-500 align-middle" />
          {{ promptParts.slice(1).join('_____') }}
        </template>
        <template v-else-if="answered && hasBlank">
          {{ question.prompt.replace('_____', answerText) }}
        </template>
        <template v-else>
          {{ question.prompt }}
        </template>
      </p>
    </div>

    <div class="mt-6 grid gap-3 sm:grid-cols-2">
      <button
        v-for="(option, optionIndex) in question.opts"
        :key="`${optionIndex}`"
        type="button"
        :class="optionClass(optionIndex)"
        :disabled="answered"
        :aria-pressed="selectedIndex === optionIndex"
        :aria-keyshortcuts="labels[optionIndex]"
        @click="choose(optionIndex)"
      >
        <span class="shrink-0 text-ink-400 dark:text-ink-500 font-extrabold">{{ labels[optionIndex] }}.</span>
        <span class="text-ink-850 dark:text-ink-200">{{ option }}</span>
      </button>
    </div>

    <p v-if="!answered" class="mt-3 text-center text-[11px] font-semibold text-ink-400">
      {{ $t('practice.keyboardHint') }}
    </p>

    <div
      v-if="answered"
      class="mt-6 rounded-2xl border border-ink-200/70 bg-white/80 p-5 text-left transition-all duration-300 dark:border-ink-200/25 dark:bg-ink-900"
      role="status"
      aria-live="polite"
    >
      <p class="text-sm font-extrabold" :class="[selectedIndex === question.ans ? 'text-emerald-600 dark:text-emerald-400' : selectedIndex == null ? 'text-ink-500' : 'text-red-500']">
        {{ selectedIndex === question.ans ? $t('result.correct') : selectedIndex == null ? $t('result.skipped') : $t('result.wrong') }}
      </p>
      <p class="mt-2 text-sm leading-relaxed text-ink-600 dark:text-ink-400">
        {{ $t('result.correctAnswer') }}：<span class="font-bold text-emerald-600 dark:text-emerald-400"> {{ answerText }}</span>。
        <span class="block mt-2 font-semibold text-ink-950 dark:text-ink-50">{{ entry.item.meaning }}</span>
      </p>
    </div>

    <div class="mt-6 flex justify-end gap-2">
      <Button v-if="!answered" variant="outline" class="w-full gap-2 sm:w-auto" @click="skip">
        <span>{{ $t('practice.skip') }}</span>
        <ArrowRight class="h-4 w-4" />
      </Button>
      <Button v-else variant="default" class="w-full gap-2 sm:w-auto" @click="next">
        <span>{{ index + 1 >= total ? $t('practice.submitAll') : $t('practice.next') }}</span>
        <ArrowRight class="h-4 w-4" />
      </Button>
    </div>
  </Card>
</template>

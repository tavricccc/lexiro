<script setup lang="ts">
import { ArrowRight } from 'lucide-vue-next'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { cn } from '@/lib/cn'
import { isSpellingAnswerCorrect } from '@/lib/spelling'
import Button from './ui/button/Button.vue'
import Card from './ui/card/Card.vue'
import Input from './ui/input/Input.vue'

const props = defineProps<{
  entry: { item: { word: string, pos: string, meaning: string, example: string } }
  index: number
  total: number
  review?: boolean
  draft: { answer: string } | null
}>()

const emit = defineEmits<{
  'draft-change': [payload: { answer: string }]
  'next': []
}>()

const answer = ref('')
const submitted = ref(false)
const feedbackClass = ref('')
const inputRef = ref<InstanceType<typeof Input> | null>(null)

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const wordHint = computed(() => {
  const word = props.entry.item.word
  if (word.length <= 1)
    return word
  return `${word[0]}${'＿'.repeat(word.length - 2)}${word[word.length - 1]}`
})

const blankedExample = computed(() => {
  const word = props.entry.item.word
  const regex = new RegExp(`\\b${escapeRegExp(word)}\\b`, 'gi')
  if (regex.test(props.entry.item.example))
    return props.entry.item.example.replace(regex, '_____')
  return props.entry.item.example
})

const isCorrect = computed(() => isSpellingAnswerCorrect(answer.value, props.entry.item.word))

async function focusInput() {
  await nextTick()
  inputRef.value?.focus?.()
}

watch(
  [() => props.draft?.answer, () => props.entry],
  ([ans]) => {
    answer.value = ans ?? ''
    submitted.value = Boolean(ans)
    feedbackClass.value = ''
    if (!ans)
      focusInput()
  },
  { immediate: true },
)

function submit() {
  if (submitted.value)
    return
  submitted.value = true
  feedbackClass.value = isCorrect.value ? 'feedback-correct' : answer.value.trim() ? 'feedback-wrong' : ''
  emit('draft-change', { answer: answer.value })
}

function skip() {
  if (submitted.value)
    return
  answer.value = ''
  submitted.value = true
  emit('draft-change', { answer: '' })
}

function next() {
  emit('next')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && submitted.value) {
    e.preventDefault()
    next()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  if (!submitted.value)
    focusInput()
})
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Card :class="cn('p-5 sm:p-8', feedbackClass)">
    <div class="mb-6 text-left">
      <p class="font-mono text-2xl sm:text-3xl font-extrabold tracking-widest text-accent-primary">
        {{ wordHint }}
      </p>
    </div>

    <div class="rounded-2xl bg-ink-100/80 dark:bg-ink-900 border border-ink-200/70 dark:border-ink-200/25 p-5 text-left">
      <p class="text-xs font-extrabold uppercase tracking-widest text-ink-400 dark:text-ink-500">
        {{ $t('study.example') }}
      </p>
      <p class="mt-3 text-[15px] leading-relaxed text-ink-950 dark:text-ink-50 font-bold sm:text-base">
        {{ blankedExample }}
      </p>
    </div>

    <div v-if="!submitted" class="mt-6 space-y-2 text-left">
      <label class="text-xs font-extrabold uppercase tracking-wider text-ink-500 dark:text-ink-400">
        {{ $t('spelling.inputLabel') }}
      </label>
      <div class="flex gap-3">
        <Input
          ref="inputRef"
          v-model="answer"
          :placeholder="$t('spelling.placeholder')"
          class="flex-1 font-mono text-base tracking-wide rounded-xl"
          @keydown.enter.prevent="submit"
        />
        <Button variant="default" class="shrink-0" @click="submit">
          {{ $t('result.check') }}
        </Button>
      </div>
      <p class="text-[11px] text-ink-400 dark:text-ink-500 leading-relaxed font-semibold">
        {{ $t('spelling.inputHint') }}
      </p>
      <div class="pt-2">
        <Button variant="outline" class="w-full gap-2 sm:w-auto" @click="skip">
          <span>{{ $t('practice.skip') }}</span>
          <ArrowRight class="h-4 w-4" />
        </Button>
      </div>
    </div>

    <div
      v-if="submitted"
      class="mt-6 rounded-2xl border border-ink-200/70 bg-white/80 p-5 text-left transition-all duration-300 dark:border-ink-200/25 dark:bg-ink-900"
      role="status"
      aria-live="polite"
    >
      <p class="text-sm font-extrabold" :class="[isCorrect ? 'text-emerald-600 dark:text-emerald-400' : answer.trim() ? 'text-red-500' : 'text-ink-500']">
        {{ isCorrect ? $t('result.correct') : answer.trim() ? $t('result.wrong') : $t('result.skipped') }}
      </p>
      <p class="mt-2 text-sm leading-relaxed text-ink-600 dark:text-ink-400">
        {{ $t('result.correctAnswer') }}：<span class="font-bold text-emerald-600 dark:text-emerald-400"> {{ entry.item.word }}</span>
        <span v-if="entry.item.pos" class="font-bold text-accent-primary">（{{ entry.item.pos }}）</span>，
        <span class="block mt-2 font-semibold text-ink-950 dark:text-ink-50">{{ entry.item.meaning }}</span>
      </p>

      <Button variant="default" class="mt-4 w-full gap-2 sm:w-auto" @click="next">
        <span>{{ index + 1 >= total ? $t('practice.submitAll') : $t('practice.next') }}</span>
        <ArrowRight class="h-4 w-4" />
      </Button>
    </div>
  </Card>
</template>

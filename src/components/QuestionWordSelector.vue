<script setup lang="ts">
import type { GeneratedQuestionDifficulty, GeneratedQuestionKind } from '@/lib/question-generation'
import type { WordEntry } from '@/types'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { generationSenseKey } from '@/lib/question-generation'
import { createGeneratedQuestionTypeOptions, createQuestionDifficultyOptions } from '@/lib/question-options'
import Button from './ui/button/Button.vue'
import Input from './ui/input/Input.vue'

type GenerationStep = 1 | 2

const props = defineProps<{
  step: GenerationStep
  kind: GeneratedQuestionKind
  difficulty: GeneratedQuestionDifficulty
  words: WordEntry[]
  selectedKeys: string[]
  query: string
  selectionLimit: number | null
}>()

const emit = defineEmits<{
  'next': []
  'back': []
  'update:kind': [value: GeneratedQuestionKind]
  'update:difficulty': [value: GeneratedQuestionDifficulty]
  'update:query': [value: string]
  'update:selectedKeys': [value: string[]]
}>()

const { t } = useI18n()
const questionTypes = computed(() => createGeneratedQuestionTypeOptions(t))
const difficultyOptions = computed(() => createQuestionDifficultyOptions(t))
const difficultyModel = computed({
  get: () => String(props.difficulty),
  set: (value: string) => emit('update:difficulty', Number(value) as 1 | 2 | 3),
})
const selectedTypeLabel = computed(() => questionTypes.value.find(option => option.value === props.kind)?.label ?? '')
const matches = computed(() => {
  const normalized = props.query.trim().toLocaleLowerCase()
  return props.words
    .filter(word => !normalized || word.word.toLocaleLowerCase().includes(normalized) || word.senses.some(sense => sense.meaningZh.toLocaleLowerCase().includes(normalized)))
    .slice(0, 60)
})
const selectedSenseCount = computed(() => props.selectedKeys.length)
const queryModel = computed({
  get: () => props.query,
  set: (value: string) => emit('update:query', value),
})

function wordSenseKeys(word: WordEntry): string[] {
  return word.senses.map(sense => generationSenseKey(word.wordKey, sense.id))
}

function toggleWord(word: WordEntry) {
  const keys = wordSenseKeys(word)
  const selected = new Set(props.selectedKeys)
  if (keys.every(key => selected.has(key))) {
    emit('update:selectedKeys', props.selectedKeys.filter(key => !keys.includes(key)))
    return
  }
  for (const key of keys) {
    if (selected.has(key))
      continue
    if (props.selectionLimit && selected.size >= props.selectionLimit)
      break
    selected.add(key)
  }
  emit('update:selectedKeys', Array.from(selected))
}

function toggleSense(word: WordEntry, senseId: string) {
  const key = generationSenseKey(word.wordKey, senseId)
  if (props.selectedKeys.includes(key)) {
    emit('update:selectedKeys', props.selectedKeys.filter(item => item !== key))
    return
  }
  if (props.selectionLimit && props.selectedKeys.length >= props.selectionLimit)
    return
  emit('update:selectedKeys', [...props.selectedKeys, key])
}

function selectAllMatches() {
  const keys: string[] = []
  for (const word of matches.value) {
    for (const key of wordSenseKeys(word)) {
      if (props.selectionLimit && keys.length >= props.selectionLimit)
        break
      keys.push(key)
    }
    if (props.selectionLimit && keys.length >= props.selectionLimit)
      break
  }
  emit('update:selectedKeys', keys)
}

function clearSelection() {
  emit('update:selectedKeys', [])
}
</script>

<template>
  <div class="space-y-5">
    <ol class="grid grid-cols-2 gap-2" :aria-label="$t('library.questionGenerationSteps')">
      <li v-for="currentStep in 2" :key="currentStep" class="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold" :class="currentStep <= step ? 'border-accent-primary/20 bg-accent-primary/10 text-accent-primary' : 'border-ink-200/60 text-ink-400 dark:border-ink-200/20'">
        <span class="flex h-5 w-5 items-center justify-center rounded-full border border-current text-[10px]">{{ currentStep }}</span>
        {{ currentStep === 1 ? $t('library.chooseQuestionType') : $t('library.questionDifficulty') }}
      </li>
    </ol>

    <div v-if="step === 1" class="space-y-4 text-left">
      <p class="text-xs font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">
        {{ $t('library.chooseQuestionType') }}
      </p>
      <div class="grid gap-2 sm:grid-cols-3">
        <button v-for="option in questionTypes" :key="option.value" type="button" class="min-h-11 rounded-xl border px-3 py-3 text-left text-sm font-semibold transition-colors" :class="kind === option.value ? 'border-accent-primary bg-accent-primary/10 text-accent-primary' : 'border-ink-200/70 text-ink-700 hover:border-accent-primary/40 dark:border-ink-200/20 dark:text-ink-200'" @click="emit('update:kind', option.value)">
          {{ option.label }}
        </button>
      </div>
      <p v-if="selectionLimit" class="text-xs text-ink-400">
        {{ $t('library.readingSelectionLimit', { count: selectionLimit }) }}
      </p>
      <div class="flex justify-end">
        <Button variant="default" @click="emit('next')">
          {{ $t('library.nextStep') }}
        </Button>
      </div>
    </div>

    <div v-else class="space-y-5 text-left">
      <div class="space-y-3 rounded-2xl bg-accent-primary/10 p-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p class="text-xs font-bold uppercase tracking-wider text-accent-primary">
              {{ $t('library.questionDifficulty') }}
            </p>
            <p class="mt-1 text-sm font-bold text-ink-900 dark:text-ink-100">
              {{ selectedTypeLabel }} · {{ difficultyOptions.find(option => option.value === String(difficulty))?.label }}
            </p>
          </div>
          <span class="flex h-9 w-9 items-center justify-center rounded-full bg-accent-primary text-sm font-black text-white">
            {{ difficulty }}
          </span>
        </div>
        <input v-model="difficultyModel" type="range" min="1" max="3" step="1" class="h-2 w-full cursor-pointer accent-[var(--accent-primary)]" :aria-label="$t('library.questionDifficulty')">
        <div class="flex justify-between gap-2 text-[11px] font-semibold text-ink-500 dark:text-ink-400">
          <span v-for="option in difficultyOptions" :key="option.value">{{ option.label }}</span>
        </div>
      </div>

      <div class="flex justify-start">
        <Button variant="ghost" class="-ml-3" @click="emit('back')">
          {{ $t('library.backStep') }}
        </Button>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-xs font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">
          {{ $t('library.chooseWords') }} · {{ $t('library.selectedSensesCount', { count: selectedSenseCount }) }}
        </p>
        <div class="flex gap-2">
          <Button variant="ghost" size="sm" @click="selectAllMatches">
            {{ $t('library.selectAll') }}
          </Button>
          <Button variant="ghost" size="sm" @click="clearSelection">
            {{ $t('library.clearSelection') }}
          </Button>
        </div>
      </div>
      <Input v-model="queryModel" :placeholder="$t('library.searchWordsToGenerate')" class="rounded-xl" />
      <div class="grid max-h-[42dvh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
        <div v-for="word in matches" :key="word.wordKey" class="rounded-xl border border-ink-200/60 px-3 py-2 text-sm dark:border-ink-200/20">
          <label class="flex cursor-pointer items-center gap-2 font-semibold">
            <input type="checkbox" :checked="word.senses.every(sense => selectedKeys.includes(generationSenseKey(word.wordKey, sense.id)))" :disabled="Boolean(selectionLimit && !word.senses.some(sense => !selectedKeys.includes(generationSenseKey(word.wordKey, sense.id))) && selectedKeys.length >= selectionLimit)" @change="toggleWord(word)">
            <span class="truncate">{{ word.word }}</span>
          </label>
          <div class="mt-2 space-y-1 border-t border-ink-200/50 pt-2 dark:border-ink-800/70">
            <label v-for="sense in word.senses" :key="sense.id" class="flex cursor-pointer items-start gap-2 text-xs font-medium text-ink-600 dark:text-ink-300">
              <input type="checkbox" :checked="selectedKeys.includes(generationSenseKey(word.wordKey, sense.id))" :disabled="Boolean(selectionLimit && !selectedKeys.includes(generationSenseKey(word.wordKey, sense.id)) && selectedKeys.length >= selectionLimit)" @change="toggleSense(word, sense.id)">
              <span><span class="font-bold">{{ sense.pos }}</span>｜{{ sense.meaningZh }}</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

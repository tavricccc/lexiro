<script setup lang="ts">
import type { GeneratedQuestionDifficulty, GeneratedQuestionKind } from '@/lib/question-generation'
import type { WordEntry } from '@/types'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { generationSenseKey } from '@/lib/question-generation'
import { createGeneratedQuestionTypeOptions, createQuestionDifficultyOptions } from '@/lib/question-options'
import Button from './ui/button/Button.vue'
import Input from './ui/input/Input.vue'
import Select from './ui/select/Select.vue'

const props = defineProps<{
  kind: GeneratedQuestionKind
  difficulty: GeneratedQuestionDifficulty
  words: WordEntry[]
  selectedKeys: string[]
  query: string
  selectionLimit: number | null
}>()

const emit = defineEmits<{
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
    <div class="space-y-2 text-left">
      <p class="text-xs font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">
        {{ $t('library.chooseQuestionType') }}
      </p>
      <div class="grid gap-2 sm:grid-cols-3">
        <button v-for="option in questionTypes" :key="option.value" type="button" class="rounded-xl border px-3 py-3 text-left text-sm font-semibold transition-colors" :class="kind === option.value ? 'border-accent-primary bg-accent-primary/10 text-accent-primary' : 'border-ink-200/70 text-ink-700 hover:border-accent-primary/40 dark:border-ink-200/20 dark:text-ink-200'" @click="emit('update:kind', option.value)">
          {{ option.label }}
        </button>
      </div>
      <p v-if="selectionLimit" class="text-xs text-ink-400">
        {{ $t('library.readingSelectionLimit', { count: selectionLimit }) }}
      </p>
    </div>

    <div class="space-y-2 text-left">
      <p class="text-xs font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">
        {{ $t('library.questionDifficulty') }}
      </p>
      <Select v-model="difficultyModel" :options="difficultyOptions" />
    </div>

    <div class="space-y-2 text-left">
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
            <span class="ml-auto text-xs text-ink-400">{{ $t('library.sensesCount', { count: word.senses.length }) }}</span>
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

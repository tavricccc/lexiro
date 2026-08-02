<script setup lang="ts">
import type { ReadingChildQuestion, ReadingPack, StudyWord } from '@/types'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { canonicalizeQuestion, senseToStudyWord } from '@/lib/library'
import { createAnswerOptions, createQuestionDifficultyOptions } from '@/lib/question-options'
import { parseAnswerIndex, parseQuestionDifficulty } from '@/lib/question-shape'
import { validateReadingDraft } from '@/lib/question-validation'
import { useLibraryStore } from '@/stores/library'
import { useUIStore } from '@/stores/ui'
import Badge from './ui/badge/Badge.vue'
import Button from './ui/button/Button.vue'
import Card from './ui/card/Card.vue'
import Input from './ui/input/Input.vue'
import Select from './ui/select/Select.vue'
import StatusMessage from './ui/status-message/StatusMessage.vue'
import Textarea from './ui/textarea/Textarea.vue'

const route = useRoute()
const router = useRouter()
const libraryStore = useLibraryStore()
const uiStore = useUIStore()
const { t } = useI18n()
const error = ref('')

const wordKey = computed(() => typeof route.params.wordKey === 'string' ? route.params.wordKey : '')
const word = computed(() => libraryStore.getWord(wordKey.value))
const setId = computed(() => typeof route.query.setId === 'string' ? route.query.setId : '')
const existingQuestion = computed(() => {
  const questionId = typeof route.query.questionId === 'string' ? route.query.questionId : ''
  return libraryStore.questions.find(question => question.id === questionId) ?? null
})
const existingReading = computed<ReadingPack | null>(() => existingQuestion.value?.kind === 'reading' ? existingQuestion.value : null)
const currentSenseIds = computed(() => new Set(libraryStore.getMembership(setId.value, wordKey.value)?.senseIds ?? []))
const currentSenses = computed(() => word.value?.senses.filter(sense => !setId.value || currentSenseIds.value.has(sense.id)) ?? [])
const availableStudyWords = computed<StudyWord[]>(() => {
  const fromSet = setId.value ? libraryStore.getSetStudyWords(setId.value) : []
  if (fromSet.length)
    return fromSet
  return word.value ? currentSenses.value.map(sense => senseToStudyWord(word.value!, sense)) : []
})
const difficultyOptions = computed(() => createQuestionDifficultyOptions(t))
const readingDraft = ref<ReadingPack>(createReadingPack(null))

function now(): string {
  return new Date().toISOString()
}

function firstStudyWord(): StudyWord | null {
  return availableStudyWords.value.find(item => item.wordKey === wordKey.value) ?? availableStudyWords.value[0] ?? null
}

function createReadingChild(studyWord: StudyWord): ReadingChildQuestion {
  return {
    id: `reading-child-${crypto.randomUUID()}`,
    kind: 'multipleChoice',
    prompt: '',
    options: ['', '', '', ''],
    answerIndex: 0,
    wordKey: studyWord.wordKey,
    senseId: studyWord.id,
  }
}

function createReadingPack(question: ReadingPack | null): ReadingPack {
  if (question) {
    return {
      ...question,
      wordKeys: [...question.wordKeys],
      questions: question.questions.map(child => ({ ...child, options: [...child.options] })),
    }
  }
  const sense = firstStudyWord()
  const timestamp = now()
  return {
    id: `reading-editor-${crypto.randomUUID()}`,
    fingerprint: '',
    kind: 'reading',
    difficulty: 2,
    title: '',
    passage: '',
    wordKeys: sense ? [sense.wordKey] : [],
    questions: sense ? [createReadingChild(sense)] : [],
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

watch(
  [() => existingReading.value?.id ?? '', () => wordKey.value, () => setId.value],
  () => {
    readingDraft.value = createReadingPack(existingReading.value)
    error.value = ''
  },
  { immediate: true },
)

function setQuestionDifficulty(value: string) {
  const difficulty = parseQuestionDifficulty(value)
  if (difficulty)
    readingDraft.value.difficulty = difficulty
}

function setChildSense(child: ReadingChildQuestion, value: string) {
  const sense = availableStudyWords.value.find(item => item.id === value)
  if (sense) {
    child.wordKey = sense.wordKey
    child.senseId = sense.id
  }
}

function setChildAnswer(child: ReadingChildQuestion, value: string) {
  const answerIndex = parseAnswerIndex(value, child.options.length)
  if (answerIndex !== null)
    child.answerIndex = answerIndex
}

function childAnswerOptions() {
  return createAnswerOptions(t, 4)
}

function addReadingChild() {
  const sense = availableStudyWords.value.find(item => !readingDraft.value.questions.some(child => child.senseId === item.id)) ?? firstStudyWord()
  if (sense)
    readingDraft.value.questions.push(createReadingChild(sense))
}

function removeReadingChild(index: number) {
  if (readingDraft.value.questions.length > 1)
    readingDraft.value.questions.splice(index, 1)
}

async function saveQuestion(question: ReadingPack) {
  if (existingReading.value) {
    const usages = libraryStore.getQuestionSetIds(existingReading.value)
    if (usages.length > 1 && !await uiStore.showConfirm(
      t('vocabulary.sharedChangeTitle'),
      t('vocabulary.sharedChangeMessage', {
        count: usages.length,
        sets: usages.map(id => libraryStore.getSet(id)?.setName).filter(Boolean).join('、'),
      }),
    )) {
      return
    }
    if (!libraryStore.updateQuestion(question)) {
      error.value = t('vocabulary.questionSourceInvalid')
      return
    }
  }
  else if (!libraryStore.importQuestions([question])) {
    error.value = t('vocabulary.questionSourceInvalid')
    return
  }
  await router.back()
}

async function save() {
  error.value = ''
  const normalized = {
    ...readingDraft.value,
    title: readingDraft.value.title.trim(),
    passage: readingDraft.value.passage.trim(),
    wordKeys: Array.from(new Set(readingDraft.value.questions.map(child => child.wordKey))),
    questions: readingDraft.value.questions.map(child => ({
      ...child,
      prompt: child.prompt.trim(),
      options: child.options.map(option => option.trim()),
    })),
    updatedAt: now(),
  }
  const validation = validateReadingDraft(normalized)
  if (validation) {
    error.value = validation === 'englishOnly' ? t('vocabulary.questionEnglishOnly') : t('vocabulary.readingFieldsRequired')
    return
  }
  await saveQuestion(canonicalizeQuestion(normalized) as ReadingPack)
}
</script>

<template>
  <section v-if="word && (!existingQuestion || existingReading)" class="space-y-6 text-left">
    <div>
      <Button variant="ghost" class="mb-3 -ml-3" @click="router.back()">
        {{ $t('vocabulary.back') }}
      </Button>
      <div class="flex flex-wrap items-center gap-3">
        <h1 class="text-3xl font-black tracking-tight">
          {{ existingReading ? $t('vocabulary.editReading') : $t('vocabulary.addReading') }}
        </h1>
        <Badge variant="secondary">
          {{ word.word }}
        </Badge>
      </div>
      <p class="mt-1 text-sm font-semibold text-ink-500">
        {{ $t('vocabulary.readingPageDescription') }}
      </p>
    </div>

    <Card class="space-y-4 p-5 sm:p-6">
      <div class="grid gap-3 sm:grid-cols-2">
        <Input v-model="readingDraft.title" :placeholder="$t('library.readingTitle')" />
        <Select :model-value="String(readingDraft.difficulty)" :options="difficultyOptions" :placeholder="$t('library.questionDifficulty')" @update:model-value="setQuestionDifficulty" />
      </div>
      <Textarea v-model="readingDraft.passage" :rows="8" :placeholder="$t('library.readingPassage')" />
      <div class="space-y-3 border-t border-ink-200/70 pt-4 dark:border-ink-800">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-lg font-black">
            {{ $t('vocabulary.readingQuestions') }}
          </h2>
          <Button variant="outline" size="sm" @click="addReadingChild">
            {{ $t('vocabulary.addReadingQuestion') }}
          </Button>
        </div>
        <article v-for="(child, index) in readingDraft.questions" :key="child.id" class="space-y-3 rounded-2xl border border-ink-200/70 p-4 dark:border-ink-200/20">
          <div class="flex items-center justify-between gap-3">
            <p class="text-xs font-black uppercase tracking-wider text-ink-400">
              {{ $t('library.questionNumber', { number: index + 1 }) }}
            </p>
            <Button variant="ghost" size="sm" :disabled="readingDraft.questions.length <= 1" @click="removeReadingChild(index)">
              {{ $t('vocabulary.removeReadingQuestion') }}
            </Button>
          </div>
          <Select :model-value="child.senseId" :options="availableStudyWords.map(sense => ({ value: sense.id, label: `${sense.word} · ${sense.pos}｜${sense.meaning}` }))" :placeholder="$t('vocabulary.readingSense')" @update:model-value="setChildSense(child, $event)" />
          <Textarea v-model="child.prompt" :rows="3" :placeholder="$t('library.readingQuestionPrompt')" />
          <div class="grid gap-2 sm:grid-cols-2">
            <Input v-for="(_, optionIndex) in child.options" :key="optionIndex" v-model="child.options[optionIndex]" :placeholder="$t('library.answerOption', { index: optionIndex + 1 })" />
          </div>
          <Select :model-value="String(child.answerIndex)" :options="childAnswerOptions()" :placeholder="$t('library.correctAnswer')" @update:model-value="setChildAnswer(child, $event)" />
        </article>
      </div>
    </Card>

    <StatusMessage v-if="error" tone="error">
      {{ error }}
    </StatusMessage>
    <div class="flex justify-end gap-2">
      <Button variant="outline" @click="router.back()">
        {{ $t('editor.cancel') }}
      </Button>
      <Button @click="save">
        {{ $t('editor.save') }}
      </Button>
    </div>
  </section>
  <div v-else class="py-20 text-center text-sm font-semibold text-ink-400">
    {{ $t('vocabulary.notFound') }}
  </div>
</template>

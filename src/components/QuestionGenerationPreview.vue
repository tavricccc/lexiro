<script setup lang="ts">
import type { LibraryQuestion } from '@/types'
import { Trash2 } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { createAnswerOptions, createQuestionDifficultyOptions, questionTypeLabel } from '@/lib/question-options'
import { parseAnswerIndex, parseQuestionDifficulty } from '@/lib/question-shape'
import { isCanonicalQuestion } from '@/lib/question-validation'
import Button from './ui/button/Button.vue'
import Input from './ui/input/Input.vue'
import Select from './ui/select/Select.vue'
import Textarea from './ui/textarea/Textarea.vue'

const props = defineProps<{
  questions: LibraryQuestion[]
}>()

const emit = defineEmits<{
  import: [questions: LibraryQuestion[]]
}>()

const { t } = useI18n()
const editableQuestions = ref<LibraryQuestion[]>([])

const difficultyOptions = computed(() => createQuestionDifficultyOptions(t))

const canImport = computed(() => editableQuestions.value.length > 0 && editableQuestions.value.every(isCanonicalQuestion))

watch(() => props.questions, (questions) => {
  editableQuestions.value = questions.map(cloneQuestion)
}, { immediate: true })

function cloneQuestion(question: LibraryQuestion): LibraryQuestion {
  if (question.kind === 'reading') {
    return {
      ...question,
      wordKeys: [...question.wordKeys],
      questions: question.questions.map(child => ({ ...child, options: [...child.options] })),
    }
  }
  return {
    ...question,
    options: [...question.options],
    whyWrong: question.whyWrong ? { ...question.whyWrong } : undefined,
  }
}

function removeQuestion(index: number) {
  editableQuestions.value.splice(index, 1)
}

function updateAnswerIndex(question: { answerIndex: number, options: string[] }, value: string) {
  const answerIndex = parseAnswerIndex(value, question.options.length)
  if (answerIndex !== null)
    question.answerIndex = answerIndex
}

function updateDifficulty(question: LibraryQuestion, value: string) {
  const difficulty = parseQuestionDifficulty(value)
  if (difficulty)
    question.difficulty = difficulty
}

function answerOptions(options: string[]) {
  return createAnswerOptions(t, options.length)
}

function importQuestions() {
  if (canImport.value)
    emit('import', editableQuestions.value.map(cloneQuestion))
}
</script>

<template>
  <div v-if="editableQuestions.length" class="rounded-xl bg-ink-50 p-3 text-left dark:bg-ink-950/30">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-sm font-bold">
        {{ t('library.generationPreview', { count: editableQuestions.length }) }}
      </p>
      <p class="text-xs text-ink-500 dark:text-ink-400">
        {{ t('library.previewEditHint') }}
      </p>
    </div>

    <div class="mt-3 max-h-[48dvh] space-y-3 overflow-y-auto pr-1">
      <article v-for="(question, questionIndex) in editableQuestions" :key="question.id" class="rounded-2xl border border-ink-200/70 bg-white p-3 dark:border-ink-800 dark:bg-ink-900/60">
        <div class="mb-3 flex items-center justify-between gap-2">
          <span class="text-xs font-bold text-ink-500 dark:text-ink-400">
            {{ t('library.questionNumber', { number: questionIndex + 1 }) }} · {{ questionTypeLabel(question, t) }}
          </span>
          <Button size="icon" variant="ghost" :aria-label="t('library.removeQuestion')" @click="removeQuestion(questionIndex)">
            <Trash2 class="h-4 w-4 text-red-500" />
          </Button>
        </div>

        <template v-if="question.kind === 'reading'">
          <div class="space-y-2">
            <Input v-model="question.title" :placeholder="t('library.readingTitle')" />
            <Textarea v-model="question.passage" :rows="4" :placeholder="t('library.readingPassage')" />
            <Select :model-value="String(question.difficulty)" :options="difficultyOptions" :placeholder="t('library.questionDifficulty')" @update:model-value="updateDifficulty(question, $event)" />
          </div>

          <div class="mt-3 space-y-3 border-t border-ink-200/70 pt-3 dark:border-ink-800">
            <div v-for="child in question.questions" :key="child.id" class="space-y-2 rounded-xl bg-ink-50/80 p-3 dark:bg-ink-950/40">
              <Input v-model="child.prompt" :placeholder="t('library.readingQuestionPrompt')" />
              <div class="grid gap-2 sm:grid-cols-2">
                <Input v-for="(_, optionIndex) in child.options" :key="optionIndex" v-model="child.options[optionIndex]" :placeholder="t('library.answerOption', { index: optionIndex + 1 })" />
              </div>
              <Select :model-value="String(child.answerIndex)" :options="answerOptions(child.options)" :placeholder="t('library.correctAnswer')" @update:model-value="updateAnswerIndex(child, $event)" />
            </div>
          </div>
        </template>

        <template v-else>
          <div class="space-y-2">
            <Textarea v-model="question.prompt" :rows="3" :placeholder="t('library.questionPrompt')" />
            <div class="grid gap-2 sm:grid-cols-2">
              <Input v-for="(_, optionIndex) in question.options" :key="optionIndex" v-model="question.options[optionIndex]" :placeholder="t('library.answerOption', { index: optionIndex + 1 })" />
            </div>
            <div class="grid gap-2 sm:grid-cols-2">
              <Select :model-value="String(question.answerIndex)" :options="answerOptions(question.options)" :placeholder="t('library.correctAnswer')" @update:model-value="updateAnswerIndex(question, $event)" />
              <Select :model-value="String(question.difficulty)" :options="difficultyOptions" :placeholder="t('library.questionDifficulty')" @update:model-value="updateDifficulty(question, $event)" />
            </div>
          </div>
        </template>
      </article>
    </div>

    <p v-if="!canImport" class="mt-3 text-xs font-semibold text-red-600 dark:text-red-400">
      {{ t('library.previewInvalid') }}
    </p>
    <Button class="mt-3" size="sm" variant="outline" :disabled="!canImport" @click="importQuestions">
      {{ t('library.importGenerated') }}
    </Button>
  </div>
</template>

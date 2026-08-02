<script setup lang="ts">
import type { MultipleChoiceQuestion, StudyWord } from '@/types'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { canonicalizeQuestion, senseToStudyWord } from '@/lib/library'
import { createAnswerOptions, createQuestionDifficultyOptions, createQuestionEditorTypeOptions } from '@/lib/question-options'
import { parseAnswerIndex, parseQuestionDifficulty } from '@/lib/question-shape'
import { validateMultipleChoiceDraft } from '@/lib/question-validation'
import { useLibraryStore } from '@/stores/library'
import { useUIStore } from '@/stores/ui'
import Button from '../ui/button/Button.vue'
import DialogFooter from '../ui/dialog-footer/DialogFooter.vue'
import Dialog from '../ui/dialog/Dialog.vue'
import Input from '../ui/input/Input.vue'
import Select from '../ui/select/Select.vue'
import StatusMessage from '../ui/status-message/StatusMessage.vue'
import Textarea from '../ui/textarea/Textarea.vue'

const props = defineProps<{
  open: boolean
  wordKey: string
  setId: string
  question: MultipleChoiceQuestion | null
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const libraryStore = useLibraryStore()
const uiStore = useUIStore()
const { t } = useI18n()
const error = ref('')

const availableSenses = computed<StudyWord[]>(() => {
  const fromSet = props.setId
    ? libraryStore.getSetStudyWords(props.setId).filter(item => item.wordKey === props.wordKey)
    : []
  if (fromSet.length)
    return fromSet

  const word = libraryStore.getWord(props.wordKey)
  return word?.senses.map(sense => senseToStudyWord(word, sense)) ?? []
})
const draft = ref<MultipleChoiceQuestion>(createDraft(null))

const questionTypeOptions = computed(() => createQuestionEditorTypeOptions(t))
const difficultyOptions = computed(() => createQuestionDifficultyOptions(t))
const answerOptions = computed(() => createAnswerOptions(t, draft.value.options.length))

function now(): string {
  return new Date().toISOString()
}

function createDraft(question: MultipleChoiceQuestion | null): MultipleChoiceQuestion {
  if (question)
    return { ...question, options: [...question.options], whyWrong: question.whyWrong ? { ...question.whyWrong } : undefined }

  const timestamp = now()
  const firstSense = availableSenses.value[0]
  return {
    id: `question-editor-${crypto.randomUUID()}`,
    fingerprint: '',
    kind: 'multipleChoice',
    questionStyle: 'standard',
    wordKey: firstSense?.wordKey ?? props.wordKey,
    senseId: firstSense?.id ?? '',
    difficulty: 2,
    prompt: '',
    options: ['', '', '', ''],
    answerIndex: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function reset() {
  draft.value = createDraft(props.question)
  error.value = ''
}

watch([() => props.open, () => props.question], ([open]) => {
  if (open)
    reset()
}, { immediate: true })

function setSense(value: string) {
  const sense = availableSenses.value.find(item => item.id === value)
  if (sense) {
    draft.value.wordKey = sense.wordKey
    draft.value.senseId = sense.id
  }
}

function setQuestionDifficulty(value: string) {
  const difficulty = parseQuestionDifficulty(value)
  if (difficulty)
    draft.value.difficulty = difficulty
}

function setAnswer(value: string) {
  const answerIndex = parseAnswerIndex(value, draft.value.options.length)
  if (answerIndex !== null)
    draft.value.answerIndex = answerIndex
}

async function save() {
  error.value = ''
  const prompt = draft.value.prompt.trim()
  const options = draft.value.options.map(option => option.trim())
  const normalizedDraft = {
    ...draft.value,
    prompt,
    options,
  }
  const validation = validateMultipleChoiceDraft(normalizedDraft)
  if (validation === 'englishOnly') {
    error.value = t('vocabulary.questionEnglishOnly')
    return
  }
  if (validation === 'fillBlankPrompt') {
    error.value = t('vocabulary.fillBlankPromptRequired')
    return
  }
  if (validation === 'standardPrompt') {
    error.value = t('vocabulary.standardPromptNoBlank')
    return
  }
  if (validation) {
    error.value = t('vocabulary.questionFieldsRequired')
    return
  }

  const normalized = canonicalizeQuestion({
    ...normalizedDraft,
    updatedAt: now(),
  })
  if (props.question) {
    const usages = libraryStore.getQuestionSetIds(props.question)
    if (usages.length > 1) {
      const confirmed = await uiStore.showConfirm(
        t('vocabulary.sharedChangeTitle'),
        t('vocabulary.sharedChangeMessage', {
          count: usages.length,
          sets: usages.map(id => libraryStore.getSet(id)?.setName).filter(Boolean).join('、'),
        }),
      )
      if (!confirmed)
        return
    }
    if (!libraryStore.updateQuestion(normalized)) {
      error.value = t('vocabulary.questionSourceInvalid')
      return
    }
  }
  else if (!libraryStore.importQuestions([normalized])) {
    error.value = t('vocabulary.questionSourceInvalid')
    return
  }

  emit('saved')
  emit('close')
}
</script>

<template>
  <Dialog
    :open="open"
    :title="question ? $t('vocabulary.editQuestion') : $t('vocabulary.addQuestion')"
    :description="$t('vocabulary.questionDialogDescription')"
    width-class="max-w-2xl"
    @close="emit('close')"
  >
    <div class="space-y-4">
      <StatusMessage v-if="error" tone="error">
        {{ error }}
      </StatusMessage>
      <label class="block text-sm font-bold">
        {{ $t('library.chooseQuestionType') }}
        <Select v-model="draft.questionStyle" :options="questionTypeOptions" class="mt-2" />
      </label>
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="block text-sm font-bold">
          {{ $t('vocabulary.questionSense') }}
          <Select :model-value="draft.senseId" :options="availableSenses.map(sense => ({ value: sense.id, label: `${sense.pos}｜${sense.meaning}` }))" class="mt-2" @update:model-value="setSense" />
        </label>
        <label class="block text-sm font-bold">
          {{ $t('library.questionDifficulty') }}
          <Select :model-value="String(draft.difficulty)" :options="difficultyOptions" class="mt-2" @update:model-value="setQuestionDifficulty" />
        </label>
      </div>
      <label class="block text-sm font-bold">
        {{ $t('library.questionPrompt') }}
        <Textarea v-model="draft.prompt" :rows="4" class="mt-2" />
      </label>
      <div class="grid gap-2 sm:grid-cols-2">
        <label v-for="(_, index) in draft.options" :key="index" class="block text-sm font-bold">
          {{ $t('library.answerOption', { index: index + 1 }) }}
          <Input v-model="draft.options[index]" class="mt-2" />
        </label>
      </div>
      <label class="block text-sm font-bold">
        {{ $t('library.correctAnswer') }}
        <Select :model-value="String(draft.answerIndex)" :options="answerOptions" class="mt-2" @update:model-value="setAnswer" />
      </label>
      <DialogFooter>
        <Button variant="outline" @click="emit('close')">
          {{ $t('editor.cancel') }}
        </Button>
        <Button @click="save">
          {{ $t('editor.save') }}
        </Button>
      </DialogFooter>
    </div>
  </Dialog>
</template>

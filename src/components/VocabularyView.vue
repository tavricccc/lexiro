<script setup lang="ts">
import type { LibraryQuestion, MultipleChoiceQuestion, VocabularyDifficultyFilter, VocabularyQuestionTypeFilter, WordSense } from '@/types'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { createVocabularyDifficultyOptions, createVocabularyQuestionTypeOptions } from '@/lib/question-options'
import { useLibraryStore } from '@/stores/library'
import { useUIStore } from '@/stores/ui'
import QuestionEditorDialog from './dialogs/QuestionEditorDialog.vue'
import VocabularySenseDialogs from './dialogs/VocabularySenseDialogs.vue'
import Badge from './ui/badge/Badge.vue'
import Button from './ui/button/Button.vue'
import VocabularyQuestionsPanel from './VocabularyQuestionsPanel.vue'
import VocabularySensesPanel from './VocabularySensesPanel.vue'

type Tab = 'senses' | 'questions'

const route = useRoute()
const router = useRouter()
const libraryStore = useLibraryStore()
const uiStore = useUIStore()
const { t } = useI18n()
const tab = ref<Tab>('senses')
const otherExpanded = ref(false)
const questionTypeFilter = ref<VocabularyQuestionTypeFilter>('all')
const difficultyFilter = ref<VocabularyDifficultyFilter>('all')
const senseDialogOpen = ref(false)
const exampleDialogOpen = ref(false)
const questionDialogOpen = ref(false)
const editingSenseId = ref<string | null>(null)
const editingExample = ref<{ senseId: string, index: number } | null>(null)
const editingQuestion = ref<MultipleChoiceQuestion | null>(null)
const sensePos = ref('')
const senseMeaning = ref('')
const exampleValue = ref('')
const senseError = ref('')

function senseSetNames(senseId: string): string {
  return libraryStore.getSenseSetNames(wordKey.value, senseId).join('、')
}

const wordKey = computed(() => typeof route.params.wordKey === 'string' ? route.params.wordKey : '')
const word = computed(() => libraryStore.getWord(wordKey.value))
const setId = computed(() => {
  const requested = typeof route.query.setId === 'string' ? route.query.setId : ''
  if (requested && libraryStore.getSet(requested))
    return requested
  return word.value?.senses.flatMap(sense => libraryStore.getSenseSetIds(word.value!.wordKey, sense.id))[0] ?? ''
})
const currentSet = computed(() => libraryStore.getSet(setId.value))
const currentSenseIds = computed(() => new Set(libraryStore.getMembership(setId.value, word.value?.wordKey ?? '')?.senseIds ?? []))
const currentSenses = computed(() => word.value?.senses.filter(sense => currentSenseIds.value.has(sense.id)) ?? [])
const otherSenses = computed(() => word.value?.senses.filter(sense => !currentSenseIds.value.has(sense.id)) ?? [])
const questionTypeOptions = computed(() => createVocabularyQuestionTypeOptions(t))
const difficultyOptions = computed(() => createVocabularyDifficultyOptions(t))
const questions = computed(() => libraryStore.questions.filter((question) => {
  if (!setId.value || !libraryStore.getQuestionSetIds(question).includes(setId.value) || !word.value)
    return false
  const senseIds = currentSenseIds.value
  const related = question.kind === 'reading'
    ? question.questions.some(child => child.wordKey === word.value!.wordKey && senseIds.has(child.senseId))
    : question.wordKey === word.value!.wordKey && Boolean(question.senseId && senseIds.has(question.senseId))
  if (!related)
    return false
  const type = question.kind === 'reading' ? 'reading' : question.questionStyle
  return (questionTypeFilter.value === 'all' || type === questionTypeFilter.value)
    && (difficultyFilter.value === 'all' || String(question.difficulty) === difficultyFilter.value)
}))
const editingSense = computed(() => word.value?.senses.find(sense => sense.id === editingSenseId.value) ?? null)

function openSenseDialog(sense: WordSense) {
  editingSenseId.value = sense.id
  sensePos.value = sense.pos
  senseMeaning.value = sense.meaningZh
  senseError.value = ''
  senseDialogOpen.value = true
}

function openExampleDialog(sense: WordSense, index: number) {
  senseError.value = ''
  editingExample.value = { senseId: sense.id, index }
  exampleValue.value = sense.examples[index] ?? ''
  exampleDialogOpen.value = true
}

function openNewExampleDialog(sense: WordSense) {
  senseError.value = ''
  editingExample.value = { senseId: sense.id, index: sense.examples.length }
  exampleValue.value = ''
  exampleDialogOpen.value = true
}

async function saveSense() {
  const sense = editingSense.value
  if (!sense)
    return
  const usages = libraryStore.getSenseSetIds(wordKey.value, sense.id)
  if (usages.length > 1) {
    const confirmed = await uiStore.showConfirm(t('vocabulary.sharedChangeTitle'), t('vocabulary.sharedChangeMessage', { count: usages.length, sets: senseSetNames(sense.id) }))
    if (!confirmed)
      return
  }
  try {
    libraryStore.updateSense(wordKey.value, sense.id, { pos: sensePos.value, meaningZh: senseMeaning.value })
    senseError.value = ''
    senseDialogOpen.value = false
  }
  catch {
    senseError.value = t('vocabulary.saveFailed')
  }
}

async function saveExample() {
  const target = editingExample.value
  const currentWord = word.value
  if (!target || !currentWord || !exampleValue.value.trim())
    return
  const sense = currentWord.senses.find(item => item.id === target.senseId)
  if (!sense)
    return
  const usages = libraryStore.getSenseSetIds(currentWord.wordKey, sense.id)
  if (usages.length > 1) {
    const confirmed = await uiStore.showConfirm(t('vocabulary.sharedChangeTitle'), t('vocabulary.sharedChangeMessage', { count: usages.length, sets: senseSetNames(sense.id) }))
    if (!confirmed)
      return
  }
  const examples = [...sense.examples]
  examples[target.index] = exampleValue.value.trim()
  try {
    libraryStore.updateSense(currentWord.wordKey, sense.id, { examples })
    exampleDialogOpen.value = false
  }
  catch {
    senseError.value = t('vocabulary.saveFailed')
  }
}

async function removeExample(sense: WordSense, index: number) {
  const usages = libraryStore.getSenseSetIds(wordKey.value, sense.id)
  const confirmed = await uiStore.showConfirm(t('vocabulary.deleteExampleTitle'), t('vocabulary.sharedChangeMessage', { count: usages.length, sets: senseSetNames(sense.id) }))
  if (confirmed)
    libraryStore.updateSense(wordKey.value, sense.id, { examples: sense.examples.filter((_, exampleIndex) => exampleIndex !== index) })
}

async function removeSense(sense: WordSense) {
  if (!setId.value || !word.value)
    return
  const usages = libraryStore.getSenseSetIds(word.value.wordKey, sense.id)
  const otherSetNames = usages
    .filter(id => id !== setId.value)
    .map(id => libraryStore.getSet(id)?.setName)
    .filter((name): name is string => Boolean(name))
    .join('、')
  const message = usages.length > 1
    ? t('vocabulary.unlinkSenseMessage', { setName: currentSet.value?.setName ?? '', count: usages.length - 1, otherSets: otherSetNames })
    : t('vocabulary.deleteSenseMessage')
  if (await uiStore.showConfirm(t('vocabulary.deleteSenseTitle'), message)) {
    libraryStore.removeSenseFromSet(setId.value, word.value.wordKey, sense.id)
    if (!libraryStore.getWord(wordKey.value))
      await router.push({ name: 'library' })
  }
}

async function removeQuestion(question: LibraryQuestion) {
  const names = libraryStore.getQuestionSetIds(question).map(id => libraryStore.getSet(id)?.setName).filter(Boolean).join('、')
  if (await uiStore.showConfirm(t('vocabulary.deleteQuestionTitle'), t('vocabulary.deleteQuestionMessage', { sets: names })))
    libraryStore.removeQuestion(question.id)
}

function openQuestionEditor(question?: LibraryQuestion) {
  if (!word.value || !currentSenses.value.length)
    return
  if (question?.kind === 'reading') {
    void router.push({ name: 'question-editor', params: { wordKey: wordKey.value }, query: { questionId: question.id, setId: setId.value } })
    return
  }
  editingQuestion.value = question?.kind === 'multipleChoice' ? question : null
  questionDialogOpen.value = true
}

function openReadingEditor() {
  if (!word.value || !currentSenses.value.length)
    return
  void router.push({ name: 'question-editor', params: { wordKey: wordKey.value }, query: { setId: setId.value } })
}

function closeQuestionDialog() {
  questionDialogOpen.value = false
  editingQuestion.value = null
}

function editQuestion(question: LibraryQuestion) {
  openQuestionEditor(question)
}
</script>

<template>
  <section v-if="word" class="space-y-6 text-left">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <Button variant="ghost" class="mb-3 -ml-3" @click="router.back()">
          {{ $t('vocabulary.back') }}
        </Button>
        <h1 class="text-3xl font-black tracking-tight">
          {{ word.word }}
        </h1>
        <p class="mt-1 text-sm font-semibold text-ink-500">
          {{ currentSet?.setName ?? $t('vocabulary.globalView') }}
        </p>
      </div>
      <Badge variant="secondary">
        {{ word.senses.length }} {{ $t('vocabulary.senses') }}
      </Badge>
    </div>

    <div class="flex gap-2 border-b border-ink-200/70 dark:border-ink-200/15">
      <button type="button" class="border-b-2 px-3 py-3 text-sm font-bold" :class="tab === 'senses' ? 'border-accent-primary text-accent-primary' : 'border-transparent text-ink-500'" @click="tab = 'senses'">
        {{ $t('vocabulary.sensesTab') }}
      </button>
      <button type="button" class="border-b-2 px-3 py-3 text-sm font-bold" :class="tab === 'questions' ? 'border-accent-primary text-accent-primary' : 'border-transparent text-ink-500'" @click="tab = 'questions'">
        {{ $t('vocabulary.questionsTab') }}
      </button>
    </div>

    <template v-if="tab === 'senses'">
      <VocabularySensesPanel
        :current-senses="currentSenses"
        :other-senses="otherSenses"
        :other-expanded="otherExpanded"
        :other-sense-set-names="senseSetNames"
        @update:other-expanded="otherExpanded = $event"
        @edit-sense="openSenseDialog"
        @edit-example="openExampleDialog"
        @add-example="openNewExampleDialog"
        @delete-example="removeExample"
        @delete-sense="removeSense"
      />
    </template>

    <template v-else>
      <VocabularyQuestionsPanel
        :questions="questions"
        :question-type-options="questionTypeOptions"
        :difficulty-options="difficultyOptions"
        :question-type-filter="questionTypeFilter"
        :difficulty-filter="difficultyFilter"
        :has-senses="Boolean(currentSenses.length)"
        @update:question-type-filter="questionTypeFilter = $event"
        @update:difficulty-filter="difficultyFilter = $event"
        @add-question="openQuestionEditor()"
        @add-reading="openReadingEditor"
        @edit-question="editQuestion"
        @delete-question="removeQuestion"
      />
    </template>
  </section>
  <div v-else class="py-20 text-center text-sm font-semibold text-ink-400">
    {{ $t('vocabulary.notFound') }}
  </div>

  <VocabularySenseDialogs
    :sense-open="senseDialogOpen"
    :sense-pos="sensePos"
    :sense-meaning="senseMeaning"
    :example-open="exampleDialogOpen"
    :example-value="exampleValue"
    :error="senseError"
    @close-sense="senseDialogOpen = false"
    @close-example="exampleDialogOpen = false"
    @update:sense-pos="sensePos = $event"
    @update:sense-meaning="senseMeaning = $event"
    @update:example-value="exampleValue = $event"
    @save-sense="saveSense"
    @save-example="saveExample"
  />
  <QuestionEditorDialog
    :open="questionDialogOpen"
    :word-key="wordKey"
    :set-id="setId"
    :question="editingQuestion"
    @close="closeQuestionDialog"
  />
</template>

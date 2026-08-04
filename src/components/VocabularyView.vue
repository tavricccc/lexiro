<script setup lang="ts">
import type { LibraryQuestion, MultipleChoiceQuestion, VocabularyDifficultyFilter, VocabularyQuestionTypeFilter } from '@/types'
import { ArrowLeft } from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { syncAfterLocalCommit } from '@/lib/commit-sync'
import { createVocabularyDifficultyOptions, createVocabularyQuestionTypeOptions } from '@/lib/question-options'
import { useSenseManagement } from '@/lib/use-sense-management'
import { useLibraryStore } from '@/stores/library'
import { useUIStore } from '@/stores/ui'
import QuestionEditorDialog from './dialogs/QuestionEditorDialog.vue'
import SenseDeleteImpactDialog from './dialogs/SenseDeleteImpactDialog.vue'
import SenseEditorDialog from './dialogs/SenseEditorDialog.vue'
import Button from './ui/button/Button.vue'
import VocabularyQuestionsPanel from './VocabularyQuestionsPanel.vue'
import VocabularySensesPanel from './VocabularySensesPanel.vue'

type Tab = 'senses' | 'questions'

const route = useRoute()
const router = useRouter()
const libraryStore = useLibraryStore()
const uiStore = useUIStore()
const { t } = useI18n()
const tab = ref<Tab>(route.query.tab === 'questions' ? 'questions' : 'senses')
const otherExpanded = ref(false)
const questionTypeFilter = ref<VocabularyQuestionTypeFilter>('all')
const difficultyFilter = ref<VocabularyDifficultyFilter>('all')
const questionDialogOpen = ref(false)
const deletingQuestionId = ref<string | null>(null)
const editingQuestion = ref<MultipleChoiceQuestion | null>(null)

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

function hydrateRequestedSet() {
  const requestedSetId = typeof route.query.setId === 'string' ? route.query.setId : ''
  if (requestedSetId)
    void libraryStore.hydrateSet(requestedSetId).catch(() => undefined)
}

onMounted(hydrateRequestedSet)
watch(() => route.query.setId, hydrateRequestedSet)
const senseManager = useSenseManagement({
  getWordKey: () => wordKey.value,
  getSetId: () => setId.value,
  onRemoved: async () => {
    if (!libraryStore.getWord(wordKey.value))
      await router.push({ name: 'library' })
  },
})
const senseEditorOpen = senseManager.editorOpen
const senseToEdit = senseManager.editingSense
const senseEditorError = senseManager.editorError
const senseDeleteImpactOpen = senseManager.deleteImpactOpen
const senseOtherSetNames = senseManager.otherSetNames
const senseImpact = senseManager.impact
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
async function removeQuestion(question: LibraryQuestion) {
  if (deletingQuestionId.value)
    return
  const names = libraryStore.getQuestionSetIds(question).map(id => libraryStore.getSet(id)?.setName).filter(Boolean).join('、')
  if (await uiStore.showConfirm(t('vocabulary.deleteQuestionTitle'), t('vocabulary.deleteQuestionMessage', { sets: names }))) {
    deletingQuestionId.value = question.id
    try {
      if (libraryStore.removeQuestion(question.id))
        await syncAfterLocalCommit()
    }
    finally {
      deletingQuestionId.value = null
    }
  }
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

async function saveQuestion(question: MultipleChoiceQuestion): Promise<boolean> {
  if (editingQuestion.value) {
    const usages = libraryStore.getQuestionSetIds(editingQuestion.value)
    if (usages.length > 1 && !await uiStore.showConfirm(
      t('vocabulary.sharedChangeTitle'),
      t('vocabulary.sharedChangeMessage', {
        count: usages.length,
        sets: usages.map(id => libraryStore.getSet(id)?.setName).filter(Boolean).join('、'),
      }),
    )) {
      return false
    }
    return libraryStore.updateQuestion(question)
  }
  return Boolean(libraryStore.importQuestions([question]))
}

function editQuestion(question: LibraryQuestion) {
  openQuestionEditor(question)
}

watch(() => route.query.tab, (value) => {
  if (value === 'questions' || value === 'senses')
    tab.value = value
})

watch([() => route.query.action, () => route.query.questionId, () => currentSenses.value.length], ([action, questionId]) => {
  if (!currentSenses.value.length || (action !== 'add' && action !== 'edit'))
    return
  if (action === 'add') {
    openQuestionEditor()
    return
  }
  const question = libraryStore.questions.find(item => item.id === questionId)
  if (question?.kind === 'multipleChoice')
    openQuestionEditor(question)
}, { immediate: true })
</script>

<template>
  <section v-if="word" class="space-y-5 text-left">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <Button variant="ghost" class="mb-3 -ml-3 gap-2" @click="router.back()">
          <ArrowLeft class="h-4 w-4" />{{ $t('vocabulary.back') }}
        </Button>
        <h1 class="text-2xl font-black tracking-tight">
          {{ word.word }}
        </h1>
        <p class="mt-1 text-sm font-semibold text-ink-500">
          {{ currentSet?.setName ?? $t('vocabulary.globalView') }}
        </p>
      </div>
    </div>

    <div class="flex gap-2 border-b border-ink-200/70 dark:border-ink-200/15">
      <button type="button" class="min-h-11 border-b-2 px-3 py-3 text-sm font-bold" :class="tab === 'senses' ? 'border-accent-primary text-accent-primary' : 'border-transparent text-ink-500'" @click="tab = 'senses'">
        {{ $t('vocabulary.sensesTab') }}
      </button>
      <button type="button" class="min-h-11 border-b-2 px-3 py-3 text-sm font-bold" :class="tab === 'questions' ? 'border-accent-primary text-accent-primary' : 'border-transparent text-ink-500'" @click="tab = 'questions'">
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
        @edit-sense="senseManager.openEditor"
        @edit-example="(sense) => senseManager.openEditor(sense)"
        @add-example="senseManager.openEditor"
        @delete-example="(sense) => senseManager.openEditor(sense)"
        @delete-sense="senseManager.requestRemove"
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
        :deleting-question-id="deletingQuestionId"
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

  <SenseEditorDialog
    :open="senseEditorOpen"
    :sense="senseToEdit"
    :error="senseEditorError"
    :save-handler="senseManager.saveEditor"
    @close="senseManager.closeEditor"
  />
  <SenseDeleteImpactDialog
    :open="senseDeleteImpactOpen"
    :set-name="currentSet?.setName ?? ''"
    :other-set-names="senseOtherSetNames"
    :impact="senseImpact"
    @cancel="senseManager.cancelRemove"
    @confirm="senseManager.confirmRemove"
  />
  <QuestionEditorDialog
    :open="questionDialogOpen"
    :word-key="wordKey"
    :set-id="setId"
    :question="editingQuestion"
    :save-handler="saveQuestion"
    @close="closeQuestionDialog"
  />
</template>

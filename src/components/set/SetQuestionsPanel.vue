<script setup lang="ts">
import type { LibraryQuestion, QuestionCreateChoice, VocabularyDifficultyFilter, VocabularyQuestionTypeFilter } from '@/types'
import { Pencil, Plus, Search, Sparkles, Trash2 } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { syncAfterLocalCommit } from '@/lib/commit-sync'
import { createVocabularyDifficultyOptions, createVocabularyQuestionTypeOptions, questionTypeLabel } from '@/lib/question-options'
import { useLibraryStore } from '@/stores/library'
import { useUIStore } from '@/stores/ui'
import QuestionCreateDialog from '../dialogs/QuestionCreateDialog.vue'
import Badge from '../ui/badge/Badge.vue'
import Button from '../ui/button/Button.vue'
import Card from '../ui/card/Card.vue'
import Input from '../ui/input/Input.vue'
import Select from '../ui/select/Select.vue'

const props = defineProps<{
  setId: string
}>()

const router = useRouter()
const libraryStore = useLibraryStore()
const uiStore = useUIStore()
const { t } = useI18n()
const search = ref('')
const questionTypeFilter = ref<VocabularyQuestionTypeFilter>('all')
const difficultyFilter = ref<VocabularyDifficultyFilter>('all')
const createOpen = ref(false)
const deletingQuestionId = ref<string | null>(null)
const questionTypeOptions = computed(() => createVocabularyQuestionTypeOptions(t))
const difficultyOptions = computed(() => createVocabularyDifficultyOptions(t))
const questions = computed(() => libraryStore.questions.filter(question => libraryStore.getQuestionSetIds(question).includes(props.setId)))
const filteredQuestions = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  return questions.value.filter((question) => {
    const type = question.kind === 'reading' ? 'reading' : question.questionStyle
    if (questionTypeFilter.value !== 'all' && type !== questionTypeFilter.value)
      return false
    if (difficultyFilter.value !== 'all' && String(question.difficulty) !== difficultyFilter.value)
      return false
    if (!query)
      return true
    const wordText = question.kind === 'reading'
      ? question.wordKeys.map(wordKey => libraryStore.getWord(wordKey)?.word ?? wordKey).join(' ')
      : `${libraryStore.getWord(question.wordKey)?.word ?? question.wordKey} ${question.prompt}`
    return `${wordText} ${question.kind === 'reading' ? `${question.title} ${question.passage}` : ''}`.toLocaleLowerCase().includes(query)
  })
})
const firstStudyWord = computed(() => libraryStore.getSetStudyWords(props.setId)[0] ?? null)

function questionLabel(question: LibraryQuestion): string {
  return question.kind === 'reading' ? question.title : question.prompt
}

function questionWordLabel(question: LibraryQuestion): string {
  if (question.kind === 'reading')
    return question.wordKeys.map(wordKey => libraryStore.getWord(wordKey)?.word ?? wordKey).join('、')
  return libraryStore.getWord(question.wordKey)?.word ?? question.wordKey
}

function openNewQuestion() {
  if (!firstStudyWord.value)
    return
  void router.push({ name: 'vocabulary', params: { wordKey: firstStudyWord.value.wordKey }, query: { setId: props.setId, tab: 'questions', action: 'add' } })
}

function openNewReading() {
  if (!firstStudyWord.value)
    return
  void router.push({ name: 'question-editor', params: { wordKey: firstStudyWord.value.wordKey }, query: { setId: props.setId } })
}

function chooseCreateType(choice: QuestionCreateChoice) {
  createOpen.value = false
  if (choice === 'reading')
    openNewReading()
  else
    openNewQuestion()
}

function editQuestion(question: LibraryQuestion) {
  if (question.kind === 'reading') {
    void router.push({ name: 'question-editor', params: { wordKey: question.wordKeys[0] ?? '' }, query: { questionId: question.id, setId: props.setId } })
    return
  }
  void router.push({ name: 'vocabulary', params: { wordKey: question.wordKey }, query: { setId: props.setId, tab: 'questions', questionId: question.id, action: 'edit' } })
}

async function deleteQuestion(question: LibraryQuestion) {
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
</script>

<template>
  <section class="space-y-4 text-left">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 class="text-xl font-black tracking-tight">
          {{ $t('set.questionsTab') }}
        </h2>
        <p class="mt-1 text-sm font-semibold text-ink-500">
          {{ $t('set.questionsDescription') }}
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button variant="outline" class="gap-2" :disabled="!firstStudyWord" @click="createOpen = true">
          <Plus class="h-4 w-4" />{{ $t('set.addQuestion') }}
        </Button>
        <Button class="gap-2" @click="router.push({ name: 'question-generation', params: { setId } })">
          <Sparkles class="h-4 w-4" />{{ $t('set.generateQuestions') }}
        </Button>
      </div>
    </div>

    <Card class="p-4 sm:p-5">
      <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_12rem]">
        <label class="relative block">
          <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <Input v-model="search" :placeholder="$t('set.searchQuestions')" class="pl-9" :aria-label="$t('set.searchQuestions')" />
        </label>
        <Select v-model="questionTypeFilter" :options="questionTypeOptions" />
        <Select v-model="difficultyFilter" :options="difficultyOptions" />
      </div>
    </Card>

    <div v-if="filteredQuestions.length" class="space-y-3">
      <Card v-for="question in filteredQuestions" :key="question.id" class="p-4 sm:p-5">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <Badge>{{ questionTypeLabel(question, t) }}</Badge>
              <Badge variant="outline">
                {{ $t(`library.difficulty${question.difficulty}`) }}
              </Badge>
              <span class="text-xs font-semibold text-ink-400">{{ questionWordLabel(question) }}</span>
            </div>
            <p class="mt-3 line-clamp-2 text-sm font-bold leading-relaxed">
              {{ questionLabel(question) }}
            </p>
          </div>
          <div class="flex shrink-0 gap-1">
            <Button variant="ghost" size="icon" class="h-11 w-11" :aria-label="$t('vocabulary.editQuestion')" @click="editQuestion(question)">
              <Pencil class="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" class="h-11 w-11 text-red-500" :aria-label="$t('vocabulary.deleteQuestion')" :loading="deletingQuestionId === question.id" @click="deleteQuestion(question)">
              <Trash2 class="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
    <Card v-else class="p-6 text-center text-sm font-semibold text-ink-400">
      {{ $t('set.noQuestions') }}
    </Card>
    <QuestionCreateDialog :open="createOpen" @close="createOpen = false" @choose="chooseCreateType" />
  </section>
</template>

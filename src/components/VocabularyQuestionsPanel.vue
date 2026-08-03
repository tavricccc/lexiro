<script setup lang="ts">
import type { TranslatedSelectOption } from '@/lib/question-options'
import type { LibraryQuestion, VocabularyDifficultyFilter, VocabularyQuestionTypeFilter } from '@/types'
import { Pencil, Plus, Trash2 } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { questionTypeLabel } from '@/lib/question-options'
import Badge from './ui/badge/Badge.vue'
import Button from './ui/button/Button.vue'
import Card from './ui/card/Card.vue'
import Select from './ui/select/Select.vue'

const props = defineProps<{
  questions: LibraryQuestion[]
  questionTypeOptions: TranslatedSelectOption[]
  difficultyOptions: TranslatedSelectOption[]
  questionTypeFilter: VocabularyQuestionTypeFilter
  difficultyFilter: VocabularyDifficultyFilter
  hasSenses: boolean
}>()

const emit = defineEmits<{
  'update:questionTypeFilter': [value: VocabularyQuestionTypeFilter]
  'update:difficultyFilter': [value: VocabularyDifficultyFilter]
  'add-question': []
  'add-reading': []
  'edit-question': [question: LibraryQuestion]
  'delete-question': [question: LibraryQuestion]
}>()

const { t } = useI18n()
const questionTypeFilterModel = computed({
  get: () => props.questionTypeFilter,
  set: (value: string) => {
    if (value === 'all' || value === 'standard' || value === 'fillBlank' || value === 'reading')
      emit('update:questionTypeFilter', value)
  },
})
const difficultyFilterModel = computed({
  get: () => props.difficultyFilter,
  set: (value: string) => {
    if (value === 'all' || value === '1' || value === '2' || value === '3')
      emit('update:difficultyFilter', value)
  },
})

function questionLabel(question: LibraryQuestion): string {
  return question.kind === 'reading' ? question.title : question.prompt
}
</script>

<template>
  <div class="grid gap-3 sm:grid-cols-2">
    <Select v-model="questionTypeFilterModel" :options="questionTypeOptions" /><Select v-model="difficultyFilterModel" :options="difficultyOptions" />
  </div>
  <Card class="p-4 sm:p-5">
    <div class="mb-4 flex flex-wrap justify-end gap-2">
      <Button variant="outline" class="gap-2" :disabled="!hasSenses" @click="emit('add-question')">
        <Plus class="h-4 w-4" />{{ $t('vocabulary.addQuestion') }}
      </Button>
      <Button variant="outline" class="gap-2" :disabled="!hasSenses" @click="emit('add-reading')">
        <Plus class="h-4 w-4" />{{ $t('vocabulary.addReading') }}
      </Button>
    </div>
    <div v-if="questions.length" class="space-y-3">
      <article v-for="question in questions" :key="question.id" class="flex items-start justify-between gap-3 rounded-2xl border border-ink-200/60 p-4 dark:border-ink-200/15">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <Badge>{{ questionTypeLabel(question, t) }}</Badge><Badge variant="outline">
              {{ $t(`library.difficulty${question.difficulty}`) }}
            </Badge>
          </div><p class="mt-2 truncate text-sm font-bold">
            {{ questionLabel(question) }}
          </p>
        </div><div class="flex shrink-0 gap-1">
          <Button variant="ghost" size="icon" class="h-11 w-11" :aria-label="$t('vocabulary.editQuestion')" @click="emit('edit-question', question)">
            <Pencil class="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" class="h-11 w-11 text-red-500" :aria-label="$t('vocabulary.deleteQuestion')" @click="emit('delete-question', question)">
            <Trash2 class="h-4 w-4" />
          </Button>
        </div>
      </article>
    </div><p v-else class="py-8 text-center text-sm font-semibold text-ink-400">
      {{ $t('vocabulary.noQuestions') }}
    </p>
  </Card>
</template>

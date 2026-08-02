<script setup lang="ts">
import type { FullBackupPayload, SharedSet } from '@/types'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { countSharedSetSenses } from '@/lib/shared-set'
import StatusMessage from '../ui/status-message/StatusMessage.vue'

const props = defineProps<{
  sets: SharedSet[] | null
  kind?: '' | 'set-share' | 'full-backup'
  fullBackup?: FullBackupPayload | null
  fullPreview?: {
    addedSets: number
    existingSets: number
    conflictingSets: number
    addedWords: number
    existingWords: number
    conflictingWords: number
    addedQuestions: number
    existingQuestions: number
    conflictingQuestions: number
    addedLearningRecords: number
    existingLearningRecords: number
    conflictingLearningRecords: number
  } | null
}>()

const { t } = useI18n()
const wordCount = computed(() => countSharedSetSenses(props.sets ?? []))
</script>

<template>
  <StatusMessage v-if="kind === 'set-share' && sets && sets.length" tone="success" class="mt-4">
    {{ t('backup.shareImportSummary', { sets: sets.length, words: wordCount }) }}
  </StatusMessage>
  <StatusMessage v-else-if="kind === 'full-backup' && fullBackup" tone="info" class="mt-4">
    {{ t('backup.fullImportSummary', { sets: fullBackup.library.sets.length, words: Object.keys(fullBackup.library.words).length }) }}
  </StatusMessage>
  <div v-if="kind === 'full-backup' && fullPreview" class="mt-3 grid gap-2 text-xs font-semibold text-ink-500 dark:text-ink-400 sm:grid-cols-3">
    <p>{{ t('backup.fullImportAdded', { sets: fullPreview.addedSets, words: fullPreview.addedWords, questions: fullPreview.addedQuestions, learning: fullPreview.addedLearningRecords }) }}</p>
    <p>{{ t('backup.fullImportExisting', { sets: fullPreview.existingSets, words: fullPreview.existingWords, questions: fullPreview.existingQuestions, learning: fullPreview.existingLearningRecords }) }}</p>
    <p>{{ t('backup.fullImportConflicts', { sets: fullPreview.conflictingSets, words: fullPreview.conflictingWords, questions: fullPreview.conflictingQuestions, learning: fullPreview.conflictingLearningRecords }) }}</p>
  </div>
</template>

<script setup lang="ts">
import type { LibraryQuestion, WordEntry } from '@/types'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { syncAfterLocalCommit } from '@/lib/commit-sync'
import { useDirtyForm } from '@/lib/dirty-form'
import { folderIdFromSelection, UNCATEGORIZED_FOLDER_ID } from '@/lib/folders'
import { parseLibraryImport } from '@/lib/library-import'
import { useLibraryStore } from '@/stores/library'
import { useSetsStore } from '@/stores/sets'
import { useUIStore } from '@/stores/ui'
import Button from '../ui/button/Button.vue'
import Dialog from '../ui/dialog/Dialog.vue'
import DialogFooter from '../ui/dialog/DialogFooter.vue'
import StatusMessage from '../ui/status-message/StatusMessage.vue'

interface PendingWordFile {
  name: string
  words: WordEntry[]
}

interface PendingQuestionFile {
  name: string
  questions: LibraryQuestion[]
}

const { t } = useI18n()
const setsStore = useSetsStore()
const libraryStore = useLibraryStore()
const uiStore = useUIStore()
const { importOpen, importFolderId } = storeToRefs(setsStore)
const { closeImport } = setsStore

const libraryImporting = ref(false)
const draftFolderId = ref(UNCATEGORIZED_FOLDER_ID)
const pendingWordFiles = ref<PendingWordFile[]>([])
const pendingQuestionFiles = ref<PendingQuestionFile[]>([])
const preview = ref('')
const error = ref('')
const inputKey = ref(0)
const localCommitApplied = ref(false)
const hasDraft = computed(() => pendingWordFiles.value.length > 0 || pendingQuestionFiles.value.length > 0 || Boolean(error.value))

function resetDraft() {
  pendingWordFiles.value = []
  pendingQuestionFiles.value = []
  preview.value = ''
  error.value = ''
  localCommitApplied.value = false
  draftFolderId.value = importFolderId.value || UNCATEGORIZED_FOLDER_ID
  inputKey.value += 1
}

watch(importOpen, (open) => {
  if (open)
    resetDraft()
})

async function importLibraryFiles(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  if (!files.length)
    return

  libraryImporting.value = true
  localCommitApplied.value = false
  const words: PendingWordFile[] = []
  const questions: PendingQuestionFile[] = []
  const messages: string[] = []
  try {
    for (const file of files) {
      const result = parseLibraryImport(await file.text())
      if (!result.valid) {
        messages.push(t('import.fileInvalid', { name: file.name }))
        continue
      }
      if (result.data.kind === 'words') {
        words.push({ name: file.name, words: result.data.words })
        messages.push(t('import.fileWordsSummary', { name: file.name, count: result.data.words.length }))
      }
      else {
        questions.push({ name: file.name, questions: result.data.questions })
        messages.push(t('import.fileQuestionsDraftSummary', { name: file.name, count: result.data.questions.length }))
      }
    }
    pendingWordFiles.value = words
    pendingQuestionFiles.value = questions
    preview.value = messages.join(t('import.fileSummarySeparator')) || t('import.noFilesImported')
    error.value = ''
  }
  catch {
    error.value = t('import.fileImportFailed')
  }
  finally {
    libraryImporting.value = false
    input.value = ''
  }
}

async function applyImport(): Promise<boolean> {
  if (!pendingWordFiles.value.length && !pendingQuestionFiles.value.length) {
    error.value = t('import.noFilesImported')
    return false
  }
  libraryImporting.value = true
  try {
    if (!localCommitApplied.value) {
      libraryStore.runLocalTransaction(() => {
        const folderId = folderIdFromSelection(draftFolderId.value)
        for (const file of pendingWordFiles.value) {
          const set = setsStore.importLibraryWords(file.words, file.name.replace(/\.json$/i, ''), folderId)
          if (!set)
            throw new Error(t('import.fileImportFailed'))
        }
        for (const file of pendingQuestionFiles.value)
          libraryStore.importQuestions(file.questions)
      })
      localCommitApplied.value = true
    }
    const synced = await syncAfterLocalCommit()
    if (!synced)
      return false
    uiStore.showToast(t('import.libraryImported'))
    resetDraft()
    closeImport()
    return true
  }
  catch {
    error.value = t('import.fileImportFailed')
    return false
  }
  finally {
    libraryImporting.value = false
  }
}

function discard() {
  resetDraft()
  closeImport()
}

const dirtyForm = useDirtyForm({
  id: 'library-file-import',
  isDirty: () => importOpen.value && hasDraft.value,
  save: applyImport,
  discard,
})

function close() {
  void dirtyForm.requestClose()
}
</script>

<template>
  <Dialog :open="importOpen" :title="$t('import.title')" :description="$t('import.description')" @close="close">
    <div class="space-y-5">
      <div class="surface-inset space-y-2 p-4 text-left">
        <p class="text-sm font-bold text-ink-900 dark:text-ink-100">
          {{ $t('import.outputFilesTitle') }}
        </p>
        <p class="text-xs leading-relaxed text-ink-500 dark:text-ink-400">
          {{ $t('import.outputFilesHint') }}
        </p>
        <input :key="inputKey" type="file" accept="application/json,.json" multiple class="mt-2 block w-full text-xs font-semibold text-ink-500 file:mr-3 file:rounded-lg file:border-0 file:bg-accent-primary/10 file:px-3 file:py-2 file:font-bold file:text-accent-primary" :disabled="libraryImporting || localCommitApplied" @change="importLibraryFiles">
      </div>

      <StatusMessage v-if="preview" tone="success">
        {{ preview }}
      </StatusMessage>
      <StatusMessage v-if="error" tone="error">
        {{ error }}
      </StatusMessage>
      <p v-if="hasDraft && !libraryImporting" class="text-xs font-semibold text-amber-700 dark:text-amber-200">
        {{ $t('import.draftPending') }}
      </p>
    </div>
    <template #footer>
      <DialogFooter>
        <Button variant="outline" :disabled="libraryImporting" @click="close">
          {{ $t('editor.cancel') }}
        </Button>
        <Button variant="default" :loading="libraryImporting" :disabled="!pendingWordFiles.length && !pendingQuestionFiles.length" @click="applyImport">
          {{ $t('import.applyFiles') }}
        </Button>
      </DialogFooter>
    </template>
  </Dialog>
</template>

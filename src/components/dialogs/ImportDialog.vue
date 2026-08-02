<script setup lang="ts">
import type { LibraryQuestion } from '@/types'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { folderIdFromSelection } from '@/lib/folders'
import { parseLibraryImport } from '@/lib/library-import'
import { useLibraryStore } from '@/stores/library'
import { useSetsStore } from '@/stores/sets'
import { useUIStore } from '@/stores/ui'
import Button from '../ui/button/Button.vue'
import DialogFooter from '../ui/dialog-footer/DialogFooter.vue'
import Dialog from '../ui/dialog/Dialog.vue'
import StatusMessage from '../ui/status-message/StatusMessage.vue'
import FolderPicker from './FolderPicker.vue'

const { t } = useI18n()
const setsStore = useSetsStore()
const libraryStore = useLibraryStore()
const { importOpen, importError, importPreview, importFolderId } = storeToRefs(setsStore)
const { closeImport, setImportError, setImportFolderId, setImportPreview } = setsStore
const { showToast } = useUIStore()

const libraryImporting = ref(false)
const selectedFolderId = computed({
  get: () => importFolderId.value,
  set: (value: string) => setImportFolderId(value),
})

async function importLibraryFiles(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  if (!files.length)
    return

  libraryImporting.value = true
  const messages: string[] = []
  const wordFiles: Array<{ name: string, words: Parameters<typeof setsStore.importLibraryWords>[0] }> = []
  const questionFiles: Array<{ name: string, questions: LibraryQuestion[] }> = []
  try {
    for (const file of files) {
      const result = parseLibraryImport(await file.text())
      if (!result.valid) {
        messages.push(t('import.fileInvalid', { name: file.name }))
        continue
      }
      if (result.data.kind === 'words')
        wordFiles.push({ name: file.name, words: result.data.words })
      else
        questionFiles.push({ name: file.name, questions: result.data.questions })
    }

    for (const file of wordFiles) {
      const set = setsStore.importLibraryWords(file.words, file.name.replace(/\.json$/i, ''), folderIdFromSelection(importFolderId.value))
      if (set)
        messages.push(t('import.fileWordsSummary', { name: file.name, count: file.words.length }))
    }
    for (const file of questionFiles) {
      const imported = libraryStore.importQuestions(file.questions)
      messages.push(t('import.fileQuestionsSummary', { name: file.name, imported, total: file.questions.length }))
    }

    setImportPreview(messages.join(t('import.fileSummarySeparator')) || t('import.noFilesImported'))
    setImportError('')
    showToast(t('import.libraryImported'))
  }
  catch {
    setImportError(t('import.fileImportFailed'))
  }
  finally {
    libraryImporting.value = false
    input.value = ''
  }
}
</script>

<template>
  <Dialog :open="importOpen" :title="$t('import.title')" :description="$t('import.description')" @close="closeImport">
    <div class="space-y-5">
      <FolderPicker v-model="selectedFolderId" :title="$t('import.folderLabel')" />

      <div class="surface-inset space-y-2 p-4 text-left">
        <p class="text-sm font-bold text-ink-900 dark:text-ink-100">
          {{ $t('import.outputFilesTitle') }}
        </p>
        <p class="text-xs leading-relaxed text-ink-500 dark:text-ink-400">
          {{ $t('import.outputFilesHint') }}
        </p>
        <input type="file" accept="application/json,.json" multiple class="mt-2 block w-full text-xs font-semibold text-ink-500 file:mr-3 file:rounded-lg file:border-0 file:bg-accent-primary/10 file:px-3 file:py-2 file:font-bold file:text-accent-primary" :disabled="libraryImporting" @change="importLibraryFiles">
      </div>

      <StatusMessage v-if="importPreview" tone="success">
        {{ importPreview }}
      </StatusMessage>
      <StatusMessage v-if="importError" tone="error">
        {{ importError }}
      </StatusMessage>

      <DialogFooter>
        <Button variant="outline" @click="closeImport">
          {{ $t('editor.cancel') }}
        </Button>
      </DialogFooter>
    </div>
  </Dialog>
</template>

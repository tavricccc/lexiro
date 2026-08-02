<script setup lang="ts">
import type { LibraryQuestion, WordDraft } from '@/types'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { folderIdFromSelection } from '@/lib/folders'
import { parseLibraryImport } from '@/lib/library-import'
import { areWordDraftsComplete, createBlankSenseDraft, getFilledWordDrafts } from '@/lib/validation'
import { useLibraryStore } from '@/stores/library'
import { useSetsStore } from '@/stores/sets'
import { useUIStore } from '@/stores/ui'
import Button from '../ui/button/Button.vue'
import DialogFooter from '../ui/dialog-footer/DialogFooter.vue'
import Dialog from '../ui/dialog/Dialog.vue'
import Input from '../ui/input/Input.vue'
import StatusMessage from '../ui/status-message/StatusMessage.vue'
import AiWordImportPanel from './AiWordImportPanel.vue'
import FolderPicker from './FolderPicker.vue'
import ManualWordEntryForm from './ManualWordEntryForm.vue'

type InputMode = 'manual' | 'ai'

const { t } = useI18n()
const setsStore = useSetsStore()
const libraryStore = useLibraryStore()
const uiStore = useUIStore()
const { importOpen, importError, importFolderId, setEditorError } = storeToRefs(setsStore)
const { closeImport, createSetFromItems, setImportError, setImportFolderId, setImportPreview, setImportStep, setSetEditorError } = setsStore
const { showToast } = uiStore

const libraryImporting = ref(false)
const inputMode = ref<InputMode>('manual')
const manualSetName = ref('')
const manualItems = ref<WordDraft[]>([{ word: '', senses: [createBlankSenseDraft()] }])
const selectedFolderId = computed({
  get: () => importFolderId.value,
  set: (value: string) => setImportFolderId(value),
})

watch(importOpen, (open) => {
  if (!open)
    return
  inputMode.value = 'manual'
  manualSetName.value = ''
  manualItems.value = [{ word: '', senses: [createBlankSenseDraft()] }]
})

function switchInputMode(mode: InputMode) {
  inputMode.value = mode
  setsStore.clearImportFeedback()
  setImportStep(1)
  if (mode === 'manual') {
    manualSetName.value = ''
    manualItems.value = [{ word: '', senses: [createBlankSenseDraft()] }]
  }
}

function createManualSet() {
  if (!manualSetName.value.trim()) {
    setImportError(t('editor.nameRequired'))
    return
  }
  const entries = getFilledWordDrafts(manualItems.value)
  if (!entries.length) {
    setImportError(t('import.manualWordsRequired'))
    return
  }
  if (!areWordDraftsComplete(entries)) {
    setImportError(t('import.manualFieldsRequired'))
    return
  }

  setSetEditorError('')
  const created = createSetFromItems(entries, manualSetName.value.trim(), folderIdFromSelection(importFolderId.value))
  if (!created)
    setImportError(setEditorError.value || t('import.manualFailed'))
}

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
    setImportPreview(messages.join(t('import.fileSummarySeparator')))
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

      <div class="flex items-center justify-between gap-3">
        <p class="text-xs font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">
          {{ $t('import.inputMode') }}
        </p>
        <div class="inline-flex rounded-xl border border-ink-200/70 bg-ink-50 p-1 dark:border-ink-200/20 dark:bg-ink-900">
          <button type="button" class="rounded-lg px-3 py-2 text-xs font-bold transition-colors" :class="inputMode === 'manual' ? 'bg-white text-accent-primary shadow-sm dark:bg-ink-800' : 'text-ink-500'" @click="switchInputMode('manual')">
            {{ $t('import.manualMode') }}
          </button>
          <button type="button" class="rounded-lg px-3 py-2 text-xs font-bold transition-colors" :class="inputMode === 'ai' ? 'bg-white text-accent-primary shadow-sm dark:bg-ink-800' : 'text-ink-500'" @click="switchInputMode('ai')">
            {{ $t('import.aiJsonMode') }}
          </button>
        </div>
      </div>

      <div v-if="inputMode === 'manual'" class="space-y-4">
        <p class="text-xs leading-relaxed text-ink-500 dark:text-ink-400">
          {{ $t('import.manualHint') }}
        </p>
        <div class="space-y-1.5 text-left">
          <label class="text-xs font-black uppercase tracking-wider text-ink-400">{{ $t('editor.setName') }}</label>
          <Input v-model="manualSetName" :placeholder="$t('editor.setName')" />
        </div>
        <ManualWordEntryForm v-model="manualItems" />
        <StatusMessage v-if="importError" tone="error">
          {{ importError }}
        </StatusMessage>
        <details class="rounded-2xl border border-ink-200/70 bg-ink-50/60 p-4 text-left dark:border-ink-200/20 dark:bg-ink-900/50">
          <summary class="cursor-pointer text-sm font-bold text-ink-700 dark:text-ink-200">
            {{ $t('import.libraryFilesTitle') }}
          </summary>
          <p class="mt-2 text-xs leading-relaxed text-ink-500 dark:text-ink-400">
            {{ $t('import.libraryFilesHint') }}
          </p>
          <input type="file" accept="application/json,.json" multiple class="mt-3 block w-full text-xs font-semibold text-ink-500 file:mr-3 file:rounded-lg file:border-0 file:bg-accent-primary/10 file:px-3 file:py-2 file:font-bold file:text-accent-primary" :disabled="libraryImporting" @change="importLibraryFiles">
        </details>
        <DialogFooter>
          <Button variant="outline" @click="closeImport">
            {{ $t('editor.cancel') }}
          </Button>
          <Button variant="default" @click="createManualSet">
            {{ $t('import.createSet') }}
          </Button>
        </DialogFooter>
      </div>

      <AiWordImportPanel v-else />
    </div>
  </Dialog>
</template>

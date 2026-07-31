<script setup lang="ts">
import type { WordDraft } from '@/types'
import { Check, Sparkles } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { extractJsonText, generateWithAi, loadAiSettings } from '@/lib/ai-provider'
import { copyToClipboard } from '@/lib/clipboard'
import { parseImportJson } from '@/lib/import'
import { buildImportPrompt } from '@/lib/importPrompt'
import { parseLibraryImport } from '@/lib/library-import'
import { useLibraryStore } from '@/stores/library'
import { useSetsStore } from '@/stores/sets'
import { useUIStore } from '@/stores/ui'
import Button from '../ui/button/Button.vue'
import DialogFooter from '../ui/dialog-footer/DialogFooter.vue'
import Dialog from '../ui/dialog/Dialog.vue'
import SectionPanel from '../ui/section-panel/SectionPanel.vue'
import StatusMessage from '../ui/status-message/StatusMessage.vue'
import Textarea from '../ui/textarea/Textarea.vue'
import ManualWordEntryForm from './ManualWordEntryForm.vue'

type InputMode = 'manual' | 'ai'

const { t } = useI18n()
const setsStore = useSetsStore()
const libraryStore = useLibraryStore()
const uiStore = useUIStore()
const { importOpen, importStep, importWords, importJson, importError, importPreview, setEditorError } = storeToRefs(setsStore)
const { closeImport, nextImportStep, importSet, createSetFromItems } = setsStore
const { showToast } = uiStore

const importTextarea = ref<InstanceType<typeof Textarea> | null>(null)
const aiSettings = ref(loadAiSettings())
const aiGenerating = ref(false)
const libraryImporting = ref(false)
const inputMode = ref<InputMode>('manual')
const manualItems = ref<WordDraft[]>([{ word: '', pos: '', meaning: '' }])
const wordCount = computed(() => importWords.value.split(/[^\p{L}\p{N}]+/u).filter(Boolean).length)

watch(importOpen, (open) => {
  if (!open)
    return
  inputMode.value = 'manual'
  manualItems.value = [{ word: '', pos: '', meaning: '' }]
  aiSettings.value = loadAiSettings()
  nextTick(() => importTextarea.value?.focus())
})

watch(importStep, () => {
  if (importOpen.value && inputMode.value === 'ai')
    nextTick(() => importTextarea.value?.focus())
})

watch(importJson, (value) => {
  if (!value.trim()) {
    setsStore.importPreview = ''
    setsStore.importError = ''
    return
  }
  const result = parseImportJson(value.trim())
  if (result.valid) {
    setsStore.importPreview = t('import.jsonValid', { count: result.data.items.length })
    setsStore.importError = ''
  }
  else {
    setsStore.importPreview = ''
    setsStore.importError = result.error
  }
})

function switchInputMode(mode: InputMode) {
  inputMode.value = mode
  setsStore.importError = ''
  setsStore.importPreview = ''
  setsStore.importStep = 1
  if (mode === 'manual')
    manualItems.value = [{ word: '', pos: '', meaning: '' }]
}

function createManualSet() {
  const entries = manualItems.value.filter(item => item.word.trim() || item.pos.trim() || item.meaning.trim())
  if (!entries.length) {
    setsStore.importError = t('import.manualWordsRequired')
    return
  }
  if (entries.some(item => !item.word.trim() || !item.pos.trim() || !item.meaning.trim())) {
    setsStore.importError = t('import.manualFieldsRequired')
    return
  }

  setEditorError.value = ''
  const created = createSetFromItems(entries)
  if (!created)
    setsStore.importError = setEditorError.value || t('import.manualFailed')
}

async function runWordAiGeneration() {
  if (!wordCount.value) {
    setsStore.importError = t('import.wordsRequired')
    return
  }

  const settings = loadAiSettings()
  aiSettings.value = settings
  const words = importWords.value.split(/[^\p{L}\p{N}]+/u).map(word => word.trim()).filter(Boolean)
  const prompt = buildImportPrompt(words.join(', '))

  if (!settings.enabled) {
    try {
      await copyToClipboard(prompt)
      showToast(t('import.copied'))
      nextImportStep()
    }
    catch {
      showToast(t('import.copyFailed'))
    }
    return
  }
  if (!settings.apiKey.trim()) {
    setsStore.importError = t('import.aiConfigureHint')
    return
  }

  const batchSize = Math.min(Math.max(Number(settings.batchSize) || 10, 5), 20)
  const batches = Array.from({ length: Math.ceil(words.length / batchSize) }, (_, index) => words.slice(index * batchSize, (index + 1) * batchSize))
  aiGenerating.value = true
  setsStore.importError = ''
  try {
    const items = []
    for (const batch of batches) {
      const response = await generateWithAi(settings, buildImportPrompt(batch.join(', ')))
      const result = parseImportJson(extractJsonText(response))
      if (!result.valid)
        throw new Error(result.error)
      items.push(...result.data.items)
    }
    setsStore.importJson = JSON.stringify({ items }, null, 2)
    setsStore.importPreview = t('import.jsonValid', { count: items.length })
    nextImportStep()
    showToast(t('import.generated', { count: items.length }))
  }
  catch (error) {
    setsStore.importError = (error as Error).message || t('import.aiFailed')
  }
  finally {
    aiGenerating.value = false
  }
}

async function importLibraryFiles(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  if (!files.length)
    return
  libraryImporting.value = true
  const messages: string[] = []
  try {
    for (const file of files) {
      const result = parseLibraryImport(await file.text())
      if (!result.valid) {
        messages.push(`${file.name}：${result.error}`)
        continue
      }
      if (result.data.kind === 'vocab') {
        libraryStore.importWords(result.data.words)
        setsStore.importLibraryWords(result.data.words, file.name.replace(/\.json$/i, ''))
        messages.push(`${file.name}：${result.data.words.length} 個單字`)
      }
      else {
        libraryStore.importQuestions(result.data.questions)
        messages.push(`${file.name}：${result.data.questions.length} 題`)
      }
    }
    setsStore.importPreview = messages.join('；')
    setsStore.importError = ''
    showToast(t('import.libraryImported'))
  }
  catch (error) {
    setsStore.importError = (error as Error).message
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

      <ol v-if="inputMode === 'ai'" class="grid grid-cols-2 gap-2" :aria-label="$t('import.progressLabel')">
        <li v-for="step in 2" :key="step" class="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold" :class="step <= importStep ? 'border-accent-primary/20 bg-accent-primary/10 text-accent-primary' : 'border-ink-200/60 text-ink-400 dark:border-ink-200/20'">
          <span class="flex h-5 w-5 items-center justify-center rounded-full border border-current text-[10px]"><Check v-if="step < importStep" class="h-3 w-3" /><span v-else>{{ step }}</span></span>
          {{ step === 1 ? $t('import.progressWords') : $t('import.progressPaste') }}
        </li>
      </ol>

      <div v-if="inputMode === 'manual'" class="space-y-4">
        <p class="text-xs leading-relaxed text-ink-500 dark:text-ink-400">
          {{ $t('import.manualHint') }}
        </p>
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

      <div v-else-if="importStep === 1" class="space-y-5">
        <div class="flex flex-col gap-1.5 w-full text-left">
          <label class="text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">{{ $t('import.aiWordsLabel') }}</label>
          <Textarea ref="importTextarea" v-model="importWords" :rows="7" class="font-mono text-sm leading-relaxed" :placeholder="$t('import.wordPlaceholder')" />
          <p class="text-xs font-semibold text-ink-400">
            {{ $t('import.wordCount', { count: wordCount }) }}
          </p>
        </div>
        <SectionPanel class="border-accent-primary/15 bg-accent-primary/10">
          <p class="text-xs font-bold text-accent-primary">
            {{ $t('import.aiJsonMode') }}
          </p>
          <p class="mt-1.5 text-xs leading-relaxed text-ink-500 dark:text-ink-400">
            {{ aiSettings.enabled ? $t('import.apiHint') : $t('import.manualAiHint') }}
          </p>
        </SectionPanel>
        <StatusMessage v-if="importError" tone="error">
          {{ importError }}
        </StatusMessage>
        <DialogFooter>
          <Button variant="outline" @click="closeImport">
            {{ $t('editor.cancel') }}
          </Button>
          <Button variant="secondary" class="gap-2" :loading="aiGenerating" @click="runWordAiGeneration">
            <Sparkles class="h-4 w-4" />
            <span>{{ aiSettings.enabled ? (aiGenerating ? $t('import.generating') : $t('import.generateWithAi')) : $t('import.copyPrompt') }}</span>
          </Button>
        </DialogFooter>
      </div>

      <div v-else class="space-y-5">
        <div class="flex flex-col gap-1.5 w-full text-left">
          <label class="text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">{{ $t('import.importJson') }}</label>
          <Textarea ref="importTextarea" v-model="importJson" :rows="9" class="font-mono text-xs leading-relaxed" :placeholder="$t('import.jsonPlaceholder')" />
        </div>
        <StatusMessage v-if="importPreview" tone="success">
          {{ importPreview }}
        </StatusMessage>
        <StatusMessage v-if="importError" tone="error">
          {{ $t('import.jsonError') }}：{{ importError }}
        </StatusMessage>
        <DialogFooter>
          <Button variant="outline" @click="importStep = 1">
            {{ $t('import.backToWords') }}
          </Button>
          <Button variant="default" :disabled="!importPreview" @click="importSet">
            {{ $t('import.import') }}
          </Button>
        </DialogFooter>
      </div>
    </div>
  </Dialog>
</template>

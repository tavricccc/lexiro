<script setup lang="ts">
import type { WordGenerationSource } from '@/lib/word-generation'
import type { WordDraft } from '@/types'
import { Check, Sparkles } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { extractJsonText, generateWithAi, loadAiSettings } from '@/lib/ai-provider'
import { copyToClipboard } from '@/lib/clipboard'
import { folderIdFromSelection } from '@/lib/folders'
import { buildImportPrompt } from '@/lib/importPrompt'
import { areWordDraftsComplete, createBlankSenseDraft, getFilledWordDrafts } from '@/lib/validation'
import { buildWordGenerationSources, mergeWordDrafts, parseWordGenerationJson } from '@/lib/word-generation'
import { useSetsStore } from '@/stores/sets'
import { useUIStore } from '@/stores/ui'
import Button from '../ui/button/Button.vue'
import DialogFooter from '../ui/dialog-footer/DialogFooter.vue'
import Input from '../ui/input/Input.vue'
import SectionPanel from '../ui/section-panel/SectionPanel.vue'
import StatusMessage from '../ui/status-message/StatusMessage.vue'
import Textarea from '../ui/textarea/Textarea.vue'
import ManualWordEntryForm from './ManualWordEntryForm.vue'

const { t } = useI18n()
const setsStore = useSetsStore()
const { showToast } = useUIStore()
const { importOpen, importStep, importWords, importJson, importError, importPreview, importFolderId, setEditorError } = storeToRefs(setsStore)
const { closeImport, nextImportStep, createSetFromItems, setImportError, setImportJson, setImportPreview, setImportStep, setImportWords, setSetEditorError } = setsStore

const importTextarea = ref<InstanceType<typeof Textarea> | null>(null)
const aiSettings = ref(loadAiSettings())
const aiGenerating = ref(false)
const aiPreviewMode = ref(false)
const generateExamples = ref(false)
const wordGenerationSources = ref<WordGenerationSource[]>([])
const manualSetName = ref('')
const manualItems = ref<WordDraft[]>([{ word: '', senses: [createBlankSenseDraft()] }])
const importWordsModel = computed({
  get: () => importWords.value,
  set: (value: string) => setImportWords(value),
})
const importJsonModel = computed({
  get: () => importJson.value,
  set: (value: string) => setImportJson(value),
})
const wordCount = computed(() => buildWordGenerationSources(importWords.value).length)

watch(importStep, () => {
  if (importOpen.value)
    nextTick(() => importTextarea.value?.focus())
})

watch(importJson, (value) => {
  if (!value.trim()) {
    if (!aiPreviewMode.value) {
      setsStore.clearImportFeedback()
    }
    return
  }
  if (!wordGenerationSources.value.length) {
    setImportPreview('')
    setImportError(t('import.aiSourceRequired'))
    return
  }
  try {
    const generatedWords = parseWordGenerationJson(extractJsonText(value.trim()), wordGenerationSources.value, generateExamples.value)
    setImportPreview(t('import.jsonValid', { count: generatedWords.length }))
    setImportError('')
  }
  catch {
    setImportPreview('')
    setImportError(t('import.jsonError'))
  }
}, { immediate: true })

function backToAiWords() {
  aiPreviewMode.value = false
  setsStore.clearImportFeedback()
  setImportStep(1)
}

function parseAiWordResponse() {
  try {
    const generatedWords = parseWordGenerationJson(extractJsonText(importJson.value.trim()), wordGenerationSources.value, generateExamples.value)
    manualItems.value = generatedWords
    manualSetName.value = ''
    aiPreviewMode.value = true
    setImportJson('')
    setImportPreview(t('import.jsonValid', { count: generatedWords.length }))
    setImportError('')
  }
  catch {
    setImportError(t('import.jsonError'))
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

async function runWordAiGeneration() {
  const sources = buildWordGenerationSources(importWords.value)
  if (!sources.length || !wordCount.value) {
    setImportError(t('import.wordsRequired'))
    return
  }

  const settings = loadAiSettings()
  aiSettings.value = settings
  wordGenerationSources.value = sources
  const prompt = buildImportPrompt(importWords.value, sources, generateExamples.value)

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
    setImportError(t('import.aiConfigureHint'))
    return
  }

  const batchSize = Math.min(Math.max(Number(settings.batchSize) || 10, 5), 20)
  const batches = Array.from({ length: Math.ceil(sources.length / batchSize) }, (_, index) => sources.slice(index * batchSize, (index + 1) * batchSize))
  aiGenerating.value = true
  setImportError('')
  try {
    const generatedWords: WordDraft[] = []
    for (const batch of batches) {
      const response = await generateWithAi(settings, buildImportPrompt(batch.map(source => source.raw).join('\n'), batch, generateExamples.value))
      generatedWords.push(...parseWordGenerationJson(extractJsonText(response), batch, generateExamples.value))
    }
    const mergedWords = mergeWordDrafts(generatedWords)
    manualItems.value = mergedWords
    manualSetName.value = ''
    aiPreviewMode.value = true
    setImportJson('')
    setImportPreview(t('import.jsonValid', { count: mergedWords.length }))
    nextImportStep()
    showToast(t('import.generated', { count: mergedWords.length }))
  }
  catch {
    setImportError(t('import.aiFailed'))
  }
  finally {
    aiGenerating.value = false
  }
}
</script>

<template>
  <ol class="grid grid-cols-2 gap-2" :aria-label="$t('import.progressLabel')">
    <li v-for="step in 2" :key="step" class="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold" :class="step <= importStep ? 'border-accent-primary/20 bg-accent-primary/10 text-accent-primary' : 'border-ink-200/60 text-ink-400 dark:border-ink-200/20'">
      <span class="flex h-5 w-5 items-center justify-center rounded-full border border-current text-[10px]"><Check v-if="step < importStep" class="h-3 w-3" /><span v-else>{{ step }}</span></span>
      {{ step === 1 ? $t('import.progressWords') : $t('import.progressPaste') }}
    </li>
  </ol>

  <div v-if="importStep === 1" class="space-y-5">
    <div class="flex flex-col gap-1.5 w-full text-left">
      <label class="text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">{{ $t('import.aiWordsLabel') }}</label>
      <Textarea ref="importTextarea" v-model="importWordsModel" :rows="7" class="font-mono text-sm leading-relaxed" :placeholder="$t('import.wordPlaceholder')" />
      <p class="text-xs font-semibold text-ink-400">
        {{ $t('import.wordCount', { count: wordCount }) }}
      </p>
      <label class="flex items-center gap-2 text-xs font-semibold text-ink-500 dark:text-ink-400">
        <input v-model="generateExamples" type="checkbox" class="h-4 w-4 rounded border-ink-300 text-accent-primary">
        {{ $t('import.generateExamples') }}
      </label>
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

  <div v-else-if="aiPreviewMode" class="space-y-4">
    <div>
      <h3 class="text-base font-black text-ink-900 dark:text-white">
        {{ $t('import.aiPreviewTitle') }}
      </h3>
      <p class="mt-1 text-xs leading-relaxed text-ink-500 dark:text-ink-400">
        {{ $t('import.aiPreviewHint') }}
      </p>
    </div>
    <ManualWordEntryForm v-model="manualItems" />
    <StatusMessage v-if="importPreview" tone="success">
      {{ importPreview }}
    </StatusMessage>
    <StatusMessage v-if="importError" tone="error">
      {{ importError }}
    </StatusMessage>
    <DialogFooter>
      <Button variant="outline" @click="backToAiWords">
        {{ $t('import.backToWords') }}
      </Button>
      <div class="space-y-1.5 text-left">
        <label class="text-xs font-black uppercase tracking-wider text-ink-400">{{ $t('editor.setName') }}</label>
        <Input v-model="manualSetName" :placeholder="$t('editor.setName')" />
      </div>
      <Button variant="default" :disabled="!manualSetName.trim()" @click="createManualSet">
        {{ $t('import.createSet') }}
      </Button>
    </DialogFooter>
  </div>

  <div v-else class="space-y-5">
    <div class="flex flex-col gap-1.5 w-full text-left">
      <label class="text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">{{ $t('import.importJson') }}</label>
      <Textarea ref="importTextarea" v-model="importJsonModel" :rows="9" class="font-mono text-xs leading-relaxed" :placeholder="$t('import.jsonPlaceholder')" />
    </div>
    <StatusMessage v-if="importPreview" tone="success">
      {{ importPreview }}
    </StatusMessage>
    <StatusMessage v-if="importError" tone="error">
      {{ $t('import.jsonError') }}：{{ importError }}
    </StatusMessage>
    <DialogFooter>
      <Button variant="outline" @click="setImportStep(1)">
        {{ $t('import.backToWords') }}
      </Button>
      <Button v-if="wordGenerationSources.length" variant="secondary" @click="parseAiWordResponse">
        {{ $t('import.parseAiResponse') }}
      </Button>
    </DialogFooter>
  </div>
</template>

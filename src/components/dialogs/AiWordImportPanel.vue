<script setup lang="ts">
import type { WordGenerationSource } from '@/lib/word-generation'
import type { WordDraft } from '@/types'
import { Check, ChevronLeft, Sparkles } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { extractJsonText, generateWithAi, loadAiSettings } from '@/lib/ai-provider'
import { copyToClipboard } from '@/lib/clipboard'
import { buildImportPrompt } from '@/lib/importPrompt'
import { areWordDraftsComplete, getFilledWordDrafts } from '@/lib/validation'
import { buildWordGenerationSources, mergeWordDrafts, parseWordGenerationJson } from '@/lib/word-generation'
import { useUIStore } from '@/stores/ui'
import Button from '../ui/button/Button.vue'
import SectionPanel from '../ui/section-panel/SectionPanel.vue'
import StatusMessage from '../ui/status-message/StatusMessage.vue'
import Textarea from '../ui/textarea/Textarea.vue'
import ManualWordEntryForm from './ManualWordEntryForm.vue'

type AiImportStep = 'words' | 'response' | 'preview'

const emit = defineEmits<{
  apply: [items: WordDraft[]]
}>()

const { t } = useI18n()
const { showToast } = useUIStore()
const step = ref<AiImportStep>('words')
const wordsInput = ref('')
const responseInput = ref('')
const wordGenerationSources = ref<WordGenerationSource[]>([])
const previewItems = ref<WordDraft[]>([])
const generateExamples = ref(false)
const aiSettings = ref(loadAiSettings())
const aiGenerating = ref(false)
const error = ref('')

const wordCount = computed(() => buildWordGenerationSources(wordsInput.value).length)
const usesApi = computed(() => aiSettings.value.enabled)

function prepareSources(): WordGenerationSource[] | null {
  const sources = buildWordGenerationSources(wordsInput.value)
  if (!sources.length) {
    error.value = t('import.wordsRequired')
    return null
  }
  wordGenerationSources.value = sources
  error.value = ''
  return sources
}

function parseResponse() {
  const sources = wordGenerationSources.value
  if (!sources.length) {
    error.value = t('import.aiSourceRequired')
    return
  }
  if (!responseInput.value.trim()) {
    error.value = t('import.responseRequired')
    return
  }
  try {
    previewItems.value = parseWordGenerationJson(extractJsonText(responseInput.value.trim()), sources, generateExamples.value)
    step.value = 'preview'
    error.value = ''
  }
  catch {
    error.value = t('import.jsonError')
  }
}

function backToWords() {
  step.value = 'words'
  error.value = ''
}

function applyPreview() {
  const items = getFilledWordDrafts(previewItems.value)
  if (!items.length) {
    error.value = t('import.manualWordsRequired')
    return
  }
  if (!areWordDraftsComplete(items)) {
    error.value = t('import.manualFieldsRequired')
    return
  }
  emit('apply', items.map(item => ({
    word: item.word,
    senses: item.senses.map(sense => ({ ...sense, examples: [...sense.examples] })),
  })))
}

async function runAiAction() {
  const sources = prepareSources()
  if (!sources)
    return

  const settings = loadAiSettings()
  aiSettings.value = settings
  const prompt = buildImportPrompt(wordsInput.value, sources, generateExamples.value)

  if (!settings.enabled) {
    try {
      await copyToClipboard(prompt)
      step.value = 'response'
      responseInput.value = ''
      showToast(t('import.copied'))
    }
    catch {
      error.value = t('import.copyFailed')
    }
    return
  }
  if (!settings.apiKey.trim()) {
    error.value = t('import.aiConfigureHint')
    return
  }

  const batchSize = Math.min(Math.max(Number(settings.batchSize) || 10, 5), 20)
  const batches = Array.from({ length: Math.ceil(sources.length / batchSize) }, (_, index) => sources.slice(index * batchSize, (index + 1) * batchSize))
  aiGenerating.value = true
  error.value = ''
  try {
    const generatedWords: WordDraft[] = []
    for (const batch of batches) {
      const response = await generateWithAi(settings, buildImportPrompt(batch.map(source => source.raw).join('\n'), batch, generateExamples.value))
      generatedWords.push(...parseWordGenerationJson(extractJsonText(response), batch, generateExamples.value))
    }
    previewItems.value = mergeWordDrafts(generatedWords)
    step.value = 'preview'
    showToast(t('import.generated', { count: previewItems.value.length }))
  }
  catch {
    error.value = t('import.aiFailed')
  }
  finally {
    aiGenerating.value = false
  }
}
</script>

<template>
  <section class="space-y-5 text-left">
    <ol class="grid grid-cols-3 gap-2" :aria-label="$t('import.progressLabel')">
      <li v-for="(label, index) in [$t('import.progressWords'), $t('import.progressPaste'), $t('import.aiPreviewTitle')]" :key="label" class="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold" :class="index <= (step === 'words' ? 0 : step === 'response' ? 1 : 2) ? 'border-accent-primary/20 bg-accent-primary/10 text-accent-primary' : 'border-ink-200/60 text-ink-400 dark:border-ink-200/20'">
        <span class="flex h-5 w-5 items-center justify-center rounded-full border border-current text-[10px]"><Check v-if="index < (step === 'words' ? 0 : step === 'response' ? 1 : 2)" class="h-3 w-3" /><span v-else>{{ index + 1 }}</span></span>
        <span class="truncate">{{ label }}</span>
      </li>
    </ol>

    <div v-if="step === 'words'" class="space-y-5">
      <div class="space-y-1.5">
        <label class="text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">{{ $t('import.aiWordsLabel') }}</label>
        <Textarea v-model="wordsInput" :rows="7" class="font-mono text-sm leading-relaxed" :placeholder="$t('import.wordPlaceholder')" />
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
          {{ usesApi ? $t('import.apiHint') : $t('import.manualAiHint') }}
        </p>
      </SectionPanel>
      <StatusMessage v-if="error" tone="error">
        {{ error }}
      </StatusMessage>
      <div class="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" class="gap-2" :loading="aiGenerating" @click="runAiAction">
          <Sparkles class="h-4 w-4" />
          <span>{{ usesApi ? (aiGenerating ? $t('import.generating') : $t('import.generateWithAi')) : $t('import.copyPrompt') }}</span>
        </Button>
      </div>
    </div>

    <div v-else-if="step === 'response'" class="space-y-4">
      <StatusMessage tone="info">
        {{ $t('import.promptResponseHint') }}
      </StatusMessage>
      <Textarea v-model="responseInput" :rows="10" class="font-mono text-xs leading-relaxed" :placeholder="$t('import.jsonPlaceholder')" />
      <StatusMessage v-if="error" tone="error">
        {{ error }}
      </StatusMessage>
      <div class="flex flex-wrap justify-between gap-2">
        <Button variant="outline" class="gap-2" @click="backToWords">
          <ChevronLeft class="h-4 w-4" />{{ $t('import.backToWords') }}
        </Button>
        <Button variant="secondary" @click="parseResponse">
          {{ $t('import.parseAiResponse') }}
        </Button>
      </div>
    </div>

    <div v-else class="space-y-4">
      <div>
        <h3 class="text-base font-black text-ink-900 dark:text-white">
          {{ $t('import.aiPreviewTitle') }}
        </h3>
        <p class="mt-1 text-xs leading-relaxed text-ink-500 dark:text-ink-400">
          {{ $t('import.aiPreviewHint') }}
        </p>
      </div>
      <ManualWordEntryForm v-model="previewItems" />
      <StatusMessage v-if="error" tone="error">
        {{ error }}
      </StatusMessage>
      <div class="flex flex-wrap justify-between gap-2">
        <Button variant="outline" class="gap-2" @click="backToWords">
          <ChevronLeft class="h-4 w-4" />{{ $t('import.backToWords') }}
        </Button>
        <Button variant="default" @click="applyPreview">
          {{ $t('import.applyToEditor') }}
        </Button>
      </div>
    </div>
  </section>
</template>

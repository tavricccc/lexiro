<script setup lang="ts">
import type { GeneratedQuestionKind } from '@/lib/question-generation'
import type { LibraryQuestion, WordEntry } from '@/types'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { extractJsonText, generateWithAi, loadAiSettings } from '@/lib/ai-provider'
import { parseLibraryImport } from '@/lib/library-import'
import { buildQuestionGenerationPrompt } from '@/lib/question-generation'
import { useLibraryStore } from '@/stores/library'
import { useUIStore } from '@/stores/ui'
import Button from './ui/button/Button.vue'
import Input from './ui/input/Input.vue'
import StatusMessage from './ui/status-message/StatusMessage.vue'

const libraryStore = useLibraryStore()
const uiStore = useUIStore()
const { t } = useI18n()
const query = ref('')
const selectedKeys = ref<string[]>([])
const kind = ref<GeneratedQuestionKind>('multipleChoice')
const preview = ref<LibraryQuestion[]>([])
const error = ref('')
const generating = ref(false)

const matches = computed(() => {
  const normalized = query.value.trim().toLocaleLowerCase()
  return libraryStore.words
    .filter(word => !normalized || word.word.toLocaleLowerCase().includes(normalized) || word.senses.some(sense => sense.meaningZh.includes(normalized)))
    .slice(0, 30)
})

const selectedWords = computed(() => selectedKeys.value.map(key => libraryStore.getWord(key)).filter((word): word is WordEntry => Boolean(word)))

function toggleWord(wordKey: string) {
  selectedKeys.value = selectedKeys.value.includes(wordKey)
    ? selectedKeys.value.filter(key => key !== wordKey)
    : [...selectedKeys.value, wordKey]
}

async function generate() {
  if (!selectedWords.value.length) {
    error.value = t('library.selectWordsError')
    return
  }
  const settings = loadAiSettings()
  if (!settings.enabled || !settings.apiKey.trim()) {
    error.value = t('library.aiConfigError')
    return
  }
  generating.value = true
  error.value = ''
  try {
    const batches = kind.value === 'reading'
      ? [selectedWords.value.slice(0, 15)]
      : Array.from({ length: Math.ceil(selectedWords.value.length / 15) }, (_, index) => selectedWords.value.slice(index * 15, (index + 1) * 15))
    const generated: LibraryQuestion[] = []
    for (const batch of batches) {
      const response = await generateWithAi(settings, buildQuestionGenerationPrompt(batch, kind.value))
      const parsed = parseLibraryImport(extractJsonText(response))
      if (!parsed.valid || parsed.data.kind !== 'questions')
        throw new Error(parsed.valid ? t('library.aiResponseError') : parsed.error)
      generated.push(...parsed.data.questions)
    }
    preview.value = generated
  }
  catch (generationError) {
    error.value = (generationError as Error).message
  }
  finally {
    generating.value = false
  }
}

function importPreview() {
  if (!preview.value.length)
    return
  libraryStore.importQuestions(preview.value)
  uiStore.showToast(t('library.questionsImported', { count: preview.value.length }))
  preview.value = []
}
</script>

<template>
  <details class="rounded-2xl border border-ink-200/70 bg-white/80 p-4 text-left shadow-sm dark:border-ink-200/20 dark:bg-ink-900/70">
    <summary class="cursor-pointer text-sm font-bold text-ink-800 dark:text-ink-100">
      {{ $t('library.generateQuestions') }}
    </summary>
    <div class="mt-4 space-y-4">
      <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-center">
        <Input v-model="query" :placeholder="$t('library.searchWordsToGenerate')" class="rounded-xl" />
        <select v-model="kind" class="h-10 rounded-xl border border-ink-200/80 bg-white px-3 text-sm font-semibold dark:border-ink-200/25 dark:bg-ink-900">
          <option value="multipleChoice">
            {{ $t('library.questionTypeChoice') }}
          </option>
          <option value="cloze">
            {{ $t('library.questionTypeCloze') }}
          </option>
          <option value="reading">
            {{ $t('library.questionTypeReading') }}
          </option>
        </select>
        <Button variant="default" :loading="generating" :disabled="!selectedWords.length" @click="generate">
          {{ $t('library.generateSelected') }}（{{ selectedWords.length }}）
        </Button>
      </div>
      <div class="grid max-h-48 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
        <label v-for="word in matches" :key="word.wordKey" class="flex cursor-pointer items-center gap-2 rounded-xl border border-ink-200/60 px-3 py-2 text-sm font-semibold hover:bg-ink-50 dark:border-ink-200/20 dark:hover:bg-ink-800">
          <input type="checkbox" :checked="selectedKeys.includes(word.wordKey)" @change="toggleWord(word.wordKey)">
          <span class="truncate">{{ word.word }}</span>
          <span class="ml-auto text-xs text-ink-400">{{ word.senses.length }}義</span>
        </label>
      </div>
      <StatusMessage v-if="error" tone="error">
        {{ error }}
      </StatusMessage>
      <div v-if="preview.length" class="rounded-xl bg-ink-50 p-3 dark:bg-ink-950/30">
        <p class="text-sm font-bold">
          {{ $t('library.generationPreview', { count: preview.length }) }}
        </p>
        <ul class="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs text-ink-600 dark:text-ink-300">
          <li v-for="question in preview" :key="question.id">
            {{ question.wordKey || (question.kind === 'reading' ? question.title : '') }} · {{ question.kind }}
          </li>
        </ul>
        <Button class="mt-3" size="sm" variant="outline" @click="importPreview">
          {{ $t('library.importGenerated') }}
        </Button>
      </div>
    </div>
  </details>
</template>

<script setup lang="ts">
import type { GeneratedQuestionDifficulty, GeneratedQuestionKind } from '@/lib/question-generation'
import type { LibraryQuestion } from '@/types'
import { ArrowLeft, Sparkles } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { extractJsonText, generateWithAi, loadAiSettings } from '@/lib/ai-provider'
import { copyToClipboard } from '@/lib/clipboard'
import { parseLibraryImport } from '@/lib/library-import'
import { buildQuestionGenerationPrompt, filterQuestionsForWords, getGenerationWords, getQuestionSourceRefs, getSelectedGenerationWords, QUESTION_BATCH_SIZE, splitGenerationBatches } from '@/lib/question-generation'
import { useLibraryStore } from '@/stores/library'
import { useSetsStore } from '@/stores/sets'
import { useUIStore } from '@/stores/ui'
import QuestionGenerationPreview from './QuestionGenerationPreview.vue'
import QuestionWordSelector from './QuestionWordSelector.vue'
import Button from './ui/button/Button.vue'
import Card from './ui/card/Card.vue'
import DialogFooter from './ui/dialog/DialogFooter.vue'
import StatusMessage from './ui/status-message/StatusMessage.vue'
import Textarea from './ui/textarea/Textarea.vue'

const route = useRoute()
const router = useRouter()
const libraryStore = useLibraryStore()
const setsStore = useSetsStore()
const uiStore = useUIStore()
const { t } = useI18n()
const setId = computed(() => typeof route.params.setId === 'string' ? route.params.setId : '')
const set = computed(() => setsStore.sets.find(item => item.id === setId.value) ?? null)
const availableWords = computed(() => libraryStore.getSetWords(setId.value))
const query = ref('')
const selectedKeys = ref<string[]>([])
const kind = ref<GeneratedQuestionKind>('fillBlank')
const difficulty = ref<GeneratedQuestionDifficulty>(2)
const generationStep = ref<1 | 2>(1)
const preview = ref<LibraryQuestion[]>([])
const error = ref('')
const generating = ref(false)
const manualResponse = ref('')
const waitingForManualResponse = ref(false)
const aiSettings = ref(loadAiSettings())

const selectedWords = computed(() => getSelectedGenerationWords(availableWords.value, selectedKeys.value))
const selectedSenseCount = computed(() => selectedWords.value.reduce((count, word) => count + word.senses.length, 0))
const selectedWordNames = computed(() => selectedWords.value.map(word => `${word.word}（${word.senses.map(sense => `${sense.pos}｜${sense.meaningZh}`).join('、')}）`).join('、'))
const selectionLimit = computed(() => kind.value === 'reading' ? QUESTION_BATCH_SIZE : null)
const usesApi = computed(() => aiSettings.value.enabled)
const apiReady = computed(() => !usesApi.value || Boolean(aiSettings.value.apiKey.trim()))

function questionOptions() {
  return {
    questionSources: getQuestionSourceRefs(getGenerationWords(selectedWords.value, kind.value)),
    allowedDifficulty: difficulty.value,
    expectedQuestionKind: kind.value === 'reading' ? 'reading' as const : 'multipleChoice' as const,
    expectedQuestionStyle: kind.value === 'reading' ? undefined : kind.value === 'fillBlank' ? 'fillBlank' as const : 'standard' as const,
    requireEnglish: true,
  }
}

function validateSelection() {
  if (!selectedWords.value.length) {
    error.value = t('library.selectWordsError')
    return false
  }
  return true
}

async function generate() {
  if (!validateSelection())
    return
  const settings = loadAiSettings()
  aiSettings.value = settings
  if (!settings.enabled || !settings.apiKey.trim()) {
    error.value = t('library.aiConfigError')
    return
  }
  generating.value = true
  error.value = ''
  try {
    const generated: LibraryQuestion[] = []
    for (const batch of splitGenerationBatches(selectedWords.value, kind.value)) {
      const response = await generateWithAi(settings, buildQuestionGenerationPrompt(batch, kind.value, difficulty.value))
      const parsed = parseLibraryImport(extractJsonText(response), { ...questionOptions(), questionSources: getQuestionSourceRefs(batch) })
      if (!parsed.valid || parsed.data.kind !== 'questions')
        throw new Error(t('library.aiResponseError'))
      generated.push(...filterQuestionsForWords(parsed.data.questions, batch))
    }
    if (!generated.length)
      throw new Error(t('library.aiResponseError'))
    preview.value = generated
    waitingForManualResponse.value = false
  }
  catch {
    error.value = t('library.aiFailed')
  }
  finally {
    generating.value = false
  }
}

async function copyPrompt() {
  if (!validateSelection())
    return
  try {
    await copyToClipboard(buildQuestionGenerationPrompt(getGenerationWords(selectedWords.value, kind.value), kind.value, difficulty.value))
    manualResponse.value = ''
    waitingForManualResponse.value = true
    uiStore.showToast(t('library.promptCopied'))
  }
  catch {
    error.value = t('library.copyFailed')
  }
}

async function runAiAction() {
  aiSettings.value = loadAiSettings()
  if (aiSettings.value.enabled)
    await generate()
  else
    await copyPrompt()
}

function nextGenerationStep() {
  generationStep.value = 2
}

function previousGenerationStep() {
  generationStep.value = 1
}

function parseManualResponse() {
  if (!manualResponse.value.trim()) {
    error.value = t('library.responseRequired')
    return
  }
  if (!validateSelection())
    return
  const selected = getGenerationWords(selectedWords.value, kind.value)
  const parsed = parseLibraryImport(extractJsonText(manualResponse.value), { ...questionOptions(), questionSources: getQuestionSourceRefs(selected) })
  if (!parsed.valid || parsed.data.kind !== 'questions') {
    error.value = t('library.aiResponseError')
    return
  }
  const questions = filterQuestionsForWords(parsed.data.questions, selected)
  if (!questions.length) {
    error.value = t('library.aiResponseError')
    return
  }
  preview.value = questions
  waitingForManualResponse.value = false
  error.value = ''
}

function importPreview(questions: LibraryQuestion[] = preview.value) {
  if (!questions.length)
    return
  const imported = libraryStore.importQuestions(questions)
  if (!imported) {
    error.value = t('library.aiResponseError')
    return
  }
  uiStore.showToast(t('library.questionsImported', { count: imported }))
  void router.back()
}
</script>

<template>
  <section v-if="set" class="space-y-6 text-left">
    <div>
      <Button variant="ghost" class="mb-3 -ml-3 gap-2" @click="router.back()">
        <ArrowLeft class="h-4 w-4" />{{ $t('vocabulary.back') }}
      </Button>
      <h1 class="text-3xl font-black tracking-tight">
        {{ $t('library.generateQuestions') }}
      </h1>
      <p class="mt-1 text-sm font-semibold text-ink-500">
        {{ set.setName }} · {{ $t('library.questionGenerationDescription') }}
      </p>
    </div>

    <Card class="p-5 sm:p-6">
      <QuestionWordSelector
        v-model:kind="kind"
        v-model:difficulty="difficulty"
        v-model:query="query"
        v-model:selected-keys="selectedKeys"
        :step="generationStep"
        :words="availableWords"
        :selection-limit="selectionLimit"
        @next="nextGenerationStep"
        @back="previousGenerationStep"
      />
    </Card>

    <Card v-if="generationStep === 2" class="space-y-5 p-5 sm:p-6">
      <div class="rounded-2xl bg-accent-primary/10 p-4">
        <p class="text-sm font-bold text-accent-primary">
          {{ $t('library.selectedSensesCount', { count: selectedSenseCount }) }}
        </p>
        <p class="mt-1 text-xs text-ink-500 dark:text-ink-400">
          {{ selectedWordNames || $t('library.selectWordsError') }}
        </p>
      </div>
      <StatusMessage v-if="error" tone="error">
        {{ error }}
      </StatusMessage>

      <div v-if="!waitingForManualResponse && !preview.length" class="flex flex-wrap items-center gap-2">
        <Button :disabled="!apiReady" :loading="generating" @click="runAiAction">
          <Sparkles class="mr-1 h-4 w-4" />{{ usesApi ? $t('library.generateSelected') : $t('library.copyPrompt') }}
        </Button>
      </div>
      <p v-if="usesApi && !apiReady" class="text-xs text-ink-500 dark:text-ink-400">
        {{ $t('library.apiGenerationUnavailable') }}
      </p>

      <div v-if="waitingForManualResponse" class="space-y-3">
        <StatusMessage tone="info">
          {{ $t('library.promptCopiedHint') }}
        </StatusMessage>
        <Textarea v-model="manualResponse" :rows="9" class="font-mono text-xs" :placeholder="$t('library.responsePlaceholder')" />
        <Button variant="outline" @click="parseManualResponse">
          {{ $t('library.parseResponse') }}
        </Button>
      </div>

      <QuestionGenerationPreview :questions="preview" @import="importPreview" />
      <DialogFooter>
        <Button variant="outline" @click="router.back()">
          {{ $t('editor.cancel') }}
        </Button>
      </DialogFooter>
    </Card>
  </section>
  <div v-else class="py-20 text-center text-sm font-semibold text-ink-400">
    {{ $t('editor.notFound') }}
  </div>
</template>

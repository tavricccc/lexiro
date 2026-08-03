<script setup lang="ts">
import type { LibraryImportResult } from '@/lib/library-import'
import type { GeneratedQuestionDifficulty, GeneratedQuestionKind } from '@/lib/question-generation'
import type { LibraryQuestion, WordEntry } from '@/types'
import { ArrowLeft, Sparkles } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { extractJsonText, generateWithAi, loadAiSettings } from '@/lib/ai-provider'
import { copyToClipboard } from '@/lib/clipboard'
import { syncAfterLocalCommit } from '@/lib/commit-sync'
import { useDirtyForm } from '@/lib/dirty-form'
import { parseLibraryImport } from '@/lib/library-import'
import { buildQuestionGenerationPrompt, filterQuestionsForWords, generatedQuestionCoverageIssue, getGenerationWords, getQuestionSourceRefs, getSelectedGenerationWords, normalizeQuestionGenerationJson, QUESTION_BATCH_SIZE, splitGenerationBatches } from '@/lib/question-generation'
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
const initialDraftSnapshot = ref('')
const pendingLocalCommit = ref(false)
const pendingImportedCount = ref(0)

onMounted(() => {
  if (setId.value)
    void libraryStore.hydrateSet(setId.value).catch(() => undefined)
})

const selectedWords = computed(() => getSelectedGenerationWords(availableWords.value, selectedKeys.value))
const selectedSenseCount = computed(() => selectedWords.value.reduce((count, word) => count + word.senses.length, 0))
const selectedWordNames = computed(() => selectedWords.value.map(word => `${word.word}（${word.senses.map(sense => `${sense.pos}｜${sense.meaningZh}`).join('、')}）`).join('、'))
const selectionLimit = computed(() => kind.value === 'reading' ? QUESTION_BATCH_SIZE : null)
const usesApi = computed(() => aiSettings.value.enabled)
const apiReady = computed(() => !usesApi.value || Boolean(aiSettings.value.apiKey.trim()))

function draftSnapshot(): string {
  return JSON.stringify({ query: query.value, selectedKeys: selectedKeys.value, kind: kind.value, difficulty: difficulty.value, generationStep: generationStep.value, preview: preview.value, manualResponse: manualResponse.value, waitingForManualResponse: waitingForManualResponse.value })
}

initialDraftSnapshot.value = draftSnapshot()
const draftDirty = computed(() => pendingLocalCommit.value || initialDraftSnapshot.value !== draftSnapshot())

function questionOptions(words: WordEntry[]) {
  return {
    questionSources: getQuestionSourceRefs(words),
    allowedDifficulty: difficulty.value,
    expectedQuestionKind: kind.value === 'reading' ? 'reading' as const : 'multipleChoice' as const,
    expectedQuestionStyle: kind.value === 'reading' ? undefined : kind.value === 'fillBlank' ? 'fillBlank' as const : 'standard' as const,
    requireEnglish: true,
  }
}

function parseGeneratedQuestions(response: string, words: WordEntry[]): LibraryImportResult {
  try {
    const parsed = parseLibraryImport(
      normalizeQuestionGenerationJson(extractJsonText(response), kind.value, difficulty.value, words),
      questionOptions(words),
    )
    if (parsed.valid && parsed.data.kind === 'questions') {
      const coverageIssue = generatedQuestionCoverageIssue(parsed.data.questions, words, kind.value)
      if (coverageIssue)
        return { valid: false, error: coverageIssue }
    }
    return parsed
  }
  catch (cause) {
    return { valid: false, error: cause instanceof Error ? cause.message : 'AI 題目回覆格式錯誤' }
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
      const parsed = parseGeneratedQuestions(response, batch)
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
  const parsed = parseGeneratedQuestions(manualResponse.value, selected)
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

async function importPreview(questions: LibraryQuestion[] = preview.value): Promise<boolean> {
  if (pendingLocalCommit.value) {
    const synced = await syncAfterLocalCommit()
    if (!synced)
      return false
    pendingLocalCommit.value = false
    initialDraftSnapshot.value = draftSnapshot()
    uiStore.showToast(t('library.questionsImported', { count: pendingImportedCount.value }))
    void router.back()
    return true
  }
  if (!questions.length)
    return false
  const imported = libraryStore.importQuestions(questions)
  if (!imported) {
    error.value = t('library.aiResponseError')
    return false
  }
  pendingLocalCommit.value = true
  pendingImportedCount.value = imported
  const synced = await syncAfterLocalCommit()
  if (!synced)
    return false
  pendingLocalCommit.value = false
  initialDraftSnapshot.value = draftSnapshot()
  uiStore.showToast(t('library.questionsImported', { count: imported }))
  void router.back()
  return true
}

const dirtyForm = useDirtyForm({
  id: 'question-generation',
  isDirty: () => draftDirty.value,
  save: () => importPreview(),
  discard: () => { void router.back() },
})

function goBack() {
  void dirtyForm.requestClose()
}
</script>

<template>
  <section v-if="set" class="space-y-5 text-left">
    <div>
      <Button variant="ghost" class="mb-3 -ml-3 gap-2" @click="goBack">
        <ArrowLeft class="h-4 w-4" />{{ $t('vocabulary.back') }}
      </Button>
      <h1 class="text-2xl font-black tracking-tight">
        {{ $t('library.generateQuestions') }}
      </h1>
      <p class="mt-1 text-sm font-semibold text-ink-500">
        {{ set.setName }} · {{ $t('library.questionGenerationDescription') }}
      </p>
    </div>

    <fieldset :disabled="pendingLocalCommit" class="contents">
      <Card class="p-4 sm:p-5">
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
    </fieldset>

    <Card v-if="generationStep === 2" class="space-y-4 p-4 sm:p-5">
      <fieldset :disabled="pendingLocalCommit" class="contents">
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
      </fieldset>

      <QuestionGenerationPreview :questions="preview" :locked="pendingLocalCommit" @import="importPreview" />
      <DialogFooter>
        <Button variant="outline" @click="goBack">
          {{ $t('editor.cancel') }}
        </Button>
      </DialogFooter>
    </Card>
  </section>
  <div v-else class="py-20 text-center text-sm font-semibold text-ink-400">
    {{ $t('editor.notFound') }}
  </div>
</template>

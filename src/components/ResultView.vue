<script setup lang="ts">
import type { ResultRow } from '@/types'
import { BookmarkCheck, BookOpenText, ClipboardCopy, RotateCcw } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { generateWithAi, loadAiSettings } from '@/lib/ai-provider'
import { copyToClipboard } from '@/lib/clipboard'
import { buildAllWrongQuestionsPrompt, buildQuestionExplainPrompt } from '@/lib/resultPrompts'
import { useSessionStore } from '@/stores/session'
import { useSetsStore } from '@/stores/sets'
import { useUIStore } from '@/stores/ui'
import Badge from './ui/badge/Badge.vue'
import Button from './ui/button/Button.vue'
import Card from './ui/card/Card.vue'
import ScoreRing from './ui/score-ring/ScoreRing.vue'
import StatusMessage from './ui/status-message/StatusMessage.vue'

const setsStore = useSetsStore()
const sessionStore = useSessionStore()
const uiStore = useUIStore()
const { activeSet } = storeToRefs(setsStore)
const { resultSummary, resultRows, currentSession } = storeToRefs(sessionStore)
const {
  restartCurrentMode,
  reviewWrongAnswers,
  reviewMarkedQuestions,
  switchModeAfterResult,
} = sessionStore
const { t } = useI18n()
const { showToast } = uiStore
const aiSettings = ref(loadAiSettings())
const aiResponses = ref<Record<string, string>>({})
const allAiResponse = ref('')
const aiLoading = ref<string | null>(null)
const aiError = ref('')

const wrongRows = computed(() => resultRows.value.filter(row => !row.record?.isCorrect))
const displaySet = computed(() => activeSet.value ?? setsStore.sets[0] ?? null)
const isChoiceMode = computed(() => ['quiz', 'cloze', 'reading'].includes(resultSummary.value?.mode ?? ''))
const modeLabel = computed(() => {
  if (currentSession.value?.sourceSetId === 'daily')
    return t('practice.dailyQuestions')
  const mode = resultSummary.value?.mode
  if (mode === 'cloze')
    return t('practice.fillBlank')
  if (mode === 'reading')
    return t('practice.reading')
  if (mode === 'spelling')
    return t('practice.spelling')
  return t('practice.quiz')
})

function questionFor(row: typeof resultRows.value[number]) {
  return row.entry.question
}
const isPerfect = computed(() => resultSummary.value != null && resultSummary.value.wrongCount === 0)
const aiModeIsApi = computed(() => aiSettings.value.enabled)

function rowKey(row: ResultRow) {
  return `${row.index}-${row.entry.item.id}`
}

async function explainQuestion(row: ResultRow) {
  if (!resultSummary.value)
    return
  const promptText = buildQuestionExplainPrompt(row.entry, row.record, resultSummary.value.mode, t('result.notAnswered'))
  const settings = loadAiSettings()
  aiSettings.value = settings
  aiError.value = ''

  if (settings.enabled) {
    if (!settings.apiKey.trim()) {
      aiError.value = t('result.aiConfigError')
      return
    }
    const key = rowKey(row)
    aiLoading.value = key
    try {
      const response = await generateWithAi(settings, promptText, { responseFormat: 'text' })
      aiResponses.value = { ...aiResponses.value, [key]: response }
    }
    catch (error) {
      aiError.value = (error as Error).message || t('result.aiFailed')
    }
    finally {
      aiLoading.value = null
    }
    return
  }

  try {
    await copyToClipboard(promptText)
    showToast(t('result.copiedAiPromptSingle', { word: row.entry.item.word }))
  }
  catch {
    showToast(t('toast.copyFailed'))
  }
}

async function explainAllWrongQuestions() {
  if (!resultSummary.value || resultSummary.value.wrongCount === 0)
    return

  const rows = wrongRows.value
  if (rows.length === 0)
    return

  const promptText = buildAllWrongQuestionsPrompt(rows, resultSummary.value.mode)
  const settings = loadAiSettings()
  aiSettings.value = settings
  aiError.value = ''

  if (settings.enabled) {
    if (!settings.apiKey.trim()) {
      aiError.value = t('result.aiConfigError')
      return
    }
    aiLoading.value = 'all'
    try {
      allAiResponse.value = await generateWithAi(settings, promptText, { responseFormat: 'text' })
    }
    catch (error) {
      aiError.value = (error as Error).message || t('result.aiFailed')
    }
    finally {
      aiLoading.value = null
    }
    return
  }

  try {
    await copyToClipboard(promptText)
    showToast(t('result.copiedAiPrompt'))
  }
  catch {
    showToast(t('toast.copyFailed'))
  }
}

onMounted(() => {
  nextTick(() => {
    document.getElementById('completion-panel')?.scrollIntoView({ behavior: 'instant', block: 'start' })
  })
})
</script>

<template>
  <section v-if="displaySet && resultSummary" class="space-y-6">
    <Card id="completion-panel" class="p-5 sm:p-8 text-left">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-ink-200/50 dark:border-ink-200/10">
        <div class="flex items-start gap-4">
          <span class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent-primary/10 text-accent-primary border border-accent-primary/15 shadow-sm" aria-hidden="true">
            <BookOpenText class="h-6 w-6" />
          </span>
          <div class="space-y-1">
            <h2 class="text-xl sm:text-2xl font-extrabold tracking-tight text-ink-950 dark:text-ink-50">
              {{ resultSummary.review ? $t('result.reviewCompleted') : $t('result.completed') }}
            </h2>
            <p class="text-xs font-bold text-ink-400 dark:text-ink-500 uppercase tracking-widest">
              {{ $t('result.modeLabel') }}{{ modeLabel }}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-4 self-start md:self-auto shrink-0 bg-ink-100/80 dark:bg-ink-900 border border-ink-200/70 dark:border-ink-200/25 rounded-2xl p-4">
          <ScoreRing :score="resultSummary.score" />
          <div class="text-left">
            <p class="text-xs font-semibold text-ink-500 dark:text-ink-400">
              {{ $t('result.correctCount', { correct: resultSummary.correctCount, total: resultSummary.total, wrong: resultSummary.wrongCount }) }}
            </p>
          </div>
        </div>
      </div>

      <div class="mt-6 flex flex-wrap items-center justify-start gap-3">
        <Button variant="default" class="gap-2" @click="restartCurrentMode">
          <RotateCcw class="h-4 w-4" />
          <span>{{ $t('result.retry') }}</span>
        </Button>
        <Button
          v-if="resultSummary.wrongCount"
          variant="outline"
          class="gap-2"
          @click="reviewWrongAnswers"
        >
          <BookOpenText class="h-4 w-4 text-accent-primary" />
          <span>{{ $t('result.reviewWrong', { count: resultSummary.wrongCount }) }}</span>
        </Button>
        <Button
          v-if="isChoiceMode && resultSummary.markedCount"
          variant="outline"
          class="gap-2"
          @click="reviewMarkedQuestions"
        >
          <BookmarkCheck class="h-4 w-4 text-accent-primary" />
          <span>{{ $t('result.reviewMarked', { count: resultSummary.markedCount }) }}</span>
        </Button>
        <Button
          v-if="resultSummary.wrongCount"
          variant="outline"
          class="gap-2"
          :loading="aiLoading === 'all'"
          @click="explainAllWrongQuestions"
        >
          <ClipboardCopy class="h-4 w-4 text-accent-primary" />
          <span>{{ aiModeIsApi ? $t('result.aiGenerateAll') : $t('result.aiExplainAll') }}</span>
        </Button>
        <Button v-if="isChoiceMode" variant="outline" class="gap-2" @click="switchModeAfterResult">
          <BookOpenText class="h-4 w-4 text-accent-primary" />
          <span>{{ $t('result.switchMode', { next: resultSummary.mode === 'cloze' ? $t('practice.reading') : $t('practice.fillBlank') }) }}</span>
        </Button>
      </div>

      <StatusMessage v-if="aiError" tone="error" class="mt-4">
        {{ aiError }}
      </StatusMessage>

      <Card v-if="allAiResponse" class="mt-5 border-accent-primary/15 bg-accent-primary/5 p-5 text-left">
        <p class="text-sm font-extrabold text-accent-primary">
          {{ $t('result.aiResponseTitle') }}
        </p>
        <div class="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-700 dark:text-ink-300">
          {{ allAiResponse }}
        </div>
      </Card>

      <p
        v-if="isPerfect"
        class="mt-6 text-xs text-accent-primary dark:text-accent-primary font-extrabold flex items-center gap-1.5 animate-perfect-in"
      >
        <span class="h-2 w-2 rounded-full bg-accent-primary inline-block animate-ping" />
        {{ $t('result.perfectScore') }}
      </p>
    </Card>

    <div v-if="wrongRows.length" class="space-y-4">
      <Card
        v-for="(row, i) in wrongRows"
        :key="`${row.entry.item.id}-${row.index}`"
        class="p-5 text-left result-row-enter"
        :style="{ animationDelay: `${Math.min(i, 8) * 40}ms` }"
      >
        <div class="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-ink-200/40 dark:border-ink-200/10">
          <div class="space-y-1">
            <p class="text-base font-bold text-ink-950 dark:text-ink-50">
              {{ $t('result.question', { index: row.index + 1 }) }} ｜ <span class="font-extrabold tracking-tight text-accent-primary">{{ row.entry.item.word }}</span>
            </p>
            <p class="text-xs text-ink-400 dark:text-ink-500 font-semibold">
              {{ $t('study.pos') }}：{{ row.entry.item.pos || 'n./v./adj.' }}
            </p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              class="h-8 px-3 text-xs text-ink-600 dark:text-ink-400 border-ink-200 dark:border-ink-200/40 hover:bg-ink-100 dark:hover:bg-ink-200 rounded-xl"
              :loading="aiLoading === rowKey(row)"
              @click="explainQuestion(row)"
            >
              <ClipboardCopy class="h-3.5 w-3.5 mr-1 text-accent-primary" />
              <span>{{ aiModeIsApi ? $t('result.aiGenerate') : $t('result.aiExplain') }}</span>
            </Button>
            <Badge
              :variant="row.record?.skipped ? 'secondary' : 'destructive'"
              class="rounded-lg px-2.5 py-0.5 text-xs font-bold"
            >
              {{ row.record?.skipped ? $t('result.skipped') : $t('result.wrong') }}
            </Badge>
          </div>
        </div>

        <div class="mt-4 space-y-3 text-sm leading-relaxed text-ink-700 dark:text-ink-300">
          <div v-if="isChoiceMode && questionFor(row)" class="space-y-2">
            <p class="font-bold text-ink-950 dark:text-ink-50">
              {{ questionFor(row)?.prompt }}
            </p>
            <div class="grid gap-1.5 p-3 rounded-xl bg-ink-100 dark:bg-ink-100/30 text-xs text-ink-500 dark:text-ink-400 border border-ink-200/30 dark:border-ink-200/5 font-semibold">
              <p>{{ $t('result.yourAnswer') }}：<span class="font-bold text-red-500">{{ row.record?.userAnswer ?? $t('result.notAnswered') }}</span></p>
              <p>{{ $t('result.correctAnswer') }}：<span class="font-bold text-emerald-600 dark:text-emerald-400">{{ row.record?.correctAnswer ?? questionFor(row)?.opts[questionFor(row)?.ans ?? 0] }}</span></p>
            </div>
          </div>
          <div v-else class="space-y-2">
            <p class="font-bold text-ink-950 dark:text-ink-50">
              {{ row.entry.item.example }}
            </p>
            <div class="grid gap-1.5 p-3 rounded-xl bg-ink-100 dark:bg-ink-100/30 text-xs text-ink-500 dark:text-ink-400 border border-ink-200/30 dark:border-ink-200/5 font-semibold">
              <p>{{ $t('study.meaning') }}：<span class="font-bold text-ink-850 dark:text-ink-200">{{ row.entry.item.meaning }}</span></p>
              <p>{{ $t('result.yourAnswer') }}：<span class="font-bold text-red-500">{{ row.record?.userAnswer ?? $t('result.notAnswered') }}</span></p>
              <p>{{ $t('result.correctAnswer') }}：<span class="font-bold text-emerald-600 dark:text-emerald-400">{{ row.record?.correctAnswer ?? row.entry.item.word }}</span></p>
            </div>
          </div>
        </div>
        <div v-if="aiResponses[rowKey(row)]" class="mt-4 rounded-xl border border-accent-primary/15 bg-accent-primary/5 p-4 text-sm leading-relaxed text-ink-700 dark:text-ink-300">
          <p class="mb-2 text-xs font-extrabold text-accent-primary">
            {{ $t('result.aiResponseTitle') }}
          </p>
          <div class="whitespace-pre-wrap">
            {{ aiResponses[rowKey(row)] }}
          </div>
        </div>
      </Card>
    </div>
  </section>
</template>

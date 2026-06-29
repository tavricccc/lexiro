import type {
  Draft,
  PracticeMode,
  PracticeSession,
  QuizRecord,
  ResultRow,
  ResultSummary,
  SessionEntry,
  SpellingRecord,
} from '@/types'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { LEGACY_STORAGE_KEY, SESSION_STORAGE_KEY } from '@/constants'
import { i18n } from '@/lib/i18n'
import { loadFromStorage, saveToStorage } from '@/lib/persist'
import { normalizeSession, toSessionEntries } from '@/lib/validation'
import { useSetsStore } from './sets'
import { useUIStore } from './ui'

const t = i18n.global.t

export const useSessionStore = defineStore('session', () => {
  const router = useRouter()
  const currentSession = ref<PracticeSession | null>(null)
  const flashcardIndex = ref(0)
  const currentView = ref<string>('home')
  const practiceCounts = ref<Record<string, number>>({})
  const practiceDialogOpen = ref(false)
  const practiceDialogMode = ref<PracticeMode>('quiz')
  const practiceDialogSetId = ref<string | null>(null)
  const practiceDialogCount = ref(1)

  const sessionEntries = computed(() => currentSession.value?.entries ?? [])
  const totalItems = computed(() => sessionEntries.value.length)
  const currentIndex = computed(() => currentSession.value?.index ?? 0)
  const currentEntry = computed(() => {
    const entries = sessionEntries.value
    const idx = currentIndex.value
    return entries[idx] ?? null
  })

  const progressCount = computed(() => {
    if (!currentSession.value)
      return 0
    if (currentView.value === 'flashcard')
      return flashcardIndex.value + 1
    const drafts = currentSession.value.drafts
    const currentDraft = drafts[currentIndex.value]
    const answered = currentDraft && (
      ('selectedIndex' in currentDraft && currentDraft.selectedIndex != null)
      || ('answer' in currentDraft && typeof currentDraft.answer === 'string')
    )
    return currentIndex.value + (answered ? 1 : 0)
  })

  const progressPercent = computed(() => {
    if (!totalItems.value)
      return 0
    return Math.round((progressCount.value / totalItems.value) * 100)
  })

  const resultSummary = computed<ResultSummary | null>(() => {
    if (!currentSession.value)
      return null
    const total = currentSession.value.entries.length
    const correctCount = currentSession.value.correctCount
    const score = total > 0 ? Math.round((correctCount / total) * 100) : 0
    return {
      mode: currentSession.value.mode,
      review: currentSession.value.review,
      total,
      correctCount,
      wrongCount: currentSession.value.wrongEntries.length,
      score,
    }
  })

  const resultRows = computed<ResultRow[]>(() => {
    if (!currentSession.value)
      return []
    return currentSession.value.entries.map((entry, index) => ({
      entry,
      record: currentSession.value!.answers[index] ?? null,
      index,
    }))
  })

  function saveState() {
    saveToStorage(SESSION_STORAGE_KEY, {
      currentView: currentView.value,
      currentSession: currentSession.value,
      flashcardIndex: flashcardIndex.value,
      practiceCounts: practiceCounts.value,
    })
  }

  async function loadState() {
    const loaded = await loadFromStorage(SESSION_STORAGE_KEY, [LEGACY_STORAGE_KEY])
    if (!loaded.value)
      return

    try {
      const parsed = JSON.parse(loaded.value)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        return

      const hasSessionPayload = 'currentView' in parsed
        || 'currentSession' in parsed
        || 'flashcardIndex' in parsed
        || 'practiceCounts' in parsed
      if (!hasSessionPayload)
        return

      const setsStore = useSetsStore()
      const validSetIds = new Set(setsStore.sets.map(s => s.id))

      const savedView = typeof parsed.currentView === 'string' ? parsed.currentView : 'home'
      currentView.value = savedView
      const savedSession = normalizeSession(parsed.currentSession, validSetIds, savedView)

      practiceCounts.value = parsed.practiceCounts && typeof parsed.practiceCounts === 'object' && !Array.isArray(parsed.practiceCounts)
        ? parsed.practiceCounts
        : {}

      currentSession.value = savedSession
      flashcardIndex.value = Number.isInteger(parsed.flashcardIndex) && parsed.flashcardIndex >= 0 ? parsed.flashcardIndex : 0

      if (!savedSession) {
        currentView.value = 'home'
        flashcardIndex.value = 0
        practiceCounts.value = {}
      }

      if (loaded.sourceKey !== SESSION_STORAGE_KEY)
        saveState()
    }
    catch {
      // Ignore
    }
  }

  function clearStudyProgress() {
    currentSession.value = null
    flashcardIndex.value = 0
  }

  function resetStudyView() {
    currentView.value = 'home'
    clearStudyProgress()
  }

  function returnHome() {
    currentView.value = 'home'
    router.push({ name: 'home' })
  }

  function shuffleEntries(entries: SessionEntry[]): SessionEntry[] {
    const cloned = [...entries]
    for (let index = cloned.length - 1; index > 0; index--) {
      const randomIndex = Math.floor(Math.random() * (index + 1))
      ;[cloned[index], cloned[randomIndex]] = [cloned[randomIndex], cloned[index]]
    }
    return cloned
  }

  function getPracticeCount(setId: string, totalItems: number): number {
    const storedCount = practiceCounts.value[setId]
    if (!Number.isInteger(storedCount))
      return totalItems
    return Math.min(Math.max(storedCount, 1), totalItems)
  }

  function buildPracticeEntries(setId: string, items: SessionEntry[]): SessionEntry[] {
    const shuffled = shuffleEntries(items)
    const count = getPracticeCount(setId, shuffled.length)
    return shuffled.slice(0, count)
  }

  function createSession(mode: PracticeMode, entries: SessionEntry[], review = false, sourceSetId: string | null = null): PracticeSession {
    return {
      sourceSetId: sourceSetId ?? '',
      mode,
      entries,
      index: 0,
      correctCount: 0,
      wrongEntries: [],
      answers: [],
      drafts: [],
      review,
      status: 'in-progress',
    }
  }

  function isResumableSession(setId: string, mode: string): boolean {
    if (!currentSession.value)
      return false
    if (currentSession.value.sourceSetId !== setId)
      return false
    if (currentSession.value.mode !== mode)
      return false
    if (currentView.value === 'result')
      return false

    if (mode === 'flashcard') {
      return flashcardIndex.value < (currentSession.value.entries?.length ?? 0)
    }

    return currentSession.value.index < currentSession.value.entries.length
  }

  function ensureActiveSet(setId: string) {
    const setsStore = useSetsStore()
    setsStore.ensureActiveSet(setId)
  }

  function startFlashcards(setId: string) {
    ensureActiveSet(setId)
    const setsStore = useSetsStore()
    if (isResumableSession(setId, 'flashcard')) {
      currentView.value = 'flashcard'
      router.push({ name: 'flashcard', params: { setId } })
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    flashcardIndex.value = 0
    currentSession.value = createSession('flashcard', toSessionEntries(setsStore.activeSet?.items ?? []), false, setId)
    currentView.value = 'flashcard'
    router.push({ name: 'flashcard', params: { setId } })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function navigateToMode(mode: PracticeMode, setId: string) {
    router.push({ name: mode, params: { setId } })
  }

  async function startRound(mode: PracticeMode, setId: string, reviewEntries: SessionEntry[] | null = null) {
    const uiStore = useUIStore()
    const setsStore = useSetsStore()
    ensureActiveSet(setId)

    if (isResumableSession(setId, mode) && !reviewEntries) {
      const confirmed = await uiStore.showConfirm(t('confirm.resumeTitle'), t('confirm.resumeMessage'))
      if (confirmed) {
        currentView.value = mode
        navigateToMode(mode, setId)
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }

      const entries = buildPracticeEntries(setId, toSessionEntries(setsStore.activeSet?.items ?? []))
      currentSession.value = createSession(mode, entries, false, setId)
      currentView.value = mode
      navigateToMode(mode, setId)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    const entries = reviewEntries
      ? shuffleEntries(reviewEntries.map(entry => ({ ...entry })))
      : buildPracticeEntries(setId, toSessionEntries(setsStore.activeSet?.items ?? []))

    currentSession.value = createSession(mode, entries, Boolean(reviewEntries), setId)
    currentView.value = mode
    navigateToMode(mode, setId)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handlePracticeCountChange(setId: string, value: string, totalItems: number) {
    const parsedValue = Number.parseInt(value, 10)
    const nextValue = Number.isNaN(parsedValue) ? totalItems : Math.min(Math.max(parsedValue, 1), totalItems)
    practiceCounts.value = { ...practiceCounts.value, [setId]: nextValue }
  }

  function openPracticeDialog(mode: PracticeMode, setId: string) {
    const setsStore = useSetsStore()
    const set = setsStore.sets.find(item => item.id === setId)
    if (!set)
      return
    practiceDialogMode.value = mode
    practiceDialogSetId.value = setId
    practiceDialogCount.value = getPracticeCount(setId, set.items.length)
    practiceDialogOpen.value = true
  }

  async function confirmPracticeDialog() {
    if (!practiceDialogSetId.value)
      return
    const setsStore = useSetsStore()
    handlePracticeCountChange(practiceDialogSetId.value, String(practiceDialogCount.value), setsStore.activeSet?.items.length ?? 1)
    practiceDialogOpen.value = false
    await startRound(practiceDialogMode.value, practiceDialogSetId.value)
  }

  function closePracticeDialog() {
    practiceDialogOpen.value = false
  }

  function getQuizUserAnswerText(entry: SessionEntry, selectedIndex: number | null | undefined): string {
    if (selectedIndex === null || selectedIndex === undefined)
      return t('result.notAnswered')
    return entry.item.question.opts[selectedIndex] ?? t('result.notAnswered')
  }

  function buildQuizRecord(entry: SessionEntry, draft: Draft): QuizRecord {
    const selectedIndex = (draft as unknown as Record<string, unknown>)?.selectedIndex as number ?? null
    const isCorrect = selectedIndex === entry.item.question.ans

    return {
      type: 'quiz',
      selectedIndex,
      userAnswer: getQuizUserAnswerText(entry, selectedIndex),
      correctAnswer: entry.item.question.opts[entry.item.question.ans],
      isCorrect,
      skipped: selectedIndex === null || selectedIndex === undefined,
    }
  }

  function buildSpellingRecord(entry: SessionEntry, draft: Draft): SpellingRecord {
    const userAnswer = ((draft as unknown as Record<string, unknown>)?.answer as string)?.trim() ?? ''
    const isCorrect = userAnswer.trim().toLowerCase() === entry.item.word.trim().toLowerCase()

    return {
      type: 'spelling',
      userAnswer: userAnswer || t('result.notAnswered'),
      correctAnswer: entry.item.word,
      isCorrect,
      skipped: !userAnswer,
    }
  }

  function submitCurrentRound() {
    if (!currentSession.value || (currentView.value !== 'quiz' && currentView.value !== 'spelling'))
      return

    const records = currentSession.value.entries.map((entry, index) => {
      const draft = currentSession.value!.drafts[index] ?? null
      return currentView.value === 'quiz'
        ? buildQuizRecord(entry, draft)
        : buildSpellingRecord(entry, draft)
    })

    currentSession.value.answers = records
    currentSession.value.correctCount = records.filter(r => r.isCorrect).length
    currentSession.value.wrongEntries = currentSession.value.entries.filter((_, index) => !records[index]?.isCorrect)
    currentSession.value.status = 'completed'
    finishRound()
  }

  function finishRound() {
    if (currentSession.value) {
      currentSession.value.status = 'completed'
    }
    currentView.value = 'result'
    router.push({ name: 'result' })
  }

  function advanceToNext() {
    if (!currentSession.value)
      return
    const nextIndex = currentSession.value.index + 1
    if (nextIndex < currentSession.value.entries.length) {
      currentSession.value.index = nextIndex
      saveState()
    }
    else {
      submitCurrentRound()
    }
  }

  function handleQuizDraftChange(entryIndex: number, payload: { selectedIndex: number | null }) {
    if (!currentSession.value)
      return
    currentSession.value.drafts[entryIndex] = {
      selectedIndex: payload.selectedIndex ?? null,
      answered: true,
    }
    saveState()
  }

  function handleSpellingDraftChange(entryIndex: number, payload: { answer: string }) {
    if (!currentSession.value)
      return
    currentSession.value.drafts[entryIndex] = {
      answer: payload.answer ?? '',
      submitted: true,
    }
    saveState()
  }

  function restartCurrentMode() {
    const setsStore = useSetsStore()
    if (!setsStore.activeSet || !resultSummary.value)
      return
    startRound(resultSummary.value.mode, setsStore.activeSet.id)
  }

  function switchModeAfterResult() {
    const setsStore = useSetsStore()
    if (!setsStore.activeSet || !resultSummary.value)
      return
    const nextMode: PracticeMode = resultSummary.value.mode === 'quiz' ? 'spelling' : 'quiz'
    startRound(nextMode, setsStore.activeSet.id)
  }

  function reviewWrongAnswers() {
    const setsStore = useSetsStore()
    if (!setsStore.activeSet || !currentSession.value?.wrongEntries.length)
      return
    startRound(currentSession.value.mode, setsStore.activeSet.id, currentSession.value.wrongEntries)
  }

  function exitCurrentView() {
    returnHome()
  }

  return {
    currentSession,
    flashcardIndex,
    currentView,
    practiceCounts,
    practiceDialogOpen,
    practiceDialogMode,
    practiceDialogSetId,
    practiceDialogCount,
    sessionEntries,
    totalItems,
    currentIndex,
    currentEntry,
    progressCount,
    progressPercent,
    resultSummary,
    resultRows,
    saveState,
    loadState,
    clearStudyProgress,
    resetStudyView,
    returnHome,
    isResumableSession,
    startFlashcards,
    startRound,
    handlePracticeCountChange,
    openPracticeDialog,
    confirmPracticeDialog,
    closePracticeDialog,
    submitCurrentRound,
    finishRound,
    advanceToNext,
    handleQuizDraftChange,
    handleSpellingDraftChange,
    restartCurrentMode,
    switchModeAfterResult,
    reviewWrongAnswers,
    exitCurrentView,
  }
})

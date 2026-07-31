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
import { createDebouncedSaver, loadFromStorage, saveToStorage } from '@/lib/persist'
import { shuffleEntries, shuffleQuizEntry } from '@/lib/shuffle'
import { isSpellingAnswerCorrect } from '@/lib/spelling'
import { normalizeSession, toSessionEntries } from '@/lib/validation'
import { useSetsStore } from './sets'
import { useUIStore } from './ui'

const t = i18n.global.t

export function makeSessionKey(setId: string, mode: PracticeMode): string {
  return `${setId}::${mode}`
}

export function parseSessionKey(key: string): { setId: string, mode: PracticeMode } | null {
  const sep = key.lastIndexOf('::')
  if (sep <= 0)
    return null
  const setId = key.slice(0, sep)
  const mode = key.slice(sep + 2)
  if (mode !== 'quiz' && mode !== 'spelling' && mode !== 'flashcard')
    return null
  return { setId, mode }
}

function prepareEntriesForMode(mode: PracticeMode, entries: SessionEntry[]): SessionEntry[] {
  if (mode !== 'quiz')
    return entries
  return entries.map(shuffleQuizEntry)
}

function modeLabel(mode: PracticeMode): string {
  if (mode === 'quiz')
    return t('practice.quiz')
  if (mode === 'spelling')
    return t('practice.spelling')
  return t('flashcard.title')
}

function isInProgressSession(session: PracticeSession | null | undefined): session is PracticeSession {
  return Boolean(session && session.status === 'in-progress' && session.entries.length > 0)
}

function progressPosition(session: PracticeSession): number {
  return Math.min(session.index + 1, session.entries.length)
}

export const useSessionStore = defineStore('session', () => {
  const router = useRouter()

  /** Independent progress per set + mode. Key: `${setId}::${mode}` */
  const sessionsByKey = ref<Record<string, PracticeSession>>({})
  const activeKey = ref<string | null>(null)
  const currentView = ref<string>('home')
  const practiceCounts = ref<Record<string, number>>({})
  const practiceDialogOpen = ref(false)
  const practiceDialogMode = ref<PracticeMode>('quiz')
  const practiceDialogSetId = ref<string | null>(null)
  const practiceDialogCount = ref(1)

  const currentSession = computed(() => {
    if (!activeKey.value)
      return null
    return sessionsByKey.value[activeKey.value] ?? null
  })

  /** Alias of session.index — flashcard uses the same field as quiz/spelling. */
  const flashcardIndex = computed(() => {
    if (currentSession.value?.mode === 'flashcard')
      return currentSession.value.index
    return 0
  })

  const sessionEntries = computed(() => currentSession.value?.entries ?? [])
  const totalItems = computed(() => sessionEntries.value.length)
  const currentIndex = computed(() => currentSession.value?.index ?? 0)
  const currentEntry = computed(() => sessionEntries.value[currentIndex.value] ?? null)
  const flashcardEntry = computed(() => sessionEntries.value[flashcardIndex.value] ?? null)

  const progressCount = computed(() => {
    if (!currentSession.value)
      return 0
    if (currentSession.value.mode === 'flashcard')
      return Math.min(currentSession.value.index + 1, totalItems.value)
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
      markedCount: currentSession.value.mode === 'quiz'
        ? currentSession.value.markedForReview.filter(Boolean).length
        : 0,
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

  function snapshot() {
    return {
      version: 2,
      currentView: currentView.value,
      activeKey: activeKey.value,
      sessionsByKey: sessionsByKey.value,
      practiceCounts: practiceCounts.value,
      // legacy single-session fields kept empty for older readers
      currentSession: currentSession.value,
      flashcardIndex: flashcardIndex.value,
    }
  }

  const sessionSaver = createDebouncedSaver(() => {
    saveToStorage(SESSION_STORAGE_KEY, snapshot())
  }, 300)

  function saveState(immediate = false) {
    if (immediate) {
      sessionSaver.flush()
      return
    }
    sessionSaver.schedule()
  }

  function putSession(setId: string, mode: PracticeMode, session: PracticeSession, activate = true) {
    const key = makeSessionKey(setId, mode)
    sessionsByKey.value = { ...sessionsByKey.value, [key]: session }
    if (activate)
      activeKey.value = key
  }

  function getSession(setId: string, mode: PracticeMode): PracticeSession | null {
    return sessionsByKey.value[makeSessionKey(setId, mode)] ?? null
  }

  function removeSessionKey(key: string) {
    if (!(key in sessionsByKey.value))
      return
    const next = { ...sessionsByKey.value }
    delete next[key]
    sessionsByKey.value = next
    if (activeKey.value === key)
      activeKey.value = null
  }

  function clearSessionsForSet(setId: string) {
    const next: Record<string, PracticeSession> = {}
    for (const [key, session] of Object.entries(sessionsByKey.value)) {
      if (!key.startsWith(`${setId}::`))
        next[key] = session
    }
    sessionsByKey.value = next
    if (activeKey.value?.startsWith(`${setId}::`))
      activeKey.value = null
  }

  function getInProgressModes(setId: string): PracticeMode[] {
    const modes: PracticeMode[] = []
    for (const mode of ['flashcard', 'quiz', 'spelling'] as PracticeMode[]) {
      const session = getSession(setId, mode)
      if (isInProgressSession(session) && isResumableSession(setId, mode))
        modes.push(mode)
    }
    return modes
  }

  function getInProgressModesLabel(setId: string): string {
    return getInProgressModes(setId).map(modeLabel).join(' · ')
  }

  function isSetInProgress(setId: string): boolean {
    return getInProgressModes(setId).length > 0
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
        || 'sessionsByKey' in parsed
        || 'activeKey' in parsed
      if (!hasSessionPayload)
        return

      const setsStore = useSetsStore()
      const validSetIds = new Set(setsStore.sets.map(s => s.id))

      practiceCounts.value = parsed.practiceCounts && typeof parsed.practiceCounts === 'object' && !Array.isArray(parsed.practiceCounts)
        ? parsed.practiceCounts
        : {}

      const nextMap: Record<string, PracticeSession> = {}

      // v2 multi-session map
      if (parsed.sessionsByKey && typeof parsed.sessionsByKey === 'object' && !Array.isArray(parsed.sessionsByKey)) {
        for (const [key, raw] of Object.entries(parsed.sessionsByKey as Record<string, unknown>)) {
          const parsedKey = parseSessionKey(key)
          if (!parsedKey || !validSetIds.has(parsedKey.setId))
            continue
          const session = normalizeSession(raw, validSetIds, parsed.currentView)
          if (!session)
            continue
          // Prefer key mode if session mode drifted
          if (session.mode !== parsedKey.mode)
            session.mode = parsedKey.mode
          if (session.mode === 'flashcard' && session.index >= session.entries.length)
            session.index = Math.max(0, session.entries.length - 1)
          nextMap[key] = session
        }
      }
      else if (parsed.currentSession) {
        // v1 single session migration
        const savedView = typeof parsed.currentView === 'string' ? parsed.currentView : 'home'
        const session = normalizeSession(parsed.currentSession, validSetIds, savedView)
        if (session) {
          if (session.mode === 'flashcard' && Number.isInteger(parsed.flashcardIndex)) {
            session.index = Math.min(
              Math.max(0, parsed.flashcardIndex as number),
              Math.max(0, session.entries.length - 1),
            )
          }
          nextMap[makeSessionKey(session.sourceSetId, session.mode)] = session
        }
      }

      sessionsByKey.value = nextMap

      const savedView = typeof parsed.currentView === 'string' ? parsed.currentView : 'home'
      currentView.value = savedView

      if (typeof parsed.activeKey === 'string' && nextMap[parsed.activeKey]) {
        activeKey.value = parsed.activeKey
      }
      else if (parsed.currentSession && typeof parsed.currentSession === 'object') {
        const s = parsed.currentSession as PracticeSession
        const key = makeSessionKey(s.sourceSetId, s.mode)
        activeKey.value = nextMap[key] ? key : null
      }
      else {
        activeKey.value = null
      }

      // Drop active if view is home and no need to restore mid-page
      if (savedView === 'home') {
        // keep sessions, just don't force a view
      }

      if (!Object.keys(nextMap).length) {
        activeKey.value = null
        if (savedView !== 'home' && savedView !== 'result')
          currentView.value = 'home'
      }

      if (loaded.sourceKey !== SESSION_STORAGE_KEY || parsed.version !== 2)
        saveState(true)
    }
    catch {
      // Ignore
    }
  }

  function clearStudyProgress() {
    activeKey.value = null
  }

  function resetStudyView() {
    currentView.value = 'home'
    activeKey.value = null
    sessionsByKey.value = {}
    saveState(true)
  }

  function returnHome() {
    currentView.value = 'home'
    saveState(true)
    router.push({ name: 'home' })
  }

  function getPracticeCount(setId: string, total: number): number {
    const storedCount = practiceCounts.value[setId]
    if (!Number.isInteger(storedCount))
      return total
    return Math.min(Math.max(storedCount, 1), total)
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
      entries: prepareEntriesForMode(mode, entries),
      index: 0,
      correctCount: 0,
      wrongEntries: [],
      answers: [],
      drafts: [],
      markedForReview: Array.from({ length: entries.length }).map(() => false),
      review,
      status: 'in-progress',
    }
  }

  function isResumableSession(setId: string, mode: string): boolean {
    const session = getSession(setId, mode as PracticeMode)
    if (!isInProgressSession(session))
      return false
    if (session.sourceSetId !== setId)
      return false
    if (session.mode !== mode)
      return false
    return session.index < session.entries.length
  }

  function ensureActiveSet(setId: string) {
    const setsStore = useSetsStore()
    setsStore.ensureActiveSet(setId)
  }

  async function confirmResume(setId: string, mode: PracticeMode): Promise<boolean> {
    const session = getSession(setId, mode)
    if (!session || !isResumableSession(setId, mode))
      return false

    const setsStore = useSetsStore()
    const setName = setsStore.sets.find(s => s.id === setId)?.setName ?? setId
    const uiStore = useUIStore()
    const pos = progressPosition(session)
    const total = session.entries.length

    return uiStore.showConfirm(
      t('confirm.resumeTitle'),
      t('confirm.resumeMessageDetail', {
        setName,
        mode: modeLabel(mode),
        current: pos,
        total,
      }),
      {
        confirmLabel: t('confirm.resumeContinue'),
        cancelLabel: t('confirm.resumeRestart'),
        destructive: false,
      },
    )
  }

  async function navigateToSession(mode: PracticeMode, setId: string) {
    const name = mode === 'flashcard' ? 'flashcard' : mode
    if (router.currentRoute.value.name !== name || router.currentRoute.value.params.setId !== setId)
      await router.push({ name, params: { setId } })
  }

  async function startFlashcards(setId: string) {
    ensureActiveSet(setId)
    const setsStore = useSetsStore()
    const uiStore = useUIStore()
    const items = setsStore.sets.find(s => s.id === setId)?.items ?? []

    if (!items.length) {
      uiStore.showToast(t('editor.itemsRequired'))
      return
    }

    if (isResumableSession(setId, 'flashcard')) {
      const confirmed = await confirmResume(setId, 'flashcard')
      if (confirmed) {
        activeKey.value = makeSessionKey(setId, 'flashcard')
        currentView.value = 'flashcard'
        saveState(true)
        await navigateToSession('flashcard', setId)
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
    }

    putSession(setId, 'flashcard', createSession('flashcard', toSessionEntries(items), false, setId))
    currentView.value = 'flashcard'
    saveState(true)
    await navigateToSession('flashcard', setId)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function startRound(mode: PracticeMode, setId: string, reviewEntries: SessionEntry[] | null = null) {
    const setsStore = useSetsStore()
    ensureActiveSet(setId)

    if (mode === 'flashcard') {
      await startFlashcards(setId)
      return
    }

    if (isResumableSession(setId, mode) && !reviewEntries) {
      const confirmed = await confirmResume(setId, mode)
      if (confirmed) {
        activeKey.value = makeSessionKey(setId, mode)
        currentView.value = mode
        saveState(true)
        await navigateToSession(mode, setId)
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
    }

    const items = setsStore.sets.find(s => s.id === setId)?.items ?? setsStore.activeSet?.items ?? []
    const entries = reviewEntries
      ? shuffleEntries(reviewEntries.map(entry => ({ ...entry })))
      : buildPracticeEntries(setId, toSessionEntries(items))

    putSession(setId, mode, createSession(mode, entries, Boolean(reviewEntries), setId))
    currentView.value = mode
    saveState(true)
    await navigateToSession(mode, setId)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handlePracticeCountChange(setId: string, value: string | number, total: number) {
    const parsedValue = typeof value === 'number' ? value : Number.parseInt(value, 10)
    const nextValue = Number.isNaN(parsedValue) ? total : Math.min(Math.max(parsedValue, 1), total)
    practiceCounts.value = { ...practiceCounts.value, [setId]: nextValue }
    saveState()
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
    const set = setsStore.sets.find(item => item.id === practiceDialogSetId.value)
    const total = set?.items.length ?? 1
    handlePracticeCountChange(practiceDialogSetId.value, practiceDialogCount.value, total)
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
    const selectedIndex = (draft && 'selectedIndex' in draft)
      ? draft.selectedIndex
      : null
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
    const userAnswer = (draft && 'answer' in draft) ? (draft.answer ?? '') : ''
    const isCorrect = isSpellingAnswerCorrect(userAnswer, entry.item.word)

    return {
      type: 'spelling',
      userAnswer: userAnswer.trim() ? userAnswer.trim() : t('result.notAnswered'),
      correctAnswer: entry.item.word,
      isCorrect,
      skipped: !userAnswer.trim(),
    }
  }

  function submitCurrentRound() {
    if (!currentSession.value || (currentSession.value.mode !== 'quiz' && currentSession.value.mode !== 'spelling'))
      return

    const mode = currentSession.value.mode
    const records = currentSession.value.entries.map((entry, index) => {
      const draft = currentSession.value!.drafts[index] ?? null
      return mode === 'quiz'
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
    if (currentSession.value)
      currentSession.value.status = 'completed'
    currentView.value = 'result'
    saveState(true)
    router.push({ name: 'result' })
  }

  function advanceToNext() {
    if (!currentSession.value)
      return
    const nextIndex = currentSession.value.index + 1
    if (nextIndex < currentSession.value.entries.length) {
      currentSession.value.index = nextIndex
      saveState(true)
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

  function toggleReviewMark(entryIndex: number): boolean {
    const session = currentSession.value
    if (!session || session.mode !== 'quiz' || entryIndex < 0 || entryIndex >= session.entries.length)
      return false

    session.markedForReview[entryIndex] = !session.markedForReview[entryIndex]
    saveState()
    return session.markedForReview[entryIndex]
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

  function advanceFlashcard() {
    if (!currentSession.value || currentSession.value.mode !== 'flashcard')
      return false
    if (currentSession.value.index >= currentSession.value.entries.length - 1)
      return false
    currentSession.value.index += 1
    saveState(true)
    return true
  }

  function prevFlashcard() {
    if (!currentSession.value || currentSession.value.mode !== 'flashcard')
      return false
    if (currentSession.value.index <= 0)
      return false
    currentSession.value.index -= 1
    saveState(true)
    return true
  }

  function completeFlashcards() {
    if (currentSession.value && currentSession.value.mode === 'flashcard') {
      currentSession.value.status = 'completed'
      currentSession.value.index = Math.max(0, currentSession.value.entries.length - 1)
      // Keep completed flashcard session only briefly — remove so set can restart clean
      if (activeKey.value)
        removeSessionKey(activeKey.value)
    }
    saveState(true)
    returnHome()
  }

  function restartCurrentMode() {
    const setsStore = useSetsStore()
    if (!setsStore.activeSet || !resultSummary.value)
      return
    // Drop completed slot before restart
    if (activeKey.value)
      removeSessionKey(activeKey.value)
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

  function reviewMarkedQuestions() {
    const session = currentSession.value
    if (!session || session.mode !== 'quiz')
      return

    const markedEntries = session.entries.filter((_, index) => session.markedForReview[index])
    if (!markedEntries.length)
      return

    startRound('quiz', session.sourceSetId, markedEntries)
  }

  function exitCurrentView() {
    if (currentSession.value?.status === 'in-progress') {
      const uiStore = useUIStore()
      const setsStore = useSetsStore()
      const setName = setsStore.sets.find(s => s.id === currentSession.value!.sourceSetId)?.setName
        ?? currentSession.value.sourceSetId
      uiStore.showToast(t('toast.progressSavedDetail', {
        setName,
        mode: modeLabel(currentSession.value.mode),
      }))
    }
    returnHome()
  }

  function hasValidSessionForRoute(routeName: string | symbol | null | undefined): boolean {
    if (!routeName || routeName === 'home')
      return true
    if (!currentSession.value)
      return false
    if (routeName === 'result')
      return currentSession.value.status === 'completed' || currentView.value === 'result'
    if (routeName === 'flashcard')
      return currentSession.value.mode === 'flashcard'
    if (routeName === 'quiz')
      return currentSession.value.mode === 'quiz'
    if (routeName === 'spelling')
      return currentSession.value.mode === 'spelling'
    return true
  }

  return {
    sessionsByKey,
    activeKey,
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
    flashcardEntry,
    progressCount,
    progressPercent,
    resultSummary,
    resultRows,
    saveState,
    loadState,
    clearStudyProgress,
    clearSessionsForSet,
    resetStudyView,
    returnHome,
    isResumableSession,
    isSetInProgress,
    getInProgressModes,
    getInProgressModesLabel,
    getPracticeCount,
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
    toggleReviewMark,
    handleSpellingDraftChange,
    advanceFlashcard,
    prevFlashcard,
    completeFlashcards,
    restartCurrentMode,
    switchModeAfterResult,
    reviewWrongAnswers,
    reviewMarkedQuestions,
    exitCurrentView,
    hasValidSessionForRoute,
  }
})

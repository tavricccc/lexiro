import type {
  Draft,
  LibraryQuestion,
  MultipleChoiceQuestion,
  PracticeMode,
  PracticeSession,
  QuizRecord,
  ResultRow,
  ResultSummary,
  SessionEntry,
  SpellingRecord,
  VocabSet,
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
import { useLearningStore } from './learning'
import { useLibraryStore } from './library'
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
  if (!['quiz', 'cloze', 'reading', 'spelling', 'flashcard'].includes(mode))
    return null
  return { setId, mode: mode as PracticeMode }
}

function prepareEntriesForMode(mode: PracticeMode, entries: SessionEntry[]): SessionEntry[] {
  if (!['quiz', 'cloze', 'reading'].includes(mode))
    return entries
  return entries.map(shuffleQuizEntry)
}

function modeLabel(mode: PracticeMode): string {
  if (mode === 'quiz')
    return t('practice.quiz')
  if (mode === 'cloze')
    return t('practice.fillBlank')
  if (mode === 'reading')
    return t('practice.reading')
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
      markedCount: ['quiz', 'cloze', 'reading'].includes(currentSession.value.mode)
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
    for (const mode of ['flashcard', 'quiz', 'cloze', 'reading', 'spelling'] as PracticeMode[]) {
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
      const validSetIds = new Set(['daily', ...setsStore.sets.map(s => s.id)])

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

  function toLegacyQuestion(question: MultipleChoiceQuestion) {
    return { prompt: question.prompt, opts: question.options, ans: question.answerIndex }
  }

  function isFillBlank(question: MultipleChoiceQuestion) {
    return question.questionStyle === 'fillBlank' || question.prompt.includes('_____')
  }

  function buildQuestionEntries(setId: string, items: VocabSet['items'], mode: Extract<PracticeMode, 'quiz' | 'cloze' | 'reading'>): SessionEntry[] {
    const libraryStore = useLibraryStore()
    if (mode === 'reading') {
      const reading = libraryStore.questions.filter((question): question is Extract<LibraryQuestion, { kind: 'reading' }> => question.kind === 'reading')
      return reading.flatMap((pack) => {
        const relatedItem = items.find(item => pack.wordKeys.includes(item.word.toLocaleLowerCase())) ?? items[0]
        if (!relatedItem)
          return []
        return pack.questions
          .filter(child => child.kind === 'multipleChoice' && Array.isArray(child.options) && child.options.length === 4 && Number.isInteger(child.answerIndex))
          .map(child => ({
            item: { ...relatedItem, question: { prompt: child.prompt, opts: child.options!, ans: child.answerIndex! } },
            originalIndex: items.indexOf(relatedItem),
            readingPassage: pack.passage,
          }))
      })
    }

    const entries = items.flatMap((item, index) => {
      const choices = libraryStore.getQuestionsFor(setId, item.word, 'multipleChoice')
        .filter((question): question is MultipleChoiceQuestion => question.kind === 'multipleChoice')
        .filter(question => mode === 'cloze' ? isFillBlank(question) : !isFillBlank(question))
      const selected = choices[Math.floor(Math.random() * choices.length)]
      if (selected)
        return [{ item: { ...item, question: toLegacyQuestion(selected) }, originalIndex: index }]
      if (mode === 'quiz' && item.question)
        return [{ item, originalIndex: index }]
      return []
    })
    return entries
  }

  function buildQuizItems(setId: string, items: VocabSet['items']): VocabSet['items'] {
    return buildQuestionEntries(setId, items, 'quiz').map(entry => entry.item)
  }

  function getAvailablePracticeCount(setId: string, mode: Extract<PracticeMode, 'cloze' | 'reading'>): number {
    const set = useSetsStore().sets.find(item => item.id === setId)
    return set ? buildQuestionEntries(setId, set.items, mode).length : 0
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
    const name = mode
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
      : mode === 'spelling'
        ? shuffleEntries(toSessionEntries(items.filter(item => item.example)))
        : buildQuestionEntries(setId, items, mode === 'quiz' ? 'quiz' : mode)
    const limitedEntries = entries.slice(0, getPracticeCount(setId, entries.length))

    putSession(setId, mode, createSession(mode, limitedEntries, Boolean(reviewEntries), setId))
    currentView.value = mode
    saveState(true)
    await navigateToSession(mode, setId)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function startDailyQuestionRound(reviewEntries: SessionEntry[] | null = null) {
    const setsStore = useSetsStore()
    const learningStore = useLearningStore()
    const entries = reviewEntries ?? (() => {
      const clozeEntries = setsStore.sets.flatMap(set => buildQuestionEntries(set.id, set.items, 'cloze'))
      const readingEntries = setsStore.sets[0] ? buildQuestionEntries(setsStore.sets[0].id, setsStore.sets[0].items, 'reading') : []
      const unique = new Map<string, SessionEntry>()
      for (const entry of [...clozeEntries, ...readingEntries]) {
        const key = `${entry.item.word}|${entry.item.question?.prompt}|${entry.readingPassage ?? ''}`
        unique.set(key, entry)
      }
      return shuffleEntries(Array.from(unique.values())).slice(0, learningStore.stats.dailyQuestionGoal)
    })()
    if (!entries.length)
      return false
    putSession('daily', 'quiz', createSession('quiz', entries, true, 'daily'))
    currentView.value = 'quiz'
    saveState(true)
    await navigateToSession('quiz', 'daily')
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return true
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
    practiceDialogCount.value = getPracticeCount(setId, mode === 'quiz' ? buildQuizItems(setId, set.items).length : set.items.length)
    practiceDialogOpen.value = true
  }

  async function confirmPracticeDialog() {
    if (!practiceDialogSetId.value)
      return
    const setsStore = useSetsStore()
    const set = setsStore.sets.find(item => item.id === practiceDialogSetId.value)
    const total = set ? (practiceDialogMode.value === 'quiz' ? buildQuizItems(practiceDialogSetId.value, set.items).length : set.items.length) : 1
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
    return entry.item.question?.opts[selectedIndex] ?? t('result.notAnswered')
  }

  function buildQuizRecord(entry: SessionEntry, draft: Draft): QuizRecord {
    const selectedIndex = (draft && 'selectedIndex' in draft)
      ? draft.selectedIndex
      : null
    const question = entry.item.question
    const isCorrect = Boolean(question && selectedIndex === question.ans)

    return {
      type: 'quiz',
      selectedIndex,
      userAnswer: getQuizUserAnswerText(entry, selectedIndex),
      correctAnswer: question?.opts[question.ans] ?? t('result.notAnswered'),
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
    if (!currentSession.value || (currentSession.value.mode === 'flashcard'))
      return

    const mode = currentSession.value.mode
    const records = currentSession.value.entries.map((entry, index) => {
      const draft = currentSession.value!.drafts[index] ?? null
      return mode !== 'spelling'
        ? buildQuizRecord(entry, draft)
        : buildSpellingRecord(entry, draft)
    })

    currentSession.value.answers = records
    currentSession.value.correctCount = records.filter(r => r.isCorrect).length
    currentSession.value.wrongEntries = currentSession.value.entries.filter((_, index) => !records[index]?.isCorrect)
    currentSession.value.status = 'completed'
    if (currentSession.value.sourceSetId === 'daily' && mode !== 'spelling')
      useLearningStore().recordDailyQuestionResults(currentSession.value.correctCount, records.length)
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
    if (!session || !['quiz', 'cloze', 'reading'].includes(session.mode) || entryIndex < 0 || entryIndex >= session.entries.length)
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
    const sourceSetId = currentSession.value?.sourceSetId
    if (!resultSummary.value || (!setsStore.activeSet && sourceSetId !== 'daily'))
      return
    // Drop completed slot before restart
    if (activeKey.value)
      removeSessionKey(activeKey.value)
    if (resultSummary.value.mode === 'quiz' && sourceSetId === 'daily')
      void startDailyQuestionRound()
    else
      void startRound(resultSummary.value.mode, sourceSetId ?? setsStore.activeSet!.id)
  }

  function switchModeAfterResult() {
    const setsStore = useSetsStore()
    if (!resultSummary.value || (currentSession.value?.sourceSetId !== 'daily' && !setsStore.activeSet))
      return
    if (currentSession.value?.sourceSetId === 'daily') {
      void startDailyQuestionRound()
      return
    }
    const nextMode: PracticeMode = resultSummary.value.mode === 'cloze' ? 'reading' : 'cloze'
    void startRound(nextMode, setsStore.activeSet!.id)
  }

  function reviewWrongAnswers() {
    const setsStore = useSetsStore()
    if (!currentSession.value?.wrongEntries.length)
      return
    if (currentSession.value.sourceSetId === 'daily')
      void startDailyQuestionRound(currentSession.value.wrongEntries)
    else if (setsStore.activeSet)
      void startRound(currentSession.value.mode, setsStore.activeSet.id, currentSession.value.wrongEntries)
  }

  function reviewMarkedQuestions() {
    const session = currentSession.value
    if (!session || !['quiz', 'cloze', 'reading'].includes(session.mode))
      return

    const markedEntries = session.entries.filter((_, index) => session.markedForReview[index])
    if (!markedEntries.length)
      return

    if (session.sourceSetId === 'daily')
      void startDailyQuestionRound(markedEntries)
    else
      void startRound(session.mode, session.sourceSetId, markedEntries)
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
    if (routeName === 'cloze')
      return currentSession.value.mode === 'cloze'
    if (routeName === 'reading')
      return currentSession.value.mode === 'reading'
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
    getAvailablePracticeCount,
    startFlashcards,
    startRound,
    startDailyQuestionRound,
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

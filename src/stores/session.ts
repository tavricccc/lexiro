import type {
  Draft,
  LibraryQuestion,
  MultipleChoiceQuestion,
  PracticeDifficulty,
  PracticeMode,
  PracticeSession,
  QuizRecord,
  ResultRow,
  ResultSummary,
  SessionEntry,
  StudyWord,
} from '@/types'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { SESSION_STORAGE_KEY } from '@/constants'
import { buildDailyQuestionEntries as selectDailyQuestionEntries } from '@/lib/daily-question-selection'
import { i18n } from '@/lib/i18n'
import { normalizeWordKey, senseToStudyWord } from '@/lib/library'
import { getLibraryRepository } from '@/lib/library-repository'
import { createDebouncedSaver, loadFromStorage, saveToStorage } from '@/lib/persist'
import { nextPracticeMode } from '@/lib/practice'
import { toPracticeQuestion } from '@/lib/practice-question'
import { expandReadingReviewEntries, groupReadingEntries, readingGroupsForItems, takeBalancedQuestionEntries, takeBalancedReadingGroups, takeReadingGroups } from '@/lib/session-selection'
import { shuffleEntries, shuffleQuizEntry } from '@/lib/shuffle'
import { normalizeSession } from '@/lib/validation'
import { useLearningStore } from './learning'
import { useLibraryStore } from './library'
import { useSetsStore } from './sets'
import { useUIStore } from './ui'

const t = i18n.global.t
const SESSION_STATE_VERSION = 4

export function makeSessionKey(setId: string, mode: PracticeMode): string {
  return `${setId}::${mode}`
}

export function parseSessionKey(key: string): { setId: string, mode: PracticeMode } | null {
  const sep = key.lastIndexOf('::')
  if (sep <= 0)
    return null
  const setId = key.slice(0, sep)
  const mode = key.slice(sep + 2)
  if (!['quiz', 'fillBlank', 'reading'].includes(mode))
    return null
  return { setId, mode: mode as PracticeMode }
}

function prepareEntriesForMode(entries: SessionEntry[]): SessionEntry[] {
  return entries.map(shuffleQuizEntry)
}

const MODE_LABEL_KEYS: Record<PracticeMode, string> = {
  quiz: 'practice.quiz',
  fillBlank: 'practice.fillBlank',
  reading: 'practice.reading',
}

function modeLabel(mode: PracticeMode): string {
  return t(MODE_LABEL_KEYS[mode])
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
  const pendingRoundSync = ref(false)
  const roundSyncing = ref(false)
  let persistencePromise: Promise<void> = Promise.resolve()

  const currentSession = computed(() => {
    if (!activeKey.value)
      return null
    return sessionsByKey.value[activeKey.value] ?? null
  })

  const sessionEntries = computed(() => currentSession.value?.entries ?? [])
  const totalItems = computed(() => sessionEntries.value.length)
  const currentIndex = computed(() => currentSession.value?.index ?? 0)
  const currentEntry = computed(() => sessionEntries.value[currentIndex.value] ?? null)

  const progressCount = computed(() => {
    if (!currentSession.value)
      return 0
    const drafts = currentSession.value.drafts
    const currentDraft = drafts[currentIndex.value]
    const answered = currentDraft && (
      'selectedIndex' in currentDraft && currentDraft.selectedIndex != null
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
      markedCount: currentSession.value.markedForReview.filter(Boolean).length,
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
      version: SESSION_STATE_VERSION,
      currentView: currentView.value,
      activeKey: activeKey.value,
      sessionsByKey: sessionsByKey.value,
    }
  }

  const sessionSaver = createDebouncedSaver(() => {
    const write = saveToStorage(SESSION_STORAGE_KEY, snapshot())
    const next = Promise.all([persistencePromise.catch(() => undefined), write]).then(() => undefined)
    persistencePromise = next
    void next.catch(() => undefined)
  }, 300)

  function saveState(immediate = false) {
    if (immediate) {
      sessionSaver.flush()
      return
    }
    sessionSaver.schedule()
  }

  async function waitForPersistence(): Promise<void> {
    sessionSaver.flush()
    await persistencePromise
  }

  function resetForNamespace() {
    sessionSaver.cancel()
    sessionsByKey.value = {}
    activeKey.value = null
    currentView.value = 'home'
    pendingRoundSync.value = false
    roundSyncing.value = false
    persistencePromise = Promise.resolve()
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
    for (const mode of ['quiz', 'fillBlank', 'reading'] as PracticeMode[]) {
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
    const loaded = await loadFromStorage(SESSION_STORAGE_KEY)
    if (!loaded.value)
      return

    try {
      const parsed = JSON.parse(loaded.value)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        return
      if (parsed.version !== SESSION_STATE_VERSION)
        return

      const hasSessionPayload = 'currentView' in parsed
        || 'sessionsByKey' in parsed
        || 'activeKey' in parsed
      if (!hasSessionPayload)
        return

      const setsStore = useSetsStore()
      const validSetIds = new Set(['daily', ...setsStore.sets.map(s => s.id)])

      const nextMap: Record<string, PracticeSession> = {}

      if (parsed.sessionsByKey && typeof parsed.sessionsByKey === 'object' && !Array.isArray(parsed.sessionsByKey)) {
        for (const [key, raw] of Object.entries(parsed.sessionsByKey as Record<string, unknown>)) {
          const parsedKey = parseSessionKey(key)
          if (!parsedKey || !validSetIds.has(parsedKey.setId))
            continue
          const session = normalizeSession(raw, validSetIds, parsed.currentView)
          if (!session)
            continue
          if (session.mode !== parsedKey.mode)
            session.mode = parsedKey.mode
          nextMap[key] = session
        }
      }

      sessionsByKey.value = nextMap

      const savedView = typeof parsed.currentView === 'string' ? parsed.currentView : 'home'
      currentView.value = savedView

      if (typeof parsed.activeKey === 'string' && nextMap[parsed.activeKey]) {
        activeKey.value = parsed.activeKey
      }
      else {
        activeKey.value = null
      }

      if (!Object.keys(nextMap).length) {
        activeKey.value = null
        if (savedView !== 'home' && savedView !== 'result')
          currentView.value = 'home'
      }
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

  function getPracticeCount(total: number): number {
    const storedCount = useUIStore().questionCountPreference
    if (!Number.isInteger(storedCount))
      return total
    return Math.min(Math.max(storedCount, 1), total)
  }

  function isFillBlank(question: MultipleChoiceQuestion) {
    return question.questionStyle === 'fillBlank'
  }

  function buildQuestionEntries(setId: string, items: StudyWord[], mode: PracticeMode, difficulty: PracticeDifficulty = 'all'): SessionEntry[] {
    const libraryStore = useLibraryStore()
    if (mode === 'reading')
      return readingGroupsForItems(libraryStore.questions, items, difficulty).flat()

    const candidates = items.flatMap((item, index) => {
      const choices = libraryStore.getQuestionsFor(setId, item.word, 'multipleChoice')
        .filter((question): question is MultipleChoiceQuestion => question.kind === 'multipleChoice')
        .filter(question => mode === 'fillBlank' ? isFillBlank(question) : !isFillBlank(question))
        .filter(question => difficulty === 'all' || question.difficulty === difficulty)
      return choices.map(question => ({ item, question: toPracticeQuestion(question), originalIndex: index }))
    })
    return candidates
  }

  function getAvailablePracticeCount(setId: string, mode: PracticeMode, difficulty: PracticeDifficulty = 'all'): number {
    const items = useLibraryStore().getSetStudyWords(setId)
    return buildQuestionEntries(setId, items, mode, difficulty).length
  }

  async function loadRepositoryStudySnapshot(): Promise<{ questions: LibraryQuestion[], words: Map<string, StudyWord> }> {
    await useLibraryStore().waitForPersistence()
    const index = await getLibraryRepository().loadIndex()
    const words = new Map<string, StudyWord>()
    const questions = new Map<string, LibraryQuestion>()
    for await (const payloads of getLibraryRepository().streamSetPayloads(index.sets.map(set => set.id))) {
      for (const payload of payloads.values()) {
        const wordsByKey = new Map(payload.words.map(word => [normalizeWordKey(word.wordKey), word]))
        for (const membership of payload.memberships) {
          const word = wordsByKey.get(normalizeWordKey(membership.wordKey))
          if (!word)
            continue
          const senseIds = new Set(membership.senseIds)
          for (const sense of word.senses) {
            if (senseIds.has(sense.id) && !words.has(sense.id))
              words.set(sense.id, senseToStudyWord(word, sense))
          }
        }
        for (const question of payload.questions)
          questions.set(question.id, question)
      }
    }
    return { questions: Array.from(questions.values()), words }
  }

  function selectQuestionEntries(entries: SessionEntry[], mode: PracticeMode, target: number): SessionEntry[] {
    if (mode === 'reading')
      return takeBalancedReadingGroups(groupReadingEntries(entries), target, new Set(), new Set())
    const pools = [1, 2, 3].map(level => entries.filter(entry => entry.question?.difficulty === level))
    return takeBalancedQuestionEntries(pools, target, new Set(), new Set())
  }

  async function buildDailyQuestionEntriesFromRepository(): Promise<SessionEntry[]> {
    const learningStore = useLearningStore()
    const target = Math.max(0, learningStore.stats.dailyQuestionGoal - learningStore.stats.todayQuestionReviews)
    const snapshot = await loadRepositoryStudySnapshot()
    return selectDailyQuestionEntries(snapshot.questions, snapshot.words, new Set(learningStore.getTodayReviewedSenseIds()), target)
  }

  function createSession(mode: PracticeMode, entries: SessionEntry[], review = false, sourceSetId: string | null = null): PracticeSession {
    return {
      sourceSetId: sourceSetId ?? '',
      mode,
      entries: prepareEntriesForMode(entries),
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

  async function resumeSession(setId: string, mode: PracticeMode): Promise<boolean> {
    if (!isResumableSession(setId, mode))
      return false

    ensureActiveSet(setId)
    activeKey.value = makeSessionKey(setId, mode)
    currentView.value = mode
    saveState(true)
    await navigateToSession(mode, setId)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return true
  }

  async function startRound(mode: PracticeMode, setId: string, reviewEntries: SessionEntry[] | null = null, difficulty: PracticeDifficulty = 'all') {
    ensureActiveSet(setId)

    if (isResumableSession(setId, mode) && !reviewEntries) {
      const confirmed = await confirmResume(setId, mode)
      if (confirmed) {
        activeKey.value = makeSessionKey(setId, mode)
        currentView.value = mode
        pendingRoundSync.value = false
        saveState(true)
        await navigateToSession(mode, setId)
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
    }

    const libraryStore = useLibraryStore()
    const items = libraryStore.getSetStudyWords(setId)
    const entries = reviewEntries
      ? shuffleEntries((mode === 'reading'
          ? expandReadingReviewEntries(reviewEntries, readingGroupsForItems(libraryStore.questions, items, difficulty))
          : reviewEntries
        ).map(entry => ({ ...entry })))
      : buildQuestionEntries(setId, items, mode === 'quiz' ? 'quiz' : mode, difficulty)
    const target = getPracticeCount(entries.length)
    const limitedEntries = reviewEntries
      ? mode === 'reading'
        ? takeReadingGroups(groupReadingEntries(entries), target, new Set(), new Set())
        : entries.slice(0, target)
      : selectQuestionEntries(entries, mode, target)

    putSession(setId, mode, createSession(mode, limitedEntries, Boolean(reviewEntries), setId))
    currentView.value = mode
    pendingRoundSync.value = false
    saveState(true)
    await navigateToSession(mode, setId)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function startDailyQuestionRound(reviewEntries: SessionEntry[] | null = null) {
    let entries: SessionEntry[]
    if (reviewEntries) {
      if (reviewEntries.some(entry => entry.readingPackId)) {
        const snapshot = await loadRepositoryStudySnapshot()
        entries = expandReadingReviewEntries(reviewEntries, readingGroupsForItems(snapshot.questions, Array.from(snapshot.words.values())))
      }
      else {
        entries = reviewEntries
      }
    }
    else {
      entries = await buildDailyQuestionEntriesFromRepository()
    }
    if (!entries.length)
      return false
    putSession('daily', 'quiz', createSession('quiz', entries, Boolean(reviewEntries), 'daily'))
    currentView.value = 'quiz'
    pendingRoundSync.value = false
    saveState(true)
    await navigateToSession('quiz', 'daily')
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return true
  }

  function startDailyQuestionRoundSafely(reviewEntries: SessionEntry[] | null = null) {
    void startDailyQuestionRound(reviewEntries).catch(() => {
      useUIStore().showToast(t('sync.errorPersistence'))
    })
  }

  function handlePracticeCountChange(value: string | number, total: number) {
    const parsedValue = typeof value === 'number' ? value : Number.parseInt(value, 10)
    const nextValue = Number.isNaN(parsedValue) ? total : Math.min(Math.max(parsedValue, 1), total)
    useUIStore().setQuestionCountPreference(nextValue)
    saveState()
  }

  function getQuizUserAnswerText(entry: SessionEntry, selectedIndex: number | null | undefined): string {
    if (selectedIndex === null || selectedIndex === undefined)
      return t('result.notAnswered')
    return entry.question?.options[selectedIndex] ?? t('result.notAnswered')
  }

  function buildQuizRecord(entry: SessionEntry, draft: Draft): QuizRecord {
    const selectedIndex = (draft && 'selectedIndex' in draft)
      ? draft.selectedIndex
      : null
    const question = entry.question
    const isCorrect = Boolean(question && selectedIndex === question.answerIndex)

    return {
      type: 'quiz',
      selectedIndex,
      userAnswer: getQuizUserAnswerText(entry, selectedIndex),
      correctAnswer: question?.options[question.answerIndex] ?? t('result.notAnswered'),
      isCorrect,
      skipped: selectedIndex === null || selectedIndex === undefined,
    }
  }

  async function syncCompletedRound(): Promise<boolean> {
    if (roundSyncing.value)
      return false
    roundSyncing.value = true
    try {
      const { syncAfterLocalCommit } = await import('@/lib/commit-sync')
      const synced = await syncAfterLocalCommit()
      if (synced) {
        pendingRoundSync.value = false
        finishRound()
      }
      return synced
    }
    finally {
      roundSyncing.value = false
    }
  }

  async function submitCurrentRound(): Promise<void> {
    if (!currentSession.value)
      return
    if (currentSession.value.status === 'completed') {
      if (pendingRoundSync.value)
        await syncCompletedRound()
      return
    }

    const records = currentSession.value.entries.map((entry, index) => buildQuizRecord(entry, currentSession.value!.drafts[index] ?? null))

    currentSession.value.answers = records
    currentSession.value.correctCount = records.filter(r => r.isCorrect).length
    currentSession.value.wrongEntries = currentSession.value.entries.filter((_, index) => !records[index]?.isCorrect)
    currentSession.value.status = 'completed'
    const questionResults = records.map((record, index) => {
      const question = currentSession.value!.entries[index].question
      if (!question)
        return null
      return {
        senseId: currentSession.value!.entries[index].item.id,
        questionId: question.questionId,
        questionType: question.questionType,
        difficulty: question.difficulty,
        isCorrect: record.isCorrect,
        marked: currentSession.value!.markedForReview[index] ?? false,
        retry: currentSession.value!.review,
        daily: currentSession.value!.sourceSetId === 'daily',
      }
    }).filter((result): result is NonNullable<typeof result> => Boolean(result))
    const learningStore = useLearningStore()
    learningStore.recordQuestionResults(questionResults)
    learningStore.completePracticeSession()
    pendingRoundSync.value = true
    saveState(true)
    await syncCompletedRound()
  }

  function finishRound() {
    if (currentSession.value)
      currentSession.value.status = 'completed'
    pendingRoundSync.value = false
    currentView.value = 'result'
    saveState(true)
    router.push({ name: 'result' })
  }

  async function advanceToNext(): Promise<void> {
    if (!currentSession.value)
      return
    if (currentSession.value.status === 'completed') {
      await submitCurrentRound()
      return
    }
    const nextIndex = currentSession.value.index + 1
    if (nextIndex < currentSession.value.entries.length) {
      currentSession.value.index = nextIndex
      saveState(true)
    }
    else {
      await submitCurrentRound()
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
    if (!session || entryIndex < 0 || entryIndex >= session.entries.length)
      return false

    session.markedForReview[entryIndex] = !session.markedForReview[entryIndex]
    saveState()
    return session.markedForReview[entryIndex]
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
      startDailyQuestionRoundSafely()
    else
      void startRound(resultSummary.value.mode, sourceSetId ?? setsStore.activeSet!.id)
  }

  function switchModeAfterResult() {
    const setsStore = useSetsStore()
    if (!resultSummary.value || (currentSession.value?.sourceSetId !== 'daily' && !setsStore.activeSet))
      return
    if (currentSession.value?.sourceSetId === 'daily') {
      startDailyQuestionRoundSafely()
      return
    }
    const nextMode = nextPracticeMode(resultSummary.value.mode)
    void startRound(nextMode, setsStore.activeSet!.id)
  }

  function reviewWrongAnswers() {
    const setsStore = useSetsStore()
    if (!currentSession.value?.wrongEntries.length)
      return
    if (currentSession.value.sourceSetId === 'daily')
      startDailyQuestionRoundSafely(currentSession.value.wrongEntries)
    else if (setsStore.activeSet)
      void startRound(currentSession.value.mode, setsStore.activeSet.id, currentSession.value.wrongEntries)
  }

  function reviewMarkedQuestions() {
    const session = currentSession.value
    if (!session)
      return

    const markedEntries = session.entries.filter((_, index) => session.markedForReview[index])
    if (!markedEntries.length)
      return

    if (session.sourceSetId === 'daily')
      startDailyQuestionRoundSafely(markedEntries)
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
    if (routeName === 'quiz')
      return currentSession.value.mode === 'quiz'
    if (routeName === 'fillBlank')
      return currentSession.value.mode === 'fillBlank'
    if (routeName === 'reading')
      return currentSession.value.mode === 'reading'
    return true
  }

  return {
    sessionsByKey,
    activeKey,
    currentSession,
    currentView,
    pendingRoundSync,
    roundSyncing,
    sessionEntries,
    totalItems,
    currentIndex,
    currentEntry,
    progressCount,
    progressPercent,
    resultSummary,
    resultRows,
    saveState,
    waitForPersistence,
    resetForNamespace,
    loadState,
    clearStudyProgress,
    clearSessionsForSet,
    resetStudyView,
    returnHome,
    isResumableSession,
    resumeSession,
    isSetInProgress,
    getInProgressModes,
    getInProgressModesLabel,
    getPracticeCount,
    getAvailablePracticeCount,
    startRound,
    startDailyQuestionRound,
    handlePracticeCountChange,
    submitCurrentRound,
    finishRound,
    advanceToNext,
    handleQuizDraftChange,
    toggleReviewMark,
    restartCurrentMode,
    switchModeAfterResult,
    reviewWrongAnswers,
    reviewMarkedQuestions,
    exitCurrentView,
    hasValidSessionForRoute,
  }
})

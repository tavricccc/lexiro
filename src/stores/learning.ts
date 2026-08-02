import type { CardProgress, DailyActivity, DashboardStats, LearningProgress, QuestionStatKey, QuestionStatType, ReviewEntry, ReviewRating } from '@/types'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { DAILY_QUESTION_GOAL_OPTIONS, DAILY_WORD_GOAL_OPTIONS, LEARNING_STORAGE_KEY } from '@/constants'
import { isDue, reviewCard } from '@/lib/fsrs'
import { createDefaultStats, emptyDailyActivity, emptyQuestionStats } from '@/lib/learning-defaults'
import { loadFromStorage, saveToStorage } from '@/lib/persist'
import { normalizeDashboardStats, normalizeLearningProgress } from '@/lib/share'
import { useLibraryStore } from './library'

const LEARNING_STATE_VERSION = 1

function todayKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const useLearningStore = defineStore('learning', () => {
  const progress = ref<LearningProgress>({ cards: {}, updatedAt: new Date().toISOString() })
  const stats = ref<DashboardStats>(createDefaultStats())
  const reviewEntries = ref<ReviewEntry[]>([])
  const reviewSetId = ref<string | null>(null)
  const reviewIndex = ref(0)
  const reviewAnswered = ref(false)
  const reviewContext = ref<'daily' | 'set' | null>(null)
  const dailyCardSeeds = ref<Record<string, CardProgress | null>>({})
  const loaded = ref(false)

  const currentReviewEntry = computed(() => reviewEntries.value[reviewIndex.value] ?? null)
  const reviewTotal = computed(() => reviewEntries.value.length)
  const reviewProgress = computed(() => reviewTotal.value ? Math.round((reviewIndex.value / reviewTotal.value) * 100) : 0)
  const todayProgress = computed(() => Math.min(100, Math.round((stats.value.todayMemoryReviews / stats.value.dailyWordGoal) * 100)))
  const todayQuestionProgress = computed(() => Math.min(100, Math.round((stats.value.todayQuestionReviews / stats.value.dailyQuestionGoal) * 100)))
  const memoryAccuracy = computed(() => stats.value.totalMemoryReviews
    ? Math.round((stats.value.correctMemoryReviews / stats.value.totalMemoryReviews) * 100)
    : 0)

  function todayActivity(): DailyActivity {
    const date = todayKey()
    const existing = stats.value.dailyHistory[date]
    if (existing)
      return existing
    const created = emptyDailyActivity(date)
    stats.value.dailyHistory = { ...stats.value.dailyHistory, [date]: created }
    return created
  }

  function addXp(amount: number, activity: DailyActivity) {
    stats.value.xp += amount
    activity.xpEarned += amount
    stats.value.level = Math.floor(stats.value.xp / 100) + 1
  }

  function questionStatKey(questionType: QuestionStatType, difficulty: 1 | 2 | 3): QuestionStatKey {
    return `${questionType}:${difficulty}` as QuestionStatKey
  }

  function getCardProgress(senseId: string): CardProgress | null {
    return progress.value.cards[senseId] ?? null
  }

  function getTodayReviewedSenseIds(): string[] {
    const today = todayKey()
    return Object.entries(progress.value.cards)
      .filter(([, card]) => card.lastReview && todayKey(new Date(card.lastReview)) === today)
      .map(([senseId]) => senseId)
  }

  function replaceProgress(next: LearningProgress) {
    progress.value = {
      cards: { ...next.cards },
      updatedAt: next.updatedAt,
    }
    saveState()
  }

  function replaceStats(next: DashboardStats) {
    stats.value = {
      ...next,
      questionStats: { ...next.questionStats },
      questionStatsBySense: Object.fromEntries(Object.entries(next.questionStatsBySense).map(([senseId, value]) => [senseId, { ...value }])),
      dailyHistory: Object.fromEntries(Object.entries(next.dailyHistory).map(([date, activity]) => [date, { ...activity, questionStats: { ...activity.questionStats } }])),
    }
    saveState()
  }

  function mergeImportedState(incomingProgress: LearningProgress, incomingStats: DashboardStats) {
    const localHasActivity = Object.keys(progress.value.cards).length > 0
      || stats.value.totalMemoryReviews > 0
      || stats.value.totalQuestionReviews > 0
      || stats.value.xp > 0
    progress.value = {
      cards: { ...incomingProgress.cards, ...progress.value.cards },
      updatedAt: progress.value.updatedAt || incomingProgress.updatedAt,
    }
    if (!localHasActivity)
      stats.value = { ...incomingStats }
    pruneSenseData(new Set(Object.values(useLibraryStore().state.words).flatMap(word => word.senses.map(sense => sense.id))))
    saveState()
  }

  function pruneSenseData(liveSenseIds: Set<string>): boolean {
    const nextCards = Object.fromEntries(Object.entries(progress.value.cards).filter(([senseId]) => liveSenseIds.has(senseId)))
    const nextQuestionStatsBySense = Object.fromEntries(Object.entries(stats.value.questionStatsBySense).filter(([senseId]) => liveSenseIds.has(senseId)))
    const nextDailyCardSeeds = Object.fromEntries(Object.entries(dailyCardSeeds.value).filter(([senseId]) => liveSenseIds.has(senseId)))
    const changed = Object.keys(nextCards).length !== Object.keys(progress.value.cards).length
      || Object.keys(nextQuestionStatsBySense).length !== Object.keys(stats.value.questionStatsBySense).length
      || Object.keys(nextDailyCardSeeds).length !== Object.keys(dailyCardSeeds.value).length
    if (!changed)
      return false
    progress.value.cards = nextCards
    stats.value.questionStatsBySense = nextQuestionStatsBySense as DashboardStats['questionStatsBySense']
    dailyCardSeeds.value = nextDailyCardSeeds
    progress.value.updatedAt = new Date().toISOString()
    stats.value.updatedAt = new Date().toISOString()
    if (loaded.value)
      saveState()
    return true
  }

  function getDueEntries(setId: string, limit = 20): ReviewEntry[] {
    const now = new Date()
    const studyWords = useLibraryStore().getSetStudyWords(setId)
    const due = studyWords
      .filter((item) => {
        const card = getCardProgress(item.id)
        return Boolean(card && isDue(card, now))
      })
      .map(item => ({ setId, item, progress: getCardProgress(item.id) }))
      .sort((a, b) => new Date(a.progress?.due ?? 0).getTime() - new Date(b.progress?.due ?? 0).getTime())
    return due.slice(0, limit)
  }

  function getNewEntries(setId: string, limit = Number.MAX_SAFE_INTEGER): ReviewEntry[] {
    const studyWords = useLibraryStore().getSetStudyWords(setId)
    return studyWords
      .filter(item => !getCardProgress(item.id))
      .map(item => ({ setId, item, progress: null }))
      .slice(0, limit)
  }

  function getDueCount(setId: string): number {
    return getDueEntries(setId, Number.MAX_SAFE_INTEGER).length
  }

  function getAvailableReviewCount(setId: string): number {
    return getDueCount(setId) + getNewEntries(setId).length
  }

  function uniqueEntries(entries: ReviewEntry[]): ReviewEntry[] {
    const unique = new Map<string, ReviewEntry>()
    for (const entry of entries) {
      if (!unique.has(entry.item.id))
        unique.set(entry.item.id, entry)
    }
    return Array.from(unique.values())
  }

  function interleaveEntries(first: ReviewEntry[], second: ReviewEntry[]): ReviewEntry[] {
    const result: ReviewEntry[] = []
    const maxLength = Math.max(first.length, second.length)
    for (let index = 0; index < maxLength; index += 1) {
      if (first[index])
        result.push(first[index])
      if (second[index])
        result.push(second[index])
    }
    return result
  }

  function getDailyReviewEntries(limit = Math.max(0, stats.value.dailyWordGoal - stats.value.todayMemoryReviews)): ReviewEntry[] {
    const libraryStore = useLibraryStore()
    const dueEntries = uniqueEntries(libraryStore.sets
      .flatMap(set => getDueEntries(set.id, Number.MAX_SAFE_INTEGER)))
      .sort((a, b) => new Date(a.progress?.due ?? 0).getTime() - new Date(b.progress?.due ?? 0).getTime())
    const newEntries = uniqueEntries(libraryStore.sets.flatMap(set => getNewEntries(set.id)))
    const target = Math.min(Math.max(0, limit), dueEntries.length + newEntries.length)
    if (!target)
      return []

    const hasDueEntries = dueEntries.length > 0
    const newQuota = hasDueEntries
      ? Math.min(newEntries.length, Math.floor(target / 3))
      : Math.min(newEntries.length, target)
    const dueQuota = hasDueEntries
      ? Math.min(dueEntries.length, target - newQuota)
      : 0
    const selectedDue = dueEntries.slice(0, dueQuota)
    const selectedNew = newEntries.slice(0, newQuota)
    return interleaveEntries(selectedDue, selectedNew)
  }

  function getLearnedCount(setId: string): number {
    return useLibraryStore().getSetStudyWords(setId).filter(item => (getCardProgress(item.id)?.reviewCount ?? 0) > 0).length
  }

  function saveState() {
    saveToStorage(LEARNING_STORAGE_KEY, {
      version: LEARNING_STATE_VERSION,
      progress: progress.value,
      stats: stats.value,
    })
  }

  async function loadState() {
    if (loaded.value)
      return
    const stored = await loadFromStorage(LEARNING_STORAGE_KEY)
    if (stored.value) {
      try {
        const parsed: unknown = JSON.parse(stored.value)
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
          throw new Error('learning state must be an object')
        const source = parsed as Record<string, unknown>
        if (Object.keys(source).some(key => !['version', 'progress', 'stats'].includes(key)) || source.version !== LEARNING_STATE_VERSION)
          throw new Error('unsupported learning state')
        progress.value = normalizeLearningProgress(source.progress)
        stats.value = normalizeDashboardStats(source.stats)
      }
      catch {
        progress.value = { cards: {}, updatedAt: new Date().toISOString() }
        stats.value = createDefaultStats()
      }
    }

    const today = todayKey()
    if (stats.value.lastStudyDate !== today) {
      stats.value.todayMemoryReviews = 0
      stats.value.todayMemoryCorrectReviews = 0
      stats.value.todayQuestionReviews = 0
      stats.value.todayQuestionCorrectReviews = 0
    }
    if (!DAILY_WORD_GOAL_OPTIONS.includes(stats.value.dailyWordGoal as typeof DAILY_WORD_GOAL_OPTIONS[number]))
      stats.value.dailyWordGoal = DAILY_WORD_GOAL_OPTIONS[0]
    if (!DAILY_QUESTION_GOAL_OPTIONS.includes(stats.value.dailyQuestionGoal as typeof DAILY_QUESTION_GOAL_OPTIONS[number]))
      stats.value.dailyQuestionGoal = DAILY_QUESTION_GOAL_OPTIONS[0]
    loaded.value = true
    const liveSenseIds = new Set(Object.values(useLibraryStore().state.words).flatMap(word => word.senses.map(sense => sense.id)))
    pruneSenseData(liveSenseIds)
  }

  function setDailyWordGoal(value: number) {
    const nextGoal = DAILY_WORD_GOAL_OPTIONS.includes(value as typeof DAILY_WORD_GOAL_OPTIONS[number])
      ? value
      : DAILY_WORD_GOAL_OPTIONS[0]
    if (stats.value.dailyWordGoal === nextGoal)
      return
    stats.value.dailyWordGoal = nextGoal
    stats.value.updatedAt = new Date().toISOString()
    saveState()
  }

  function setDailyQuestionGoal(value: number) {
    const nextGoal = DAILY_QUESTION_GOAL_OPTIONS.includes(value as typeof DAILY_QUESTION_GOAL_OPTIONS[number])
      ? value
      : DAILY_QUESTION_GOAL_OPTIONS[0]
    if (stats.value.dailyQuestionGoal === nextGoal)
      return
    stats.value.dailyQuestionGoal = nextGoal
    stats.value.updatedAt = new Date().toISOString()
    saveState()
  }

  function recordQuestionResults(results: Array<{ senseId: string, questionId: string, questionType: QuestionStatType, difficulty: 1 | 2 | 3, isCorrect: boolean, marked: boolean, retry?: boolean, daily?: boolean }>) {
    if (!results.length)
      return
    const seenSenses = new Set<string>()
    const effectiveResults = results.map((result) => {
      const current = getCardProgress(result.senseId)
      const reviewedToday = current?.lastReview ? todayKey(new Date(current.lastReview)) === todayKey() : false
      const retry = Boolean(result.retry || reviewedToday || seenSenses.has(result.senseId))
      seenSenses.add(result.senseId)
      return { ...result, retry }
    })
    const correct = effectiveResults.filter(result => result.isCorrect).length
    let progressChanged = false
    const today = todayKey()
    const groupedResults = new Map<string, typeof effectiveResults>()
    for (const result of effectiveResults)
      groupedResults.set(result.senseId, [...(groupedResults.get(result.senseId) ?? []), result])
    for (const [senseId, senseResults] of groupedResults) {
      const current = getCardProgress(senseId)
      const hasSeed = Object.hasOwn(dailyCardSeeds.value, senseId)
      const seed = dailyCardSeeds.value[senseId] ?? null
      const reviewedToday = current?.lastReview ? todayKey(new Date(current.lastReview)) === today : false
      const dailyFlow = senseResults.some(result => result.daily)
      const shouldBeGood = senseResults.every(result => result.isCorrect && !result.marked)
      if (dailyFlow && hasSeed) {
        if (shouldBeGood) {
          delete dailyCardSeeds.value[senseId]
          continue
        }
        const again = reviewCard(seed, 'again')
        progress.value.cards[senseId] = {
          ...again,
          reviewCount: current?.reviewCount ?? again.reviewCount,
          correctCount: seed?.correctCount ?? again.correctCount,
        }
      }
      else {
        if (reviewedToday)
          continue
        progress.value.cards[senseId] = reviewCard(current, shouldBeGood ? 'good' : 'again')
      }
      delete dailyCardSeeds.value[senseId]
      progressChanged = true
    }
    const activity = todayActivity()
    const firstFormalActivity = stats.value.todayMemoryReviews === 0 && stats.value.todayQuestionReviews === 0
    for (const result of effectiveResults) {
      const key = questionStatKey(result.questionType, result.difficulty)
      stats.value.questionStats[key].total += 1
      stats.value.questionStats[key].correct += result.isCorrect ? 1 : 0
      stats.value.questionStats[key].retry += result.retry ? 1 : 0
      const senseStats = stats.value.questionStatsBySense[result.senseId] ?? emptyQuestionStats()
      senseStats[key].total += 1
      senseStats[key].correct += result.isCorrect ? 1 : 0
      senseStats[key].retry += result.retry ? 1 : 0
      stats.value.questionStatsBySense[result.senseId] = senseStats
      activity.questionStats[key].total += 1
      activity.questionStats[key].correct += result.isCorrect ? 1 : 0
      activity.questionStats[key].retry += result.retry ? 1 : 0
    }
    if (progressChanged)
      progress.value.updatedAt = new Date().toISOString()
    stats.value.totalQuestionReviews += effectiveResults.length
    stats.value.correctQuestionReviews += correct
    stats.value.todayQuestionReviews += effectiveResults.length
    stats.value.todayQuestionCorrectReviews += correct
    activity.questionTotal += effectiveResults.length
    activity.questionCorrect += correct
    activity.questionRetry += effectiveResults.filter(result => result.retry).length
    const xp = effectiveResults.reduce((total, result) => total + (result.retry ? 5 : 10) + (result.isCorrect && !result.marked ? 2 : 0), 0)
    addXp(xp + (firstFormalActivity ? 5 : 0), activity)
    activity.completed = true
    stats.value.updatedAt = new Date().toISOString()
    updateStreak()
    saveState()
  }

  function completePracticeSession() {
    const activity = todayActivity()
    addXp(10, activity)
    activity.completed = true
    stats.value.updatedAt = new Date().toISOString()
    updateStreak()
    saveState()
  }

  function renameSense(oldSenseId: string, newSenseId: string) {
    if (oldSenseId === newSenseId)
      return
    const oldCard = progress.value.cards[oldSenseId]
    const newCard = progress.value.cards[newSenseId]
    if (oldCard && !newCard)
      progress.value.cards[newSenseId] = oldCard
    delete progress.value.cards[oldSenseId]
    const oldStats = stats.value.questionStatsBySense[oldSenseId]
    const newStats = stats.value.questionStatsBySense[newSenseId]
    if (oldStats && !newStats)
      stats.value.questionStatsBySense[newSenseId] = oldStats
    delete stats.value.questionStatsBySense[oldSenseId]
    progress.value.updatedAt = new Date().toISOString()
    stats.value.updatedAt = new Date().toISOString()
    saveState()
  }

  function updateStreak(date = todayKey()) {
    const last = stats.value.lastStudyDate
    if (!last) {
      stats.value.streakDays = 1
    }
    else if (last !== date) {
      const previous = new Date(`${last}T00:00:00`)
      const current = new Date(`${date}T00:00:00`)
      const days = Math.round((current.getTime() - previous.getTime()) / 86400000)
      stats.value.streakDays = days === 1 ? stats.value.streakDays + 1 : 1
    }
    stats.value.lastStudyDate = date
    stats.value.longestStreak = Math.max(stats.value.longestStreak, stats.value.streakDays)
  }

  function startReview(setId: string) {
    if (!useLibraryStore().getSet(setId))
      return false
    const entries = getDueEntries(setId)
    if (!entries.length)
      return false
    reviewSetId.value = setId
    dailyCardSeeds.value = {}
    reviewContext.value = 'set'
    reviewEntries.value = entries
    reviewIndex.value = 0
    reviewAnswered.value = false
    return true
  }

  function startDailyReview() {
    const entries = getDailyReviewEntries()
    if (!entries.length)
      return false
    reviewSetId.value = null
    dailyCardSeeds.value = {}
    reviewContext.value = 'daily'
    reviewEntries.value = entries
    reviewIndex.value = 0
    reviewAnswered.value = false
    return true
  }

  function answerCurrent(rating: ReviewRating) {
    const current = currentReviewEntry.value
    if (!current || reviewAnswered.value)
      return false
    const previous = getCardProgress(current.item.id)
    const reviewedToday = previous?.lastReview ? todayKey(new Date(previous.lastReview)) === todayKey() : false
    if (reviewContext.value === 'daily' && !Object.hasOwn(dailyCardSeeds.value, current.item.id))
      dailyCardSeeds.value = { ...dailyCardSeeds.value, [current.item.id]: previous ? { ...previous } : null }
    const hasSeed = Object.hasOwn(dailyCardSeeds.value, current.item.id)
    const nextCard = hasSeed || !reviewedToday ? reviewCard(hasSeed ? dailyCardSeeds.value[current.item.id] ?? null : previous, rating) : previous
    if (nextCard) {
      progress.value.cards[current.item.id] = nextCard
      progress.value.updatedAt = new Date().toISOString()
    }
    reviewEntries.value[reviewIndex.value] = { ...current, progress: nextCard }
    reviewAnswered.value = true

    const isCorrect = rating === 'good'
    const firstFormalActivity = stats.value.todayMemoryReviews === 0 && stats.value.todayQuestionReviews === 0
    stats.value.totalMemoryReviews += 1
    stats.value.correctMemoryReviews += isCorrect ? 1 : 0
    stats.value.todayMemoryReviews += 1
    stats.value.todayMemoryCorrectReviews += isCorrect ? 1 : 0
    const activity = todayActivity()
    if (isCorrect)
      activity.memoryGood += 1
    else
      activity.memoryAgain += 1
    addXp((reviewedToday ? 5 : (isCorrect ? 12 : 10)) + (firstFormalActivity ? 5 : 0), activity)
    activity.completed = true
    stats.value.updatedAt = new Date().toISOString()
    updateStreak()
    saveState()
    return true
  }

  function nextReview() {
    if (!reviewAnswered.value)
      return false
    if (reviewIndex.value >= reviewEntries.value.length - 1) {
      completePracticeSession()
      reviewEntries.value = []
      reviewSetId.value = null
      reviewIndex.value = 0
      reviewAnswered.value = false
      reviewContext.value = null
      saveState()
      return false
    }
    reviewIndex.value += 1
    reviewAnswered.value = false
    return true
  }

  function clearReview() {
    reviewEntries.value = []
    reviewSetId.value = null
    reviewIndex.value = 0
    reviewAnswered.value = false
    reviewContext.value = null
  }

  function resetForNamespace() {
    progress.value = { cards: {}, updatedAt: new Date().toISOString() }
    stats.value = createDefaultStats()
    loaded.value = false
    dailyCardSeeds.value = {}
    clearReview()
  }

  return {
    progress,
    stats,
    loaded,
    reviewEntries,
    reviewSetId,
    reviewIndex,
    reviewAnswered,
    reviewContext,
    currentReviewEntry,
    reviewTotal,
    reviewProgress,
    todayProgress,
    todayQuestionProgress,
    memoryAccuracy,
    loadState,
    resetForNamespace,
    saveState,
    replaceProgress,
    replaceStats,
    mergeImportedState,
    pruneSenseData,
    getCardProgress,
    getTodayReviewedSenseIds,
    getDueEntries,
    getNewEntries,
    getDueCount,
    getAvailableReviewCount,
    getDailyReviewEntries,
    getLearnedCount,
    setDailyWordGoal,
    setDailyQuestionGoal,
    recordQuestionResults,
    completePracticeSession,
    renameSense,
    startReview,
    startDailyReview,
    answerCurrent,
    nextReview,
    clearReview,
  }
})

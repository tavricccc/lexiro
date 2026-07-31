import type { DashboardStats, LearningProgress, ReviewEntry, ReviewRating, VocabSet } from '@/types'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { LEARNING_STORAGE_KEY } from '@/constants'
import { isDue, reviewCard } from '@/lib/fsrs'
import { loadFromStorage, saveToStorage } from '@/lib/persist'
import { useSetsStore } from './sets'

function todayKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function defaultStats(): DashboardStats {
  return {
    totalReviews: 0,
    correctReviews: 0,
    streakDays: 0,
    longestStreak: 0,
    xp: 0,
    level: 1,
    lastStudyDate: '',
    dailyGoal: 10,
    todayReviews: 0,
    todayCorrectReviews: 0,
    achievements: [],
    updatedAt: new Date().toISOString(),
  }
}

export const useLearningStore = defineStore('learning', () => {
  const progressBySet = ref<Record<string, LearningProgress>>({})
  const stats = ref<DashboardStats>(defaultStats())
  const reviewEntries = ref<ReviewEntry[]>([])
  const reviewSetId = ref<string | null>(null)
  const reviewIndex = ref(0)
  const reviewAnswered = ref(false)
  const loaded = ref(false)

  const currentReviewEntry = computed(() => reviewEntries.value[reviewIndex.value] ?? null)
  const reviewTotal = computed(() => reviewEntries.value.length)
  const reviewProgress = computed(() => reviewTotal.value ? Math.round((reviewIndex.value / reviewTotal.value) * 100) : 0)
  const todayProgress = computed(() => Math.min(100, Math.round((stats.value.todayReviews / stats.value.dailyGoal) * 100)))
  const accuracy = computed(() => stats.value.totalReviews
    ? Math.round((stats.value.correctReviews / stats.value.totalReviews) * 100)
    : 0)

  function ensureProgress(setId: string): LearningProgress {
    const existing = progressBySet.value[setId]
    if (existing)
      return existing
    const created: LearningProgress = { setId, cards: {}, updatedAt: new Date().toISOString() }
    progressBySet.value = { ...progressBySet.value, [setId]: created }
    return created
  }

  function getSetProgress(setId: string): LearningProgress {
    return ensureProgress(setId)
  }

  function getDueEntries(set: VocabSet, limit = 20): ReviewEntry[] {
    const progress = getSetProgress(set.id)
    const now = new Date()
    const due = set.items
      .filter(item => isDue(progress.cards[item.id] ?? null, now))
      .map(item => ({ item, progress: progress.cards[item.id] ?? null }))
    return due.slice(0, limit)
  }

  function getDueCount(set: VocabSet): number {
    return getDueEntries(set, Number.MAX_SAFE_INTEGER).length
  }

  function getMasteryPercent(set: VocabSet): number {
    if (!set.items.length)
      return 0
    const progress = getSetProgress(set.id)
    const scores = set.items.map((item) => {
      const card = progress.cards[item.id]
      if (!card)
        return 0
      return Math.min(100, Math.round((card.stability / 30) * 100))
    })
    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
  }

  function saveState() {
    saveToStorage(LEARNING_STORAGE_KEY, {
      version: 1,
      progressBySet: progressBySet.value,
      stats: stats.value,
    })
  }

  async function loadState() {
    if (loaded.value)
      return
    const stored = await loadFromStorage(LEARNING_STORAGE_KEY)
    if (stored.value) {
      try {
        const parsed = JSON.parse(stored.value) as Record<string, unknown>
        if (parsed.progressBySet && typeof parsed.progressBySet === 'object')
          progressBySet.value = parsed.progressBySet as Record<string, LearningProgress>
        if (parsed.stats && typeof parsed.stats === 'object')
          stats.value = { ...defaultStats(), ...parsed.stats as Partial<DashboardStats> }
      }
      catch {
        // Ignore invalid legacy progress and start clean.
      }
    }
    const today = todayKey()
    if (stats.value.lastStudyDate !== today)
      stats.value.todayReviews = 0
    if (stats.value.lastStudyDate !== today)
      stats.value.todayCorrectReviews = 0
    loaded.value = true
  }

  function unlockAchievements() {
    const existing = new Set(stats.value.achievements.map(item => item.id))
    const learnedWords = Object.values(progressBySet.value).reduce((total, progress) => total + Object.values(progress.cards).filter(card => card.reviewCount > 0).length, 0)
    const candidates = [
      { id: 'first-review', condition: stats.value.totalReviews >= 1, titleKey: 'learning.achievementFirstTitle', descriptionKey: 'learning.achievementFirstDescription' },
      { id: 'streak-3', condition: stats.value.longestStreak >= 3, titleKey: 'learning.achievementStreak3Title', descriptionKey: 'learning.achievementStreak3Description' },
      { id: 'streak-7', condition: stats.value.longestStreak >= 7, titleKey: 'learning.achievementStreak7Title', descriptionKey: 'learning.achievementStreak7Description' },
      { id: 'streak-30', condition: stats.value.longestStreak >= 30, titleKey: 'learning.achievementStreak30Title', descriptionKey: 'learning.achievementStreak30Description' },
      { id: 'reviews-100', condition: stats.value.totalReviews >= 100, titleKey: 'learning.achievementReviews100Title', descriptionKey: 'learning.achievementReviews100Description' },
      { id: 'words-100', condition: learnedWords >= 100, titleKey: 'learning.achievementWords100Title', descriptionKey: 'learning.achievementWords100Description' },
      { id: 'perfect-day', condition: stats.value.todayReviews > 0 && stats.value.todayCorrectReviews === stats.value.todayReviews, titleKey: 'learning.achievementPerfectDayTitle', descriptionKey: 'learning.achievementPerfectDayDescription' },
      { id: 'perfect-goal', condition: stats.value.todayReviews >= stats.value.dailyGoal, titleKey: 'learning.achievementDailyGoalTitle', descriptionKey: 'learning.achievementDailyGoalDescription' },
    ]
    const newlyUnlocked = candidates.filter(item => item.condition && !existing.has(item.id))
    if (!newlyUnlocked.length)
      return
    stats.value.achievements = [
      ...stats.value.achievements,
      ...newlyUnlocked.map(item => ({
        id: item.id,
        titleKey: item.titleKey,
        descriptionKey: item.descriptionKey,
        unlockedAt: new Date().toISOString(),
      })),
    ]
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
    const setsStore = useSetsStore()
    const set = setsStore.sets.find(item => item.id === setId)
    if (!set)
      return false
    const entries = getDueEntries(set)
    if (!entries.length)
      return false
    reviewSetId.value = setId
    reviewEntries.value = entries
    reviewIndex.value = 0
    reviewAnswered.value = false
    return true
  }

  function answerCurrent(rating: ReviewRating) {
    const current = currentReviewEntry.value
    if (!current || !reviewSetId.value || reviewAnswered.value)
      return false
    const progress = ensureProgress(reviewSetId.value)
    const nextCard = reviewCard(current.progress, rating)
    progress.cards[current.item.id] = nextCard
    progress.updatedAt = new Date().toISOString()
    reviewEntries.value[reviewIndex.value] = { ...current, progress: nextCard }
    reviewAnswered.value = true

    const isCorrect = rating !== 'again'
    stats.value.totalReviews += 1
    stats.value.correctReviews += isCorrect ? 1 : 0
    stats.value.todayReviews += 1
    stats.value.todayCorrectReviews += isCorrect ? 1 : 0
    stats.value.xp += rating === 'easy' ? 15 : rating === 'good' ? 10 : rating === 'hard' ? 6 : 3
    stats.value.level = Math.floor(stats.value.xp / 100) + 1
    stats.value.updatedAt = new Date().toISOString()
    updateStreak()
    unlockAchievements()
    saveState()
    return true
  }

  function nextReview() {
    if (!reviewAnswered.value)
      return false
    if (reviewIndex.value >= reviewEntries.value.length - 1) {
      reviewEntries.value = []
      reviewSetId.value = null
      reviewIndex.value = 0
      reviewAnswered.value = false
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
  }

  return {
    progressBySet,
    stats,
    reviewEntries,
    reviewSetId,
    reviewIndex,
    reviewAnswered,
    currentReviewEntry,
    reviewTotal,
    reviewProgress,
    todayProgress,
    accuracy,
    loadState,
    saveState,
    getSetProgress,
    getDueEntries,
    getDueCount,
    getMasteryPercent,
    startReview,
    answerCurrent,
    nextReview,
    clearReview,
  }
})

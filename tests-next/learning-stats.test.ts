import type { DashboardStats } from '@/types'
import { describe, expect, it } from 'vitest'
import { estimateJsonBytes } from '@/src/lib/hash'
import { asSenseId } from '@/src/lib/library'
import {
  addQuestionAttempt,
  countActiveDays,
  createDefaultStats,
  DAILY_HISTORY_RETENTION_DAYS,
  emptyDailyActivity,
  emptyQuestionStats,
  pruneDailyHistory,
  QUESTION_STAT_KEYS,
  questionStatRow,
  rollStatsToToday,
  sumQuestionStats,
} from '@/src/lib/learning-defaults'
import { normalizeDashboardStats } from '@/src/lib/share'

describe('sparse question stats', () => {
  it('starts empty and grows only with what was practised', () => {
    const totals = addQuestionAttempt(addQuestionAttempt(emptyQuestionStats(), 'vocabulary:2', true, false), 'vocabulary:2', false, true)
    expect(Object.keys(totals)).toEqual(['vocabulary:2'])
    expect(totals['vocabulary:2']).toEqual({ total: 2, correct: 1, retry: 1 })
    expect(questionStatRow(totals, 'reading:3')).toEqual({ total: 0, correct: 0, retry: 0 })
  })

  it('keeps a per-sense row far smaller than the dense shape', () => {
    const dense = Object.fromEntries(QUESTION_STAT_KEYS.map(key => [key, { total: 0, correct: 0, retry: 0 }]))
    const sparse = addQuestionAttempt(emptyQuestionStats(), 'grammar:1', true, false)
    expect(estimateJsonBytes(sparse) * 10).toBeLessThan(estimateJsonBytes(dense))
  })

  it('normalizes a sparse document and drops rows that record nothing', () => {
    const stats = normalizeDashboardStats({
      ...createDefaultStats(),
      questionStatsBySense: { [asSenseId('sense-a')]: { 'cloze:1': { total: 3, correct: 2, retry: 0 }, 'reading:2': { total: 0, correct: 0, retry: 0 } }, [asSenseId('sense-b')]: {} },
    } satisfies DashboardStats)
    expect(Object.keys(stats.questionStatsBySense)).toEqual(['sense-a'])
    expect(Object.keys(stats.questionStatsBySense[asSenseId('sense-a')] ?? {})).toEqual(['cloze:1'])
  })

  it('rejects a stat key that is not a known format', () => {
    expect(() => normalizeDashboardStats({
      ...createDefaultStats(),
      questionStatsBySense: { [asSenseId('sense-a')]: { 'made-up:1': { total: 1, correct: 1, retry: 0 } } },
    } as unknown)).toThrow()
  })

  it('sums several senses into one account-wide breakdown', () => {
    const totals = sumQuestionStats([
      { 'cloze:1': { total: 3, correct: 2, retry: 0 } },
      { 'cloze:1': { total: 1, correct: 0, retry: 1 }, 'grammar:2': { total: 2, correct: 2, retry: 0 } },
    ])
    expect(totals['cloze:1']).toEqual({ total: 4, correct: 2, retry: 1 })
    expect(totals['grammar:2']).toEqual({ total: 2, correct: 2, retry: 0 })
  })
})

describe('rollStatsToToday', () => {
  const now = new Date('2026-09-13T09:00:00')
  const at = (lastStudyDate: string, patch: Partial<DashboardStats> = {}) =>
    rollStatsToToday({ ...createDefaultStats(), lastStudyDate, longestStreak: 4, streakDays: 4, ...patch }, now)

  it('leaves the day alone once it has already rolled over', () => {
    const stats = { ...createDefaultStats(), lastStudyDate: '2026-09-13', todayMemoryReviews: 6 }
    expect(rollStatsToToday(stats, now)).toBe(stats)
  })

  it('extends the streak after practising yesterday', () => {
    expect(at('2026-09-12').streakDays).toBe(5)
  })

  it('spends a day back to survive one missed day', () => {
    const rolled = at('2026-09-11', { streakFreezes: 1 })
    expect(rolled.streakDays).toBe(5)
    expect(rolled.streakFreezes).toBe(0)
  })

  it('restarts the streak when a day is missed with nothing to spend', () => {
    const rolled = at('2026-09-11', { streakFreezes: 0 })
    expect(rolled.streakDays).toBe(1)
    expect(rolled.longestStreak).toBe(4)
  })

  it('restarts the streak after a longer absence even with days in hand', () => {
    const rolled = at('2026-08-30', { streakFreezes: 2 })
    expect(rolled.streakDays).toBe(1)
    expect(rolled.streakFreezes).toBe(2)
  })

  it('earns a day back every full week and holds no more than the reserve', () => {
    expect(at('2026-09-12', { streakDays: 6 }).streakFreezes).toBe(1)
    expect(at('2026-09-12', { streakDays: 13, streakFreezes: 2 }).streakFreezes).toBe(2)
  })

  it('clears the previous day counters so today starts from nothing', () => {
    const rolled = at('2026-09-12', { todayMemoryReviews: 20, todayQuestionReviews: 9 })
    expect(rolled.todayMemoryReviews).toBe(0)
    expect(rolled.todayQuestionReviews).toBe(0)
  })
})

describe('countActiveDays', () => {
  const today = new Date('2026-09-13T09:00:00')

  it('counts only the days inside the window that saw an answer', () => {
    const history = {
      '2026-09-13': { ...emptyDailyActivity('2026-09-13'), memoryGood: 4 },
      '2026-09-11': { ...emptyDailyActivity('2026-09-11'), questionTotal: 2 },
      '2026-09-10': emptyDailyActivity('2026-09-10'),
      '2026-09-01': { ...emptyDailyActivity('2026-09-01'), memoryAgain: 9 },
    }
    expect(countActiveDays(history, 7, today)).toBe(2)
  })

  it('counts nothing when the window holds no activity', () => {
    expect(countActiveDays({}, 7, today)).toBe(0)
  })
})

describe('pruneDailyHistory', () => {
  const history = (dates: string[]): DashboardStats['dailyHistory'] =>
    Object.fromEntries(dates.map(date => [date, emptyDailyActivity(date)]))

  it('keeps recent days and drops what is past the retention window', () => {
    const pruned = pruneDailyHistory(history(['2024-01-01', '2026-09-01', '2026-09-10']), '2026-09-10', 30)
    expect(Object.keys(pruned).toSorted()).toEqual(['2026-09-01', '2026-09-10'])
  })

  it('returns the same object when nothing is stale', () => {
    const original = history(['2026-09-09', '2026-09-10'])
    expect(pruneDailyHistory(original, '2026-09-10')).toBe(original)
  })

  it('keeps enough days to draw the fortnight chart with room to spare', () => {
    expect(DAILY_HISTORY_RETENTION_DAYS).toBeGreaterThan(14)
  })
})

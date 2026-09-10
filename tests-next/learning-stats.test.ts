import type { DashboardStats } from '@/types'
import { describe, expect, it } from 'vitest'
import { estimateJsonBytes } from '@/src/lib/hash'
import { asSenseId } from '@/src/lib/library'
import {
  addQuestionAttempt,
  createDefaultStats,
  DAILY_HISTORY_RETENTION_DAYS,
  emptyDailyActivity,
  emptyQuestionStats,
  pruneDailyHistory,
  QUESTION_STAT_KEYS,
  questionStatRow,
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
      questionStats: { 'cloze:1': { total: 3, correct: 2, retry: 0 }, 'reading:2': { total: 0, correct: 0, retry: 0 } },
      questionStatsBySense: { [asSenseId('sense-a')]: { 'cloze:1': { total: 3, correct: 2, retry: 0 } }, [asSenseId('sense-b')]: {} },
    } satisfies DashboardStats)
    expect(Object.keys(stats.questionStats)).toEqual(['cloze:1'])
    expect(Object.keys(stats.questionStatsBySense)).toEqual(['sense-a'])
  })

  it('rejects a stat key that is not a known format', () => {
    expect(() => normalizeDashboardStats({
      ...createDefaultStats(),
      questionStats: { 'made-up:1': { total: 1, correct: 1, retry: 0 } },
    } as unknown)).toThrow()
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

  it('keeps more than a year so streaks and charts stay intact', () => {
    expect(DAILY_HISTORY_RETENTION_DAYS).toBeGreaterThan(365)
  })
})

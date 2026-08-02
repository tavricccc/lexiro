import { describe, expect, it } from 'vitest'
import { createInitialProgress, isDue, reviewCard } from '@/lib/fsrs'

describe('fsrs learning progress', () => {
  it('creates a new card due immediately', () => {
    const progress = createInitialProgress(new Date('2026-01-01T00:00:00.000Z'))
    expect(progress.reviewCount).toBe(0)
    expect(isDue(progress, new Date('2026-01-01T00:00:01.000Z'))).toBe(true)
  })

  it('advances a good review and records accuracy', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    const next = reviewCard(null, 'good', now)
    expect(next.reviewCount).toBe(1)
    expect(next.correctCount).toBe(1)
    expect(new Date(next.due).getTime()).toBeGreaterThan(now.getTime())
  })

  it('keeps again cards due sooner than good cards', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    const again = reviewCard(null, 'again', now)
    const good = reviewCard(null, 'good', now)
    expect(new Date(again.due).getTime()).toBeLessThan(new Date(good.due).getTime())
  })
})

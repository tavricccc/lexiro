import { describe, expect, it } from 'vitest'

import { isSameLocalDay, localDateKey } from '@/src/lib/date'

describe('local date keys', () => {
  it('uses a stable YYYY-MM-DD key without locale-dependent formatting', () => {
    expect(localDateKey(new Date(2026, 0, 2, 23, 59))).toBe('2026-01-02')
  })

  it('compares calendar days in the local timezone', () => {
    expect(isSameLocalDay(new Date(2026, 0, 2, 1), new Date(2026, 0, 2, 22))).toBe(true)
    expect(isSameLocalDay(new Date(2026, 0, 2, 23), new Date(2026, 0, 3, 0))).toBe(false)
  })
})

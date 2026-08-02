import { describe, expect, it } from 'vitest'
import { allocateDailyQuestionQuotas } from '@/lib/question-distribution'

describe('daily question quotas', () => {
  it('allocates integer quotas in 40/40/20 order', () => {
    expect(allocateDailyQuestionQuotas(1)).toEqual([1, 0, 0])
    expect(allocateDailyQuestionQuotas(2)).toEqual([1, 1, 0])
    expect(allocateDailyQuestionQuotas(3)).toEqual([1, 1, 1])
    expect(allocateDailyQuestionQuotas(4)).toEqual([2, 1, 1])
    expect(allocateDailyQuestionQuotas(8)).toEqual([3, 3, 2])
    expect(allocateDailyQuestionQuotas(10)).toEqual([4, 4, 2])
  })

  it('never allocates a negative or fractional target', () => {
    expect(allocateDailyQuestionQuotas(-1)).toEqual([0, 0, 0])
    expect(allocateDailyQuestionQuotas(4.9).reduce((sum, quota) => sum + quota, 0)).toBe(4)
  })
})

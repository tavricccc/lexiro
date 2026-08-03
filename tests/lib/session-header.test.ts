import type { PracticeMode } from '@/types'
import { describe, expect, it } from 'vitest'
import { createSessionHeaderModel } from '@/lib/session-header'

const translations: Record<string, string> = {
  'practice.dailyPractice': '每日練習',
  'learning.todayReview': '每日複習',
  'practice.quiz': '選擇題',
  'practice.fillBlank': '填空題',
  'practice.reading': '閱讀題',
}

function createModel(options: {
  daily?: boolean
  setName?: string
  mode?: PracticeMode | 'review'
  current?: number
  total?: number
  result?: boolean
} = {}) {
  return createSessionHeaderModel({
    daily: options.daily ?? false,
    setName: options.setName ?? '核心單字',
    mode: options.mode ?? 'quiz',
    current: options.current ?? 1,
    total: options.total ?? 4,
    result: options.result ?? false,
    translate: key => translations[key] ?? key,
  })
}

describe('createSessionHeaderModel', () => {
  it.each([
    ['review', '每日複習'],
    ['quiz', '選擇題'],
  ] as const)('uses the daily title for the %s flow', (mode, subtitle) => {
    expect(createModel({ daily: true, mode })).toMatchObject({
      title: '每日練習',
      subtitle,
      showProgress: true,
    })
  })

  it('uses the set name and practice mode for a set flow', () => {
    expect(createModel({ mode: 'fillBlank' })).toMatchObject({
      title: '核心單字',
      subtitle: '填空題',
      progress: 25,
    })
  })

  it('hides result progress without changing the session identity', () => {
    const active = createModel({ mode: 'reading' })
    const result = createModel({ mode: 'reading', result: true })

    expect(result).toMatchObject({
      title: active.title,
      subtitle: active.subtitle,
      showProgress: false,
    })
  })
})

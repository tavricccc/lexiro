import type { PracticeMode, SessionHeaderModel } from '@/types'

interface SessionHeaderInput {
  daily: boolean
  setName: string
  mode: PracticeMode | 'review'
  current: number
  total: number
  result: boolean
  translate: (key: string) => string
}

function modeTranslationKey(mode: SessionHeaderInput['mode']): string {
  if (mode === 'review')
    return 'learning.todayReview'
  if (mode === 'fillBlank')
    return 'practice.fillBlank'
  if (mode === 'reading')
    return 'practice.reading'
  return 'practice.quiz'
}

export function createSessionHeaderModel(input: SessionHeaderInput): SessionHeaderModel {
  const total = Math.max(0, input.total)
  const current = total > 0 ? Math.min(Math.max(input.current, 0), total - 1) : 0
  return {
    title: input.daily ? input.translate('practice.dailyPractice') : input.setName,
    subtitle: input.translate(modeTranslationKey(input.mode)),
    current,
    total,
    progress: total > 0 ? Math.round((current / total) * 100) : 0,
    showProgress: !input.result && total > 0,
  }
}

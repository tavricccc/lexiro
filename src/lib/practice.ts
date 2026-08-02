import type { PracticeMode } from '@/types'

const PRACTICE_MODE_ORDER: PracticeMode[] = ['quiz', 'fillBlank', 'reading']

export function nextPracticeMode(mode: PracticeMode): PracticeMode {
  const index = PRACTICE_MODE_ORDER.indexOf(mode)
  return PRACTICE_MODE_ORDER[(index + 1) % PRACTICE_MODE_ORDER.length]
}

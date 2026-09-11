import type { GeneratedQuestionKind } from '../types/library'
import type { PracticeCardTask, PracticeTask, PracticeTrack } from '../types/session'

/**
 * A session belongs to one track. 每日複習 draws the words FSRS says are due and
 * asks them as cards; 做題目 draws from the saved question bank. The track is
 * the first thing the setup screen asks, and it decides which of the two task
 * lists below the rest of the screen is choosing from.
 */
export const PRACTICE_TRACKS: PracticeTrack[] = ['fsrs', 'questions']

/** How a due word is asked. Picking both is the "隨機混合" option. */
export const PRACTICE_CARD_TASKS: PracticeCardTask[] = ['flashcard', 'spelling']

/** Question formats, in 學測 paper order. */
export const PRACTICE_QUESTION_TASKS: GeneratedQuestionKind[] = [
  'vocabulary',
  'grammar',
  'cloze',
  'wordBank',
  'discourse',
  'reading',
]

export const PRACTICE_TASKS: PracticeTask[] = [...PRACTICE_CARD_TASKS, ...PRACTICE_QUESTION_TASKS]

export const DEFAULT_CARD_TASKS: PracticeCardTask[] = ['flashcard']
export const DEFAULT_QUESTION_TASKS: GeneratedQuestionKind[] = [...PRACTICE_QUESTION_TASKS]

export function isPracticeTask(value: unknown): value is PracticeTask {
  return typeof value === 'string' && PRACTICE_TASKS.includes(value as PracticeTask)
}

export function isCardTask(task: PracticeTask): task is PracticeCardTask {
  return PRACTICE_CARD_TASKS.includes(task as PracticeCardTask)
}

export function trackOfTask(task: PracticeTask): PracticeTrack {
  return isCardTask(task) ? 'fsrs' : 'questions'
}

/** Keeps a task list in the canonical order, de-duplicated. */
export function orderPracticeTasks(tasks: readonly PracticeTask[]): PracticeTask[] {
  return PRACTICE_TASKS.filter((task) => tasks.includes(task))
}

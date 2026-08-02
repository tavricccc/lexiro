import type { QuestionDifficulty } from './library'

export type PracticeQuestionType = 'standard' | 'fillBlank' | 'reading'
export type PracticeDifficulty = QuestionDifficulty | 'all'

export interface PracticeQuestion {
  questionId: string
  questionType: PracticeQuestionType
  difficulty: QuestionDifficulty
  prompt: string
  options: string[]
  answerIndex: number
}

export interface EditorItem {
  id: string
  word: string
  senses: EditorSenseDraft[]
}

export interface EditorSenseDraft {
  id: string
  pos: string
  meaning: string
  examples: string[]
}

export interface WordDraft {
  word: string
  senses: EditorSenseDraft[]
}

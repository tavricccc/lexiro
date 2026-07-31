import type { Question, VocabItem } from './set'

export type PracticeMode = 'quiz' | 'cloze' | 'reading' | 'spelling'
export type SessionStatus = 'in-progress' | 'completed'

export interface SessionEntry {
  item: VocabItem
  question?: Question
  originalIndex: number
  readingPassage?: string
}

export interface QuizDraft {
  selectedIndex: number | null
  answered: boolean
}

export interface SpellingDraft {
  answer: string
  submitted: boolean
}

export type Draft = QuizDraft | SpellingDraft | null

export interface QuizRecord {
  type: 'quiz'
  selectedIndex: number | null
  userAnswer: string
  correctAnswer: string
  isCorrect: boolean
  skipped: boolean
}

export interface SpellingRecord {
  type: 'spelling'
  userAnswer: string
  correctAnswer: string
  isCorrect: boolean
  skipped: boolean
}

export type AnswerRecord = QuizRecord | SpellingRecord

export interface PracticeSession {
  sourceSetId: string
  mode: PracticeMode
  entries: SessionEntry[]
  index: number
  correctCount: number
  wrongEntries: SessionEntry[]
  answers: AnswerRecord[]
  drafts: Draft[]
  markedForReview: boolean[]
  review: boolean
  status: SessionStatus
}

export interface ResultSummary {
  mode: PracticeMode
  review: boolean
  total: number
  correctCount: number
  wrongCount: number
  markedCount: number
  score: number
}

export interface ResultRow {
  entry: SessionEntry
  record: AnswerRecord | null
  index: number
}

import type { StudyWord } from './library'
import type { PracticeQuestion } from './set'

export type PracticeMode = 'quiz' | 'fillBlank' | 'reading'
export type SessionStatus = 'in-progress' | 'completed'

export interface SessionHeaderModel {
  title: string
  subtitle: string
  current: number
  total: number
  progress: number
  showProgress: boolean
}

export interface SessionEntry {
  item: StudyWord
  question?: PracticeQuestion
  originalIndex: number
  readingPassage?: string
  readingPackId?: string
}

export interface QuizDraft {
  selectedIndex: number | null
  answered: boolean
}

export type Draft = QuizDraft | null

export interface QuizRecord {
  type: 'quiz'
  selectedIndex: number | null
  userAnswer: string
  correctAnswer: string
  isCorrect: boolean
  skipped: boolean
}

export type AnswerRecord = QuizRecord

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

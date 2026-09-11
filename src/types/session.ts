import type { GeneratedQuestionKind, SenseId, StudyWord } from './library'
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

/**
 * A session belongs to one track, and within it asks for one or more tasks.
 * 每日複習 asks the words FSRS has scheduled, as cards or as spelling or as a
 * mix of both; 做題目 asks any combination of the exam formats.
 */
export type PracticeTrack = 'fsrs' | 'questions'
export type PracticeCardTask = 'flashcard' | 'spelling'
export type PracticeTask = PracticeCardTask | GeneratedQuestionKind

export type WorkspaceQuestionDifficulty = 'all' | '1' | '2' | '3'

export interface PracticeSessionSnapshot {
  schemaVersion: 3
  /** Homogeneous: every task in a session belongs to the same track. */
  tasks: PracticeTask[]
  setId: string
  amount: number
  index: number
  correct: number
  wrong: number[]
  skipped: number[]
  marked: number[]
  selected: number | null
  revealed: boolean
  difficulty: WorkspaceQuestionDifficulty
  /** Composite entry ids, not sense ids: see `practiceEntryId`. */
  entryIds: string[]
  failedSenseIds: SenseId[]
  retrying: boolean
  answerChoices: Array<number | null>
}

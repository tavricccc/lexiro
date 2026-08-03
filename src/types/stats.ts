import type { LibrarySet } from './library'

export interface StatsMemorySummary {
  total: number
  correct: number
  accuracy: number
}

export interface FsrsStatusCounts {
  unlearned: number
  learning: number
  scheduled: number
  due: number
}

export interface StatsQuestionRow {
  key: string
  label: string
  difficulty: string
  total: number
  correct: number
  retry: number
  accuracy: number
}

export interface StatsSetRow {
  set: LibrarySet
  learned: number
  due: number
  total: number
}

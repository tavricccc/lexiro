export type QuestionDifficulty = 1 | 2 | 3
export type VocabularyQuestionTypeFilter = 'all' | 'standard' | 'fillBlank' | 'reading'
export type VocabularyDifficultyFilter = 'all' | '1' | '2' | '3'

export interface WordSense {
  id: string
  pos: string
  meaningZh: string
  examples: string[]
}

export interface SenseEditValue {
  pos: string
  meaningZh: string
  examples: string[]
}

export interface WordEntry {
  wordKey: string
  word: string
  senses: WordSense[]
  updatedAt: string
}

export interface StudyWord {
  id: string
  wordKey: string
  word: string
  pos: string
  meaning: string
  examples: string[]
  example: string
}

export interface LibrarySet {
  id: string
  setName: string
  folderId: string
  createdAt: string
  updatedAt: string
}

/** Lightweight metadata kept in the Library index. Content is loaded on demand. */
export interface LibrarySetSummary extends LibrarySet {
  wordCount: number
  senseCount: number
  questionCount: number
}

export interface LibrarySearchEntry {
  setId: string
  setName: string
  normalizedSetName: string
  terms: string[]
}

export interface LibraryIndex {
  schemaVersion: 1
  generation: string
  updatedAt: string
  folders: VocabFolder[]
  sets: LibrarySetSummary[]
  searchIndex: LibrarySearchEntry[]
}

export interface SetMembership {
  wordKey: string
  senseIds: string[]
}

export interface VocabFolder {
  id: string
  name: string
  parentId?: string
  order: number
  createdAt: string
  updatedAt: string
}

export interface LibraryQuestionBase {
  id: string
  fingerprint: string
  difficulty: QuestionDifficulty
  explanation?: string
  createdAt: string
  updatedAt: string
}

export interface MultipleChoiceQuestion extends LibraryQuestionBase {
  kind: 'multipleChoice'
  questionStyle: 'standard' | 'fillBlank'
  wordKey: string
  senseId: string
  prompt: string
  options: string[]
  answerIndex: number
  trap?: string
  whyWrong?: Record<string, string>
}

export interface ReadingChildQuestion {
  id: string
  kind: 'multipleChoice'
  prompt: string
  options: string[]
  answerIndex: number
  wordKey: string
  senseId: string
}

export interface ReadingPack extends LibraryQuestionBase {
  kind: 'reading'
  title: string
  passage: string
  wordKeys: string[]
  questions: ReadingChildQuestion[]
}

export type LibraryQuestion = MultipleChoiceQuestion | ReadingPack

export interface LibraryState {
  version: number
  words: Record<string, WordEntry>
  sets: LibrarySet[]
  memberships: Record<string, SetMembership[]>
  folders: VocabFolder[]
  questions: LibraryQuestion[]
  updatedAt: string
}

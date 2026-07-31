export type LibraryDataSource = 'user' | 'dictionary' | 'import' | 'ai'

export interface WordSense {
  id: string
  pos: string
  meaningZh: string
  definitionEn?: string
  examples: string[]
  source?: LibraryDataSource
  createdAt?: string
  updatedAt?: string
}

export interface WordEntry {
  wordKey: string
  word: string
  senses: WordSense[]
  phonetic?: string
  audioUrl?: string
  origin?: string
  dictionarySource?: string
  synonyms: string[]
  antonyms: string[]
  metadata?: Record<string, unknown>
  updatedAt: string
}

export interface VocabSetMember {
  wordKey: string
  senseIds: string[]
  tags: string[]
  note?: string
  favorite?: boolean
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
  wordKey?: string
  senseId?: string
  source?: LibraryDataSource
  sourceType?: string
  difficulty?: number
  explanation?: string
  createdAt: string
  updatedAt: string
}

export interface MultipleChoiceQuestion extends LibraryQuestionBase {
  kind: 'multipleChoice'
  questionStyle?: 'standard' | 'fillBlank'
  prompt: string
  options: string[]
  answerIndex: number
  trap?: string
  whyWrong?: Record<string, string>
}

export interface ClozeQuestion extends LibraryQuestionBase {
  kind: 'cloze'
  prompt: string
  answers: string[]
  options?: string[]
}

export interface ReadingChildQuestion {
  id: string
  kind: 'multipleChoice' | 'cloze'
  prompt: string
  options?: string[]
  answerIndex?: number
  answers?: string[]
  wordKey?: string
  senseId?: string
}

export interface ReadingPack extends LibraryQuestionBase {
  kind: 'reading'
  title: string
  passage: string
  wordKeys: string[]
  questions: ReadingChildQuestion[]
}

export type LibraryQuestion = MultipleChoiceQuestion | ClozeQuestion | ReadingPack

export interface LibraryState {
  version: number
  words: Record<string, WordEntry>
  memberships: Record<string, VocabSetMember[]>
  folders: VocabFolder[]
  questions: LibraryQuestion[]
  updatedAt: string
}

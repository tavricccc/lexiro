export interface Question {
  prompt: string
  opts: string[]
  ans: number
}

export interface VocabItem {
  id: string
  word: string
  pos: string
  meaning: string
  example: string
  question: Question
  definition?: string
  phonetic?: string
  audioUrl?: string
  origin?: string
  dictionarySource?: string
  synonyms?: string[]
  antonyms?: string[]
  note?: string
  tags?: string[]
  favorite?: boolean
}

export interface VocabSet {
  id: string
  setName: string
  difficulty: number
  items: VocabItem[]
  createdAt?: string
  updatedAt?: string
}

export interface EditorItem {
  id: string
  word: string
  pos: string
  meaning: string
  example: string
  definition?: string
  phonetic?: string
  audioUrl?: string
  origin?: string
  dictionarySource?: string
  synonyms?: string[]
  antonyms?: string[]
  note?: string
  tags?: string[]
  favorite?: boolean
  question: EditorQuestion
}

export interface EditorQuestion {
  prompt: string
  opts: string[]
  ans: number
}

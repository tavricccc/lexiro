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
  folderId?: string
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
}

export interface WordDraft {
  word: string
  pos: string
  meaning: string
}

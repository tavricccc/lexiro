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
  tags?: string[]
  favorite?: boolean
  question: EditorQuestion
}

export interface EditorQuestion {
  prompt: string
  opts: string[]
  ans: number
}

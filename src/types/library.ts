export type QuestionDifficulty = 1 | 2 | 3
export type QuestionCreateChoice = 'question' | 'reading'
export type VocabularyDifficultyFilter = 'all' | '1' | '2' | '3'

/**
 * Single-sentence formats. Both are one sentence with one blank and four
 * options, which is how 詞彙題 and 文法題 appear on a Taiwanese paper; they
 * differ in what the blank tests, not in shape.
 */
export type QuestionStyle = 'vocabulary' | 'grammar'

/**
 * Passage formats, named for the 學測 sections they model. `reading` asks about
 * the passage; the other three cut blanks into it.
 */
export type PassageFormat = 'reading' | 'cloze' | 'wordBank' | 'discourse'

/** What the generator can be asked to produce. */
export type GeneratedQuestionKind = QuestionStyle | PassageFormat

export type VocabularyQuestionTypeFilter = 'all' | QuestionStyle | PassageFormat

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
  questionStyle: QuestionStyle
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
  /** For blank formats, the 1-based blank this item fills. */
  blank?: number
  prompt: string
  options: string[]
  answerIndex: number
  wordKey: string
  senseId: string
}

/**
 * One passage and the items hanging off it. The four 學測 passage sections
 * share this record because they differ only in how the options are offered:
 * `reading` asks questions about the passage, `cloze` gives every blank its own
 * four options, and `wordBank` / `discourse` draw every blank from one
 * `optionBank` in which each entry may be used at most once.
 */
export interface ReadingPack extends LibraryQuestionBase {
  kind: 'reading'
  format: PassageFormat
  title: string
  passage: string
  wordKeys: string[]
  questions: ReadingChildQuestion[]
  optionBank?: string[]
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

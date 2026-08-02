import type { EditorItem, EditorSenseDraft, PracticeQuestion, PracticeSession, QuizRecord, SessionEntry, StudyWord, WordDraft } from '@/types'
import { hasOnlyKeys, isRecord } from './schema'

function generateEditorId(): string {
  return `editor-${crypto.randomUUID()}`
}

export function createBlankSenseDraft(): EditorSenseDraft {
  return { id: `sense-editor-${crypto.randomUUID()}`, pos: '', meaning: '', examples: [] }
}

export function containsHan(value: string): boolean {
  return /[\u3400-\u9FFF]/u.test(value)
}

export function getFilledWordDrafts(items: WordDraft[]): WordDraft[] {
  return items.filter(item => item.word.trim() || item.senses.some(sense => sense.pos.trim() || sense.meaning.trim() || sense.examples.some(example => example.trim())))
}

export function areWordDraftsComplete(items: WordDraft[]): boolean {
  return items.length > 0 && items.every(item => item.word.trim() && item.senses.length > 0 && item.senses.every(sense => sense.pos.trim() && sense.meaning.trim()))
}

export function toSessionEntries(items: StudyWord[]) {
  return items.map((item, index) => ({
    item,
    originalIndex: index,
  }))
}

function isStudyWord(value: unknown): value is StudyWord {
  if (!isRecord(value) || !hasOnlyKeys(value, ['id', 'wordKey', 'word', 'pos', 'meaning', 'examples', 'example']) || typeof value.id !== 'string' || typeof value.wordKey !== 'string' || typeof value.word !== 'string' || typeof value.pos !== 'string' || typeof value.meaning !== 'string' || typeof value.example !== 'string' || !Array.isArray(value.examples))
    return false
  return value.examples.every(example => typeof example === 'string')
}

function isPracticeQuestion(value: unknown): value is PracticeQuestion {
  if (!isRecord(value) || !hasOnlyKeys(value, ['questionId', 'questionType', 'difficulty', 'prompt', 'options', 'answerIndex']) || typeof value.questionId !== 'string' || !value.questionId.trim() || !['standard', 'fillBlank', 'reading'].includes(String(value.questionType)) || ![1, 2, 3].includes(Number(value.difficulty)) || typeof value.prompt !== 'string' || !Array.isArray(value.options) || !Number.isInteger(value.answerIndex))
    return false
  return value.options.length === 4 && value.options.every(option => typeof option === 'string') && Number(value.answerIndex) >= 0 && Number(value.answerIndex) < value.options.length
}

function isSessionEntry(value: unknown): value is SessionEntry {
  if (!isRecord(value) || !hasOnlyKeys(value, ['item', 'question', 'originalIndex', 'readingPassage', 'readingPackId']) || !isStudyWord(value.item) || typeof value.originalIndex !== 'number' || !Number.isInteger(value.originalIndex) || value.originalIndex < 0)
    return false
  const hasValidReadingPack = !(isPracticeQuestion(value.question) && value.question.questionType === 'reading')
    || (typeof value.readingPassage === 'string' && value.readingPassage.trim().length > 0 && typeof value.readingPackId === 'string' && value.readingPackId.trim().length > 0)
  return (value.question === undefined || isPracticeQuestion(value.question))
    && (value.readingPassage === undefined || typeof value.readingPassage === 'string')
    && (value.readingPackId === undefined || typeof value.readingPackId === 'string')
    && hasValidReadingPack
}

function isDraft(value: unknown): boolean {
  if (value === null)
    return true
  if (!isRecord(value) || !hasOnlyKeys(value, ['selectedIndex', 'answered']) || typeof value.answered !== 'boolean')
    return false
  return value.selectedIndex === null || (Number.isInteger(value.selectedIndex) && Number(value.selectedIndex) >= 0)
}

function isQuizRecord(value: unknown): value is QuizRecord {
  return isRecord(value)
    && hasOnlyKeys(value, ['type', 'selectedIndex', 'userAnswer', 'correctAnswer', 'isCorrect', 'skipped'])
    && value.type === 'quiz'
    && (value.selectedIndex === null || (Number.isInteger(value.selectedIndex) && Number(value.selectedIndex) >= 0))
    && typeof value.userAnswer === 'string'
    && typeof value.correctAnswer === 'string'
    && typeof value.isCorrect === 'boolean'
    && typeof value.skipped === 'boolean'
}

export function normalizeSession(
  session: unknown,
  validSetIds: Set<string>,
  view?: string,
): PracticeSession | null {
  if (!session || typeof session !== 'object' || Array.isArray(session))
    return null
  const source = session as Record<string, unknown>
  if (!hasOnlyKeys(source, ['sourceSetId', 'mode', 'entries', 'index', 'correctCount', 'wrongEntries', 'answers', 'drafts', 'markedForReview', 'review', 'status']))
    return null
  if (typeof source.sourceSetId !== 'string' || !validSetIds.has(source.sourceSetId))
    return null
  if (typeof source.mode !== 'string' || !['quiz', 'fillBlank', 'reading'].includes(source.mode))
    return null
  if (!Array.isArray(source.entries) || !source.entries.length || !source.entries.every(isSessionEntry))
    return null

  if (typeof source.index !== 'number' || !Number.isInteger(source.index) || source.index < 0 || source.index >= source.entries.length || typeof source.correctCount !== 'number' || !Number.isInteger(source.correctCount) || source.correctCount < 0 || source.correctCount > source.entries.length)
    return null
  if (!Array.isArray(source.markedForReview) || source.markedForReview.length !== source.entries.length || !source.markedForReview.every(value => typeof value === 'boolean'))
    return null
  if (!Array.isArray(source.wrongEntries) || !source.wrongEntries.every(isSessionEntry) || !Array.isArray(source.answers) || !source.answers.every(isQuizRecord) || !Array.isArray(source.drafts) || !source.drafts.every(isDraft) || typeof source.review !== 'boolean' || (source.status !== 'in-progress' && source.status !== 'completed'))
    return null
  const markedForReview = source.markedForReview

  return {
    sourceSetId: source.sourceSetId,
    mode: source.mode as PracticeSession['mode'],
    entries: source.entries,
    index: source.index,
    correctCount: source.correctCount,
    wrongEntries: source.wrongEntries,
    answers: source.answers,
    drafts: source.drafts,
    markedForReview,
    review: source.review,
    status: source.status === 'completed' || view === 'result' ? 'completed' : 'in-progress',
  }
}

export function createEditorItem(item?: Pick<EditorItem, 'word' | 'senses'> | StudyWord | null): EditorItem {
  const senses = item && 'senses' in item
    ? item.senses.map(sense => ({ ...sense, examples: [...sense.examples] }))
    : item
      ? [{ id: item.id, pos: item.pos, meaning: item.meaning, examples: [...item.examples] }]
      : [createBlankSenseDraft()]
  return {
    id: item && 'id' in item && typeof item.id === 'string' ? item.id : generateEditorId(),
    word: item?.word ?? '',
    senses,
  }
}

export function createBlankEditorItem(): EditorItem {
  return createEditorItem(null)
}

export function createEditorItems(items: StudyWord[] = []): EditorItem[] {
  return items.map(item => createEditorItem(item))
}

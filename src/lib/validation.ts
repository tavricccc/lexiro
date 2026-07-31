import type { EditorItem, EditorQuestion, PracticeSession, Question, VocabItem, VocabSet } from '@/types'

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function generateId(prefix?: string): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  const suffix = Math.random().toString(36).substring(2, 11)
  return prefix ? `${prefix}-${Date.now()}-${suffix}` : `${Date.now()}`
}

export function normalizeQuestion(question: unknown, itemIndex: number): Question {
  if (!question || typeof question !== 'object' || Array.isArray(question)) {
    throw new Error(`第 ${itemIndex + 1} 筆的 question 格式錯誤`)
  }
  const q = question as Record<string, unknown>
  if (!isNonEmptyString(q.prompt)) {
    throw new Error(`第 ${itemIndex + 1} 筆缺少 question.prompt`)
  }
  if (!Array.isArray(q.opts) || q.opts.length !== 4) {
    throw new Error(`第 ${itemIndex + 1} 筆的 question.opts 必須剛好有 4 個選項`)
  }
  if (q.opts.some((option: unknown) => !isNonEmptyString(option))) {
    throw new Error(`第 ${itemIndex + 1} 筆的 question.opts 需全部為非空字串`)
  }
  if (!Number.isInteger(q.ans) || (q.ans as number) < 0 || (q.ans as number) > 3) {
    throw new Error(`第 ${itemIndex + 1} 筆的 question.ans 需為 0 到 3`)
  }

  return {
    prompt: (q.prompt as string).trim(),
    opts: (q.opts as string[]).map((option: string) => option.trim()),
    ans: q.ans as number,
  }
}

export function normalizeItem(item: unknown, itemIndex: number): VocabItem {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new Error(`第 ${itemIndex + 1} 筆資料格式錯誤`)
  }
  const it = item as Record<string, unknown>
  if (!isNonEmptyString(it.word)) {
    throw new Error(`第 ${itemIndex + 1} 筆缺少 word`)
  }
  if (!isNonEmptyString(it.meaning)) {
    throw new Error(`第 ${itemIndex + 1} 筆缺少 meaning`)
  }
  if (!isNonEmptyString(it.example)) {
    throw new Error(`第 ${itemIndex + 1} 筆缺少 example`)
  }
  if (!it.question) {
    throw new Error(`第 ${itemIndex + 1} 筆缺少 question`)
  }

  return {
    id: isNonEmptyString(it.id) ? (it.id as string).trim() : generateId('item'),
    word: (it.word as string).trim(),
    pos: isNonEmptyString(it.pos) ? (it.pos as string).trim() : '',
    meaning: (it.meaning as string).trim(),
    example: (it.example as string).trim(),
    question: normalizeQuestion(it.question, itemIndex),
    definition: isNonEmptyString(it.definition) ? (it.definition as string).trim() : undefined,
    phonetic: isNonEmptyString(it.phonetic) ? (it.phonetic as string).trim() : undefined,
    audioUrl: isNonEmptyString(it.audioUrl) ? (it.audioUrl as string).trim() : undefined,
    origin: isNonEmptyString(it.origin) ? (it.origin as string).trim() : undefined,
    dictionarySource: isNonEmptyString(it.dictionarySource) ? (it.dictionarySource as string).trim() : undefined,
    synonyms: Array.isArray(it.synonyms) ? it.synonyms.filter(isNonEmptyString).map(tag => tag.trim()) : [],
    antonyms: Array.isArray(it.antonyms) ? it.antonyms.filter(isNonEmptyString).map(tag => tag.trim()) : [],
    note: isNonEmptyString(it.note) ? (it.note as string).trim() : undefined,
    tags: Array.isArray(it.tags) ? it.tags.filter(isNonEmptyString).map(tag => tag.trim()) : [],
    favorite: Boolean(it.favorite),
  }
}

export function normalizeSet(data: unknown, fallbackId = generateId()): VocabSet {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('最外層必須是單一 JSON object')
  }
  const d = data as Record<string, unknown>
  if (!Array.isArray(d.items)) {
    throw new TypeError('缺少 items 陣列')
  }
  if (!d.items.length) {
    throw new Error('items 不可為空')
  }

  const now = new Date()
  const fallbackName = `單字集 ${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  return {
    id: isNonEmptyString(d.id) ? (d.id as string).trim() : fallbackId,
    setName: isNonEmptyString(d.setName) ? (d.setName as string).trim() : fallbackName,
    difficulty: (d.difficulty as number) ?? 2,
    items: (d.items as unknown[]).map((item, index) => normalizeItem(item, index)),
    createdAt: isNonEmptyString(d.createdAt) ? d.createdAt as string : undefined,
    updatedAt: isNonEmptyString(d.updatedAt) ? d.updatedAt as string : undefined,
  }
}

export function normalizeExportPayload(data: unknown): VocabSet[] {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('匯入資料必須是 JSON object')
  }
  const d = data as Record<string, unknown>

  const timestamp = Date.now()
  if (Array.isArray(d.sets)) {
    if (!d.sets.length)
      throw new Error('sets 不可為空')
    return d.sets.map((set: unknown, index: number) => normalizeSet(set, `imported-${timestamp}-${index + 1}`))
  }

  if (Array.isArray(d.items)) {
    return [normalizeSet(data as Record<string, unknown>, `imported-${timestamp}-1`)]
  }

  throw new Error('找不到 sets 或 items')
}

export function toSessionEntries(items: VocabItem[]) {
  return items.map((item, index) => ({
    item,
    originalIndex: index,
  }))
}

export function normalizeSession(
  session: unknown,
  validSetIds: Set<string>,
  view?: string,
): PracticeSession | null {
  if (!session || typeof session !== 'object' || Array.isArray(session))
    return null
  const s = session as Record<string, unknown>
  if (!isNonEmptyString(s.sourceSetId))
    return null
  if (!validSetIds.has(s.sourceSetId as string))
    return null
  if (!isNonEmptyString(s.mode))
    return null
  if (!Array.isArray(s.entries) || !s.entries.length)
    return null
  if (!['quiz', 'spelling', 'flashcard'].includes(s.mode as string))
    return null

  const markedForReview = Array.isArray(s.markedForReview)
    ? s.markedForReview.slice(0, s.entries.length).map(Boolean)
    : []
  while (markedForReview.length < s.entries.length)
    markedForReview.push(false)

  return {
    sourceSetId: s.sourceSetId as string,
    mode: s.mode as PracticeSession['mode'],
    entries: s.entries as PracticeSession['entries'],
    index: Number.isInteger(s.index) && (s.index as number) >= 0 ? (s.index as number) : 0,
    correctCount: Number.isInteger(s.correctCount) && (s.correctCount as number) >= 0 ? (s.correctCount as number) : 0,
    wrongEntries: Array.isArray(s.wrongEntries) ? s.wrongEntries as PracticeSession['wrongEntries'] : [],
    answers: Array.isArray(s.answers) ? s.answers as PracticeSession['answers'] : [],
    drafts: Array.isArray(s.drafts) ? s.drafts as PracticeSession['drafts'] : [],
    markedForReview,
    review: Boolean(s.review),
    status: s.status === 'completed' || view === 'result' ? 'completed' : 'in-progress',
  }
}

export function createEditorQuestion(question: Question | null | undefined): EditorQuestion {
  const opts = question?.opts
  return {
    prompt: question?.prompt ?? '',
    opts: Array.isArray(opts) && opts.length === 4 ? [...opts] : ['', '', '', ''],
    ans: Number.isInteger(question?.ans) ? (question?.ans ?? 0) : 0,
  }
}

export function createEditorItem(item?: VocabItem | null, index = 0): EditorItem {
  return {
    id: isNonEmptyString(item?.id) ? (item.id as string).trim() : generateId(`editor-${index}`),
    word: item?.word ?? '',
    pos: item?.pos ?? '',
    meaning: item?.meaning ?? '',
    example: item?.example ?? '',
    definition: item?.definition,
    phonetic: item?.phonetic,
    audioUrl: item?.audioUrl,
    origin: item?.origin,
    dictionarySource: item?.dictionarySource,
    synonyms: item?.synonyms ?? [],
    antonyms: item?.antonyms ?? [],
    note: item?.note,
    tags: item?.tags ?? [],
    favorite: item?.favorite ?? false,
    question: createEditorQuestion(item?.question),
  }
}

export function createBlankEditorItem(index = 0): EditorItem {
  return createEditorItem(null, index)
}

export function createEditorItems(items: VocabItem[] = []): EditorItem[] {
  return items.map((item, index) => createEditorItem(item, index))
}

import type { DailyActivity, DashboardStats, FullBackupPayload, LearningProgress, LibraryQuestion, LibrarySet, LibraryState, QuestionStatKey, QuestionStats, SetMembership, SetSharePayload, SharedSet, VocabFolder, WordEntry } from '@/types'
import { normalizeShareableAiSettings } from './ai-provider'
import { normalizeFolderParentId, UNCATEGORIZED_FOLDER_ID } from './folders'
import { QUESTION_STAT_KEYS } from './learning-defaults'
import { normalizeWordKey } from './library'
import { parseLibraryImportValue } from './library-import'
import { questionBelongsToAnyMemberships, questionBelongsToMemberships, questionUsesWords } from './question-ownership'
import { assertKnownKeys, requiredNumber, requiredObject, requiredText } from './schema'

function optionalText(value: unknown, field: string): string {
  if (typeof value !== 'string')
    throw new Error(`${field} 格式錯誤`)
  return value.trim()
}

function normalizeWord(value: unknown, index: number): WordEntry {
  const parsed = parseLibraryImportValue({ schemaVersion: 1, kind: 'words', words: [value] })
  if (!parsed.valid || parsed.data.kind !== 'words')
    throw new Error(parsed.valid ? `第 ${index + 1} 個單字格式錯誤` : parsed.error)
  return parsed.data.words[0]
}

function normalizeQuestions(value: unknown, field: string): LibraryQuestion[] {
  if (!Array.isArray(value))
    throw new Error(`${field} 格式錯誤`)
  const parsed = parseLibraryImportValue({ schemaVersion: 1, kind: 'questions', questions: value })
  if (!parsed.valid || parsed.data.kind !== 'questions')
    throw new Error(parsed.valid ? `${field} 格式錯誤` : parsed.error)
  return parsed.data.questions
}

function normalizeMemberships(value: unknown, words: Record<string, WordEntry>, field: string): SetMembership[] {
  if (!Array.isArray(value) || !value.length)
    throw new Error(`${field} 至少需要一筆 membership`)
  const seen = new Set<string>()
  return value.map((membership, index) => {
    const source = requiredObject(membership, `${field}[${index}]`)
    assertKnownKeys(source, ['wordKey', 'senseIds'], `${field}[${index}]`)
    const wordKey = normalizeWordKey(requiredText(source.wordKey, `${field}[${index}].wordKey`))
    if (seen.has(wordKey))
      throw new Error(`${field}[${index}] 重複指定 wordKey`)
    seen.add(wordKey)
    const word = words[wordKey]
    if (!word)
      throw new Error(`${field}[${index}] 指向未知單字`)
    if (!Array.isArray(source.senseIds) || !source.senseIds.length || !source.senseIds.every(senseId => typeof senseId === 'string' && senseId.trim()))
      throw new Error(`${field}[${index}].senseIds 至少需要一個有效 senseId`)
    const senseIds = source.senseIds.map(senseId => String(senseId).trim())
    if (new Set(senseIds).size !== senseIds.length)
      throw new Error(`${field}[${index}].senseIds 不可重複`)
    if (!senseIds.every(senseId => word.senses.some(sense => sense.id === senseId)))
      throw new Error(`${field}[${index}] 指向未知 senseId`)
    return { wordKey, senseIds }
  })
}

function normalizeQuestionsForWords(value: unknown, words: Record<string, WordEntry>, field: string): LibraryQuestion[] {
  const questions = normalizeQuestions(value, field)
  if (!questions.every(question => questionUsesWords(question, words)))
    throw new Error(`${field} 包含未收錄的 wordKey 或 senseId`)
  return questions
}

export function normalizeSharedSet(value: unknown): SharedSet {
  const source = requiredObject(value, '單字集')
  assertKnownKeys(source, ['id', 'setName', 'folderId', 'createdAt', 'updatedAt', 'words', 'memberships', 'questions'], '單字集')
  const rawWords = source.words
  if (!Array.isArray(rawWords) || !rawWords.length)
    throw new Error('單字集至少需要一個單字')
  const words = rawWords.map(normalizeWord)
  const wordsByKey: Record<string, WordEntry> = {}
  for (const word of words) {
    if (wordsByKey[word.wordKey])
      throw new Error(`單字集包含重複 wordKey：${word.wordKey}`)
    wordsByKey[word.wordKey] = word
  }
  const memberships = normalizeMemberships(source.memberships, wordsByKey, 'memberships')
  const membershipKeys = new Set(memberships.map(membership => membership.wordKey))
  if (words.some(word => !membershipKeys.has(word.wordKey)))
    throw new Error('單字集包含沒有關聯的單字')
  const questions = normalizeQuestionsForWords(source.questions, wordsByKey, 'questions')
  if (new Set(questions.map(question => question.id)).size !== questions.length)
    throw new Error('單字集 questions 包含重複 id')
  if (new Set(questions.map(question => question.fingerprint)).size !== questions.length)
    throw new Error('單字集 questions 包含重複 fingerprint')
  if (!questions.every(question => questionBelongsToMemberships(question, memberships)))
    throw new Error('單字集 questions 包含沒有 membership 的題目')
  if (typeof source.folderId !== 'string' || !source.folderId.trim())
    throw new Error('單字集必須指定資料夾')
  return {
    id: requiredText(source.id, 'id'),
    setName: requiredText(source.setName, 'setName'),
    folderId: source.folderId.trim(),
    createdAt: requiredText(source.createdAt, 'createdAt'),
    updatedAt: requiredText(source.updatedAt, 'updatedAt'),
    words,
    memberships,
    questions,
  }
}

export function normalizeSharePayload(value: unknown): SetSharePayload {
  const source = requiredObject(value, '匯入資料')
  assertKnownKeys(source, ['version', 'exportedAt', 'appName', 'kind', 'sets'], '匯入資料')
  if (requiredNumber(source.version, 'version') !== 1)
    throw new Error('只支援分享檔 version 1')
  if (source.kind !== 'set-share')
    throw new Error('不是有效的單字集分享檔')
  if (!Array.isArray(source.sets) || !source.sets.length)
    throw new Error('分享檔至少需要一個單字集')
  return {
    version: requiredNumber(source.version, 'version'),
    exportedAt: requiredText(source.exportedAt, 'exportedAt'),
    appName: requiredText(source.appName, 'appName'),
    kind: 'set-share',
    sets: source.sets.map(normalizeSharedSet),
  }
}

function normalizeFolder(value: unknown, index: number): VocabFolder {
  const source = requiredObject(value, `folders[${index}]`)
  assertKnownKeys(source, ['id', 'name', 'parentId', 'order', 'createdAt', 'updatedAt'], `folders[${index}]`)
  const rawParentId = source.parentId === undefined ? undefined : requiredText(source.parentId, `folders[${index}].parentId`)
  return {
    id: requiredText(source.id, `folders[${index}].id`),
    name: requiredText(source.name, `folders[${index}].name`),
    // Older local/cloud data could put folders below the uncategorized bucket.
    // Repair that shape while loading so those folders become root folders.
    parentId: normalizeFolderParentId(rawParentId),
    order: requiredNumber(source.order, `folders[${index}].order`),
    createdAt: requiredText(source.createdAt, `folders[${index}].createdAt`),
    updatedAt: requiredText(source.updatedAt, `folders[${index}].updatedAt`),
  }
}

function normalizeSet(value: unknown, index: number, folderIds: Set<string>): LibrarySet {
  const source = requiredObject(value, `sets[${index}]`)
  assertKnownKeys(source, ['id', 'setName', 'folderId', 'createdAt', 'updatedAt'], `sets[${index}]`)
  const folderId = requiredText(source.folderId, `sets[${index}].folderId`)
  if (!folderIds.has(folderId))
    throw new Error(`sets[${index}] 指向未知 folderId`)
  return {
    id: requiredText(source.id, `sets[${index}].id`),
    setName: requiredText(source.setName, `sets[${index}].setName`),
    folderId,
    createdAt: requiredText(source.createdAt, `sets[${index}].createdAt`),
    updatedAt: requiredText(source.updatedAt, `sets[${index}].updatedAt`),
  }
}

export function normalizeLibraryState(value: unknown): LibraryState {
  const source = requiredObject(value, 'library')
  assertKnownKeys(source, ['version', 'words', 'sets', 'memberships', 'folders', 'questions', 'updatedAt'], 'library')
  if (source.version !== 1)
    throw new Error('完整備份的 library version 不受支援')
  const rawWords = requiredObject(source.words, 'library.words')
  const words: Record<string, WordEntry> = {}
  for (const [index, [storedWordKey, word]] of Object.entries(rawWords).entries()) {
    const normalized = normalizeWord(word, index)
    if (storedWordKey !== normalized.wordKey)
      throw new Error(`library.words.${storedWordKey} 的 key 與 wordKey 不一致`)
    if (words[normalized.wordKey])
      throw new Error(`library.words 包含重複 wordKey：${normalized.wordKey}`)
    words[normalized.wordKey] = normalized
  }
  if (!Array.isArray(source.folders))
    throw new Error('library.folders 格式錯誤')
  const folders = source.folders.map(normalizeFolder)
  const folderIds = new Set(folders.map(folder => folder.id))
  if (folderIds.size !== folders.length)
    throw new Error('library.folders 包含重複 id')
  const uncategorized = folders.find(folder => folder.id === UNCATEGORIZED_FOLDER_ID)
  if (!uncategorized || uncategorized.parentId !== undefined)
    throw new Error('library 必須包含位於根目錄的未分類資料夾')
  for (const folder of folders) {
    if (folder.parentId && !folderIds.has(folder.parentId))
      throw new Error(`folders.${folder.id} 指向未知 parentId`)
    if (folders.some(other => other.id !== folder.id && other.parentId === folder.parentId && other.name.trim().toLocaleLowerCase() === folder.name.trim().toLocaleLowerCase()))
      throw new Error('同一層資料夾名稱不可重複')
  }
  for (const folder of folders) {
    const visited = new Set<string>()
    let current: VocabFolder | undefined = folder
    while (current?.parentId) {
      if (visited.has(current.id))
        throw new Error('資料夾階層不可形成循環')
      visited.add(current.id)
      current = folders.find(candidate => candidate.id === current?.parentId)
    }
  }
  if (!Array.isArray(source.sets))
    throw new Error('library.sets 格式錯誤')
  const sets = source.sets.map((set, index) => normalizeSet(set, index, folderIds))
  if (new Set(sets.map(set => set.id)).size !== sets.length)
    throw new Error('library.sets 包含重複 id')
  const setNames = new Set<string>()
  for (const set of sets) {
    const normalizedName = set.setName.trim().toLocaleLowerCase()
    if (setNames.has(normalizedName))
      throw new Error('單字集名稱不可重複')
    setNames.add(normalizedName)
  }
  const rawMemberships = requiredObject(source.memberships, 'library.memberships')
  const setIds = new Set(sets.map(set => set.id))
  const memberships: Record<string, SetMembership[]> = {}
  for (const [setId, valueForSet] of Object.entries(rawMemberships)) {
    if (!setIds.has(setId))
      throw new Error(`library.memberships 包含未知 setId ${setId}`)
    memberships[setId] = normalizeMemberships(valueForSet, words, `library.memberships.${setId}`)
  }
  for (const set of sets) {
    if (!memberships[set.id])
      throw new Error(`library.memberships 缺少 setId ${set.id}`)
  }
  const referencedWordKeys = new Set(Object.values(memberships).flatMap(membershipsForSet => membershipsForSet.map(membership => membership.wordKey)))
  if (Object.keys(words).some(wordKey => !referencedWordKeys.has(wordKey)))
    throw new Error('library.words 包含沒有 membership 的單字')
  const questions = normalizeQuestionsForWords(source.questions, words, 'library.questions')
  if (new Set(questions.map(question => question.id)).size !== questions.length)
    throw new Error('library.questions 包含重複 id')
  if (new Set(questions.map(question => question.fingerprint)).size !== questions.length)
    throw new Error('library.questions 包含重複 fingerprint')
  if (!questions.every(question => questionBelongsToAnyMemberships(question, Object.values(memberships))))
    throw new Error('library.questions 包含沒有單字集關聯的題目')
  return {
    version: 1,
    words,
    sets,
    memberships,
    folders,
    questions,
    updatedAt: requiredText(source.updatedAt, 'library.updatedAt'),
  }
}

function normalizeCard(value: unknown, field: string) {
  const source = requiredObject(value, field)
  assertKnownKeys(source, ['due', 'stability', 'difficulty', 'elapsedDays', 'scheduledDays', 'learningSteps', 'reps', 'lapses', 'state', 'reviewCount', 'correctCount', 'lastReview'], field)
  const card = {
    due: requiredText(source.due, `${field}.due`),
    stability: requiredNumber(source.stability, `${field}.stability`),
    difficulty: requiredNumber(source.difficulty, `${field}.difficulty`),
    elapsedDays: requiredNumber(source.elapsedDays, `${field}.elapsedDays`),
    scheduledDays: requiredNumber(source.scheduledDays, `${field}.scheduledDays`),
    learningSteps: requiredNumber(source.learningSteps, `${field}.learningSteps`),
    reps: requiredNumber(source.reps, `${field}.reps`),
    lapses: requiredNumber(source.lapses, `${field}.lapses`),
    state: requiredNumber(source.state, `${field}.state`),
    reviewCount: requiredNumber(source.reviewCount, `${field}.reviewCount`),
    correctCount: requiredNumber(source.correctCount, `${field}.correctCount`),
  }
  if (source.lastReview !== undefined)
    return { ...card, lastReview: requiredText(source.lastReview, `${field}.lastReview`) }
  return card
}

export function normalizeLearningProgress(value: unknown): LearningProgress {
  const source = requiredObject(value, 'learning')
  assertKnownKeys(source, ['cards', 'updatedAt'], 'learning')
  const rawCards = requiredObject(source.cards, 'learning.cards')
  const cards = Object.fromEntries(Object.entries(rawCards).map(([senseId, card]) => [senseId, normalizeCard(card, `learning.cards.${senseId}`)]))
  return { cards, updatedAt: requiredText(source.updatedAt, 'learning.updatedAt') }
}

function normalizeQuestionStats(value: unknown, field: string): Record<QuestionStatKey, QuestionStats> {
  const source = requiredObject(value, field)
  assertKnownKeys(source, QUESTION_STAT_KEYS, field)
  return Object.fromEntries(QUESTION_STAT_KEYS.map((key) => {
    const stat = requiredObject(source[key], `${field}.${key}`)
    assertKnownKeys(stat, ['total', 'correct', 'retry'], `${field}.${key}`)
    return [key, {
      total: requiredNumber(stat.total, `${field}.${key}.total`),
      correct: requiredNumber(stat.correct, `${field}.${key}.correct`),
      retry: requiredNumber(stat.retry, `${field}.${key}.retry`),
    }]
  })) as Record<QuestionStatKey, QuestionStats>
}

function normalizeQuestionStatsBySense(value: unknown, field: string): DashboardStats['questionStatsBySense'] {
  const source = requiredObject(value, field)
  return Object.fromEntries(Object.entries(source).map(([senseId, stats]) => [
    senseId,
    normalizeQuestionStats(stats, `${field}.${senseId}`),
  ]))
}

function normalizeDailyActivity(value: unknown, field: string): DailyActivity {
  const source = requiredObject(value, field)
  assertKnownKeys(source, ['date', 'memoryAgain', 'memoryGood', 'questionTotal', 'questionCorrect', 'questionRetry', 'xpEarned', 'completed', 'questionStats'], field)
  if (typeof source.completed !== 'boolean')
    throw new Error(`${field}.completed 格式錯誤`)
  return {
    date: requiredText(source.date, `${field}.date`),
    memoryAgain: requiredNumber(source.memoryAgain, `${field}.memoryAgain`),
    memoryGood: requiredNumber(source.memoryGood, `${field}.memoryGood`),
    questionTotal: requiredNumber(source.questionTotal, `${field}.questionTotal`),
    questionCorrect: requiredNumber(source.questionCorrect, `${field}.questionCorrect`),
    questionRetry: requiredNumber(source.questionRetry, `${field}.questionRetry`),
    xpEarned: requiredNumber(source.xpEarned, `${field}.xpEarned`),
    completed: source.completed,
    questionStats: normalizeQuestionStats(source.questionStats, `${field}.questionStats`),
  }
}

export function normalizeDashboardStats(value: unknown): DashboardStats {
  const source = requiredObject(value, 'stats')
  assertKnownKeys(source, ['totalMemoryReviews', 'correctMemoryReviews', 'totalQuestionReviews', 'correctQuestionReviews', 'streakDays', 'longestStreak', 'xp', 'level', 'lastStudyDate', 'dailyWordGoal', 'dailyQuestionGoal', 'todayMemoryReviews', 'todayMemoryCorrectReviews', 'todayQuestionReviews', 'todayQuestionCorrectReviews', 'questionStats', 'questionStatsBySense', 'dailyHistory', 'updatedAt'], 'stats')
  const dailyHistory = requiredObject(source.dailyHistory, 'stats.dailyHistory')
  const normalizedDailyHistory = Object.fromEntries(Object.entries(dailyHistory).map(([date, activity]) => {
    const normalized = normalizeDailyActivity(activity, `stats.dailyHistory.${date}`)
    if (normalized.date !== date)
      throw new Error(`stats.dailyHistory.${date}.date 必須與 key 相符`)
    return [date, normalized]
  }))
  return {
    totalMemoryReviews: requiredNumber(source.totalMemoryReviews, 'stats.totalMemoryReviews'),
    correctMemoryReviews: requiredNumber(source.correctMemoryReviews, 'stats.correctMemoryReviews'),
    totalQuestionReviews: requiredNumber(source.totalQuestionReviews, 'stats.totalQuestionReviews'),
    correctQuestionReviews: requiredNumber(source.correctQuestionReviews, 'stats.correctQuestionReviews'),
    streakDays: requiredNumber(source.streakDays, 'stats.streakDays'),
    longestStreak: requiredNumber(source.longestStreak, 'stats.longestStreak'),
    xp: requiredNumber(source.xp, 'stats.xp'),
    level: requiredNumber(source.level, 'stats.level'),
    lastStudyDate: optionalText(source.lastStudyDate, 'stats.lastStudyDate'),
    dailyWordGoal: requiredNumber(source.dailyWordGoal, 'stats.dailyWordGoal'),
    dailyQuestionGoal: requiredNumber(source.dailyQuestionGoal, 'stats.dailyQuestionGoal'),
    todayMemoryReviews: requiredNumber(source.todayMemoryReviews, 'stats.todayMemoryReviews'),
    todayMemoryCorrectReviews: requiredNumber(source.todayMemoryCorrectReviews, 'stats.todayMemoryCorrectReviews'),
    todayQuestionReviews: requiredNumber(source.todayQuestionReviews, 'stats.todayQuestionReviews'),
    todayQuestionCorrectReviews: requiredNumber(source.todayQuestionCorrectReviews, 'stats.todayQuestionCorrectReviews'),
    questionStats: normalizeQuestionStats(source.questionStats, 'stats.questionStats'),
    questionStatsBySense: normalizeQuestionStatsBySense(source.questionStatsBySense, 'stats.questionStatsBySense'),
    dailyHistory: normalizedDailyHistory,
    updatedAt: requiredText(source.updatedAt, 'stats.updatedAt'),
  }
}

export function normalizeFullBackupPayload(value: unknown): FullBackupPayload {
  const source = requiredObject(value, '完整備份')
  assertKnownKeys(source, ['version', 'exportedAt', 'appName', 'kind', 'library', 'learning', 'stats', 'aiSettings'], '完整備份')
  if (source.kind !== 'full-backup')
    throw new Error('不是有效的完整備份檔')
  if (requiredNumber(source.version, 'version') !== 1)
    throw new Error('只支援完整備份 version 1')
  return {
    version: requiredNumber(source.version, 'version'),
    exportedAt: requiredText(source.exportedAt, 'exportedAt'),
    appName: requiredText(source.appName, 'appName'),
    kind: 'full-backup',
    library: normalizeLibraryState(source.library),
    learning: normalizeLearningProgress(source.learning),
    stats: normalizeDashboardStats(source.stats),
    aiSettings: normalizeShareableAiSettings(source.aiSettings),
  }
}

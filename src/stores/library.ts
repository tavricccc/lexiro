import type { DashboardStats, LearningProgress, LibraryQuestion, LibrarySet, LibraryState, SetMembership, StudyWord, VocabFolder, WordEntry, WordSense } from '@/types'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { LIBRARY_STORAGE_KEY } from '@/constants'
import { cloneJson } from '@/lib/clone'
import { ALL_FOLDER_ID, createUncategorizedFolder, normalizeFolderParentId, sortFolders, UNCATEGORIZED_FOLDER_ID } from '@/lib/folders'
import { stableHash } from '@/lib/hash'
import { i18n } from '@/lib/i18n'
import { buildSenseId, canonicalizeQuestion, mergeUniqueStrings, mergeWord, normalizePartOfSpeech, normalizeWordKey, senseToStudyWord } from '@/lib/library'
import { parseLibraryImportValue } from '@/lib/library-import'
import { membershipsCoverWords, sanitizeMemberships } from '@/lib/library-membership'
import { loadFromStorage, saveToStorage } from '@/lib/persist'
import { questionBelongsToAnyMemberships, questionBelongsToMemberships, questionUsesWords } from '@/lib/question-ownership'
import { createUniqueSetName } from '@/lib/set-name'
import { normalizeLibraryState } from '@/lib/share'
import { useLearningStore } from './learning'

const CURRENT_VERSION = 1
const t = i18n.global.t

export interface LibraryMergeResult {
  addedSets: number
  addedQuestions: number
}

interface LearningUndoState {
  progress: LearningProgress
  stats: DashboardStats
}

export interface SenseRemovalUndoSnapshot {
  libraryBefore: LibraryState
  libraryAfter: LibraryState
  learningBefore: LearningUndoState | null
  learningAfter: LearningUndoState | null
}

function emptyState(): LibraryState {
  return {
    version: CURRENT_VERSION,
    words: {},
    sets: [],
    memberships: {},
    folders: [createUncategorizedFolder()],
    questions: [],
    updatedAt: new Date().toISOString(),
  }
}

function normalizeQuestionForStore(question: LibraryQuestion): LibraryQuestion | null {
  try {
    const canonical = canonicalizeQuestion(question)
    const parsed = parseLibraryImportValue({ schemaVersion: 1, kind: 'questions', questions: [canonical] }, { requireEnglish: true })
    return parsed.valid && parsed.data.kind === 'questions' ? parsed.data.questions[0] : null
  }
  catch {
    return null
  }
}

function normalizeQuestionEntries(entries: LibraryQuestion[]): LibraryQuestion[] {
  return entries.flatMap((entry) => {
    const normalized = normalizeQuestionForStore(entry)
    return normalized ? [normalized] : []
  })
}

function mergeWordEntries(base: Record<string, WordEntry>, entries: WordEntry[]): Record<string, WordEntry> {
  const nextWords = { ...base }
  for (const word of entries) {
    const wordKey = normalizeWordKey(word.wordKey)
    nextWords[wordKey] = mergeWord(nextWords[wordKey], {
      ...word,
      wordKey,
      senses: word.senses.map(sense => ({ ...sense, examples: [...sense.examples] })),
    })
  }
  return nextWords
}

export const useLibraryStore = defineStore('library', () => {
  const state = ref<LibraryState>(emptyState())
  const loaded = ref(false)

  const words = computed(() => Object.values(state.value.words))
  const sets = computed(() => state.value.sets)
  const folders = computed(() => sortFolders(state.value.folders))
  const questions = computed(() => state.value.questions)

  function touch() {
    state.value.updatedAt = new Date().toISOString()
    saveToStorage(LIBRARY_STORAGE_KEY, state.value)
  }

  function upsertWordInternal(incoming: WordEntry): WordEntry {
    const wordKey = normalizeWordKey(incoming.wordKey)
    const normalized = { ...incoming, wordKey }
    const existing = state.value.words[wordKey]
    const merged = mergeWord(existing, normalized)
    if (merged !== existing)
      state.value.words = { ...state.value.words, [wordKey]: merged }
    return merged
  }

  function importWords(entries: WordEntry[]) {
    for (const entry of entries)
      upsertWordInternal(entry)
    touch()
  }

  function mergeQuestionEntries(existing: LibraryQuestion[], entries: LibraryQuestion[], words: Record<string, WordEntry>, memberships: Record<string, SetMembership[]>): LibraryQuestion[] {
    return mergeNormalizedQuestionEntries(existing, normalizeQuestionEntries(entries), words, memberships)
  }

  function mergeNormalizedQuestionEntries(existing: LibraryQuestion[], entries: LibraryQuestion[], words: Record<string, WordEntry>, memberships: Record<string, SetMembership[]>): LibraryQuestion[] {
    const byId = new Map(existing.map(question => [question.id, question]))
    const byFingerprint = new Map(existing.map(question => [question.fingerprint, question]))
    for (const normalized of entries) {
      if (!questionUsesWords(normalized, words) || !questionBelongsToAnyMemberships(normalized, Object.values(memberships)))
        continue
      const existingById = byId.get(normalized.id)
      const existingByFingerprint = byFingerprint.get(normalized.fingerprint)
      if (existingByFingerprint && existingByFingerprint.id !== normalized.id)
        continue
      if (existingById) {
        byFingerprint.delete(existingById.fingerprint)
        byId.set(normalized.id, normalized)
      }
      else if (!existingByFingerprint) {
        byId.set(normalized.id, normalized)
      }
      else {
        continue
      }
      byFingerprint.set(normalized.fingerprint, normalized)
    }
    return Array.from(byId.values())
  }

  function importQuestions(entries: LibraryQuestion[]): number {
    const normalizedEntries = normalizeQuestionEntries(entries)
    const before = new Map(state.value.questions.map(question => [question.id, question]))
    const next = mergeNormalizedQuestionEntries(state.value.questions, normalizedEntries, state.value.words, state.value.memberships)
    state.value.questions = next
    touch()
    const counted = new Set<string>()
    return normalizedEntries.reduce((count, normalized) => {
      if (counted.has(normalized.id))
        return count
      counted.add(normalized.id)
      const nextQuestion = next.find(question => question.id === normalized.id)
      const previousQuestion = before.get(normalized.id)
      return nextQuestion && (!previousQuestion || stableHash(previousQuestion) !== stableHash(nextQuestion))
        ? count + 1
        : count
    }, 0)
  }

  function getSet(setId: string): LibrarySet | null {
    return state.value.sets.find(set => set.id === setId) ?? null
  }

  function normalizeSetFolderId(folderId?: string): string {
    const normalized = folderId && folderId !== ALL_FOLDER_ID ? folderId : UNCATEGORIZED_FOLDER_ID
    if (!state.value.folders.some(folder => folder.id === normalized))
      throw new Error(t('library.folderNotFound'))
    return normalized
  }

  function assertUniqueSetName(name: string, setId?: string): string {
    const normalized = name.trim()
    if (!normalized)
      throw new Error(t('editor.nameRequired'))
    if (state.value.sets.some(set => set.id !== setId && set.setName.trim().toLocaleLowerCase() === normalized.toLocaleLowerCase()))
      throw new Error(t('editor.nameExists'))
    return normalized
  }

  function createSetWithContent(name: string, folderId: string | undefined, words: WordEntry[], memberships: SetMembership[], questions: LibraryQuestion[] = []): LibrarySet {
    if (!words.length || !memberships.length)
      throw new Error(t('editor.itemsRequired'))
    const setName = assertUniqueSetName(name)
    const targetFolderId = normalizeSetFolderId(folderId)
    const nextWords = mergeWordEntries(state.value.words, words)
    const normalizedMemberships = sanitizeMemberships(memberships, nextWords)
    if (!normalizedMemberships.length || !membershipsCoverWords(words, normalizedMemberships))
      throw new Error(t('editor.itemsRequired'))
    const now = new Date().toISOString()
    const set: LibrarySet = {
      id: `set-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      setName,
      folderId: targetFolderId,
      createdAt: now,
      updatedAt: now,
    }
    state.value = {
      ...state.value,
      words: nextWords,
      sets: [...state.value.sets, set],
      memberships: { ...state.value.memberships, [set.id]: normalizedMemberships },
      questions: mergeQuestionEntries(state.value.questions, questions, nextWords, { ...state.value.memberships, [set.id]: normalizedMemberships }),
    }
    touch()
    return set
  }

  function addWordToSets(incoming: WordEntry, targets: Array<{ setId: string, membership: SetMembership }>): WordEntry {
    if (!targets.length)
      throw new Error(t('editor.itemsRequired'))
    const wordKey = normalizeWordKey(incoming.wordKey)
    const targetMemberships = new Map<string, SetMembership>()
    for (const target of targets) {
      if (!getSet(target.setId))
        throw new Error(t('editor.notFound'))
      const membershipWordKey = normalizeWordKey(target.membership.wordKey)
      if (membershipWordKey !== wordKey)
        throw new Error(t('editor.itemsRequired'))
      const existing = targetMemberships.get(target.setId)
      targetMemberships.set(target.setId, existing
        ? { wordKey, senseIds: Array.from(new Set([...existing.senseIds, ...target.membership.senseIds])) }
        : { wordKey, senseIds: Array.from(new Set(target.membership.senseIds)) })
    }

    const nextWords = mergeWordEntries(state.value.words, [incoming])
    const mergedWord = nextWords[wordKey]
    if (!mergedWord.senses.length)
      throw new Error(t('editor.itemsRequired'))
    const nextMemberships = { ...state.value.memberships }
    for (const [setId, target] of targetMemberships) {
      const senseIds = Array.from(new Set(target.senseIds))
      if (!senseIds.length || senseIds.some(senseId => !mergedWord.senses.some(sense => sense.id === senseId)))
        throw new Error(t('editor.itemsRequired'))
      const current = state.value.memberships[setId] ?? []
      const existing = current.find(member => member.wordKey === wordKey)
      const next = existing
        ? current.map(member => member.wordKey === wordKey
            ? { ...member, senseIds: Array.from(new Set([...member.senseIds, ...senseIds])) }
            : member)
        : [...current, { wordKey, senseIds }]
      const normalized = sanitizeMemberships(next, nextWords)
      if (!normalized.some(member => member.wordKey === wordKey && member.senseIds.length))
        throw new Error(t('editor.itemsRequired'))
      nextMemberships[setId] = normalized
    }

    state.value = { ...state.value, words: nextWords, memberships: nextMemberships }
    pruneOrphans()
    touch()
    return mergedWord
  }

  function updateSetWithContent(setId: string, patch: { setName?: string, folderId?: string }, words: WordEntry[], memberships: SetMembership[]): boolean {
    const existing = getSet(setId)
    if (!existing || !words.length || !memberships.length)
      throw new Error(t('editor.itemsRequired'))
    const setName = assertUniqueSetName(patch.setName ?? existing.setName, setId)
    const folderId = normalizeSetFolderId(patch.folderId ?? existing.folderId)
    const nextWords = mergeWordEntries(state.value.words, words)
    const normalizedMemberships = sanitizeMemberships(memberships, nextWords)
    if (!normalizedMemberships.length || !membershipsCoverWords(words, normalizedMemberships))
      throw new Error(t('editor.itemsRequired'))

    state.value = {
      ...state.value,
      words: nextWords,
      sets: state.value.sets.map(set => set.id === setId
        ? { ...set, setName, folderId, updatedAt: new Date().toISOString() }
        : set),
      memberships: { ...state.value.memberships, [setId]: normalizedMemberships },
    }
    pruneOrphans()
    touch()
    return true
  }

  function updateSet(setId: string, patch: { setName?: string, folderId?: string }) {
    const existing = getSet(setId)
    if (!existing)
      return false
    const setName = assertUniqueSetName(patch.setName ?? existing.setName, setId)
    const folderId = normalizeSetFolderId(patch.folderId ?? existing.folderId)
    state.value.sets = state.value.sets.map(set => set.id === setId
      ? { ...set, ...patch, folderId, setName, updatedAt: new Date().toISOString() }
      : set)
    touch()
    return true
  }

  function removeSet(setId: string) {
    state.value.sets = state.value.sets.filter(set => set.id !== setId)
    const nextMemberships = { ...state.value.memberships }
    delete nextMemberships[setId]
    state.value.memberships = nextMemberships
    pruneOrphans()
    touch()
  }

  function unlinkSet(setId: string) {
    if (!(setId in state.value.memberships))
      return
    removeSet(setId)
  }

  function pruneOrphans(): boolean {
    const memberships = Object.values(state.value.memberships).flat()
    const referenced = new Set(memberships.map(member => normalizeWordKey(member.wordKey)))
    const senseReferences = new Map<string, Set<string>>()
    for (const member of memberships) {
      const wordKey = normalizeWordKey(member.wordKey)
      const word = state.value.words[wordKey]
      if (!word)
        continue
      const senseIds = senseReferences.get(wordKey) ?? new Set<string>()
      for (const senseId of member.senseIds) {
        if (word.senses.some(sense => sense.id === senseId))
          senseIds.add(senseId)
      }
      senseReferences.set(wordKey, senseIds)
    }

    function keepsLink(wordKey: string, senseId?: string): boolean {
      const normalizedWordKey = normalizeWordKey(wordKey)
      if (!referenced.has(normalizedWordKey))
        return false
      return Boolean(senseId && senseReferences.get(normalizedWordKey)?.has(senseId))
    }

    const nextWords = Object.fromEntries(Object.entries(state.value.words)
      .filter(([wordKey]) => referenced.has(wordKey) && (senseReferences.get(wordKey)?.size ?? 0) > 0)
      .map(([wordKey, word]) => {
        const senseIds = senseReferences.get(wordKey)!
        const senses = word.senses.filter(sense => senseIds.has(sense.id))
        return [wordKey, { ...word, senses }]
      }))

    const nextQuestions: LibraryQuestion[] = []
    for (const question of state.value.questions) {
      if (question.kind !== 'reading') {
        if (question.wordKey && question.senseId && keepsLink(question.wordKey, question.senseId))
          nextQuestions.push(question)
        continue
      }

      const wordKeys = Array.from(new Set(question.wordKeys.map(normalizeWordKey)))
      const children = question.questions.filter(child => keepsLink(child.wordKey, child.senseId))
      if (!wordKeys.length || wordKeys.some(wordKey => !referenced.has(wordKey)) || children.length !== question.questions.length || !children.length)
        continue
      nextQuestions.push({ ...question, wordKeys, questions: children })
    }

    const wordsChanged = stableHash(nextWords) !== stableHash(state.value.words)
    const questionsChanged = stableHash(nextQuestions) !== stableHash(state.value.questions)
    if (wordsChanged)
      state.value.words = nextWords
    if (questionsChanged)
      state.value.questions = nextQuestions
    const learningStore = useLearningStore()
    if (learningStore.loaded)
      learningStore.pruneSenseData(new Set(Array.from(senseReferences.values()).flatMap(senseIds => Array.from(senseIds))))
    return wordsChanged || questionsChanged
  }

  function getWord(word: string): WordEntry | null {
    return state.value.words[normalizeWordKey(word)] ?? null
  }

  function normalizeAllMemberships() {
    const setIds = new Set(state.value.sets.map(set => set.id))
    const memberships: Record<string, SetMembership[]> = {}
    for (const [setId, entries] of Object.entries(state.value.memberships)) {
      if (!setIds.has(setId) || !Array.isArray(entries))
        continue
      const normalized = sanitizeMemberships(entries, state.value.words)
      if (normalized.length)
        memberships[setId] = normalized
    }
    state.value.memberships = memberships
  }

  function getSetWords(setId: string): WordEntry[] {
    return (state.value.memberships[setId] ?? [])
      .map(member => state.value.words[member.wordKey])
      .filter((word): word is WordEntry => Boolean(word))
  }

  function replaceSetMemberships(setId: string, memberships: SetMembership[]) {
    if (!getSet(setId))
      return
    const normalized = sanitizeMemberships(memberships, state.value.words)
    if (!normalized.length) {
      const nextMemberships = { ...state.value.memberships }
      delete nextMemberships[setId]
      state.value.sets = state.value.sets.filter(set => set.id !== setId)
      state.value.memberships = nextMemberships
      pruneOrphans()
      touch()
      return
    }
    state.value.memberships = { ...state.value.memberships, [setId]: normalized }
    pruneOrphans()
    touch()
  }

  function getSetStudyWords(setId: string): StudyWord[] {
    return (state.value.memberships[setId] ?? []).flatMap((membership) => {
      const word = state.value.words[membership.wordKey]
      if (!word)
        return []
      const allowedSenseIds = new Set(membership.senseIds)
      return word.senses.filter(sense => allowedSenseIds.has(sense.id)).map(sense => senseToStudyWord(word, sense))
    })
  }

  function getMembership(setId: string, wordKey: string): SetMembership | null {
    return state.value.memberships[setId]?.find(member => member.wordKey === normalizeWordKey(wordKey)) ?? null
  }

  function getSenseSetIds(wordKey: string, senseId: string): string[] {
    const normalizedWordKey = normalizeWordKey(wordKey)
    return state.value.sets
      .filter(set => state.value.memberships[set.id]?.some(member => member.wordKey === normalizedWordKey && member.senseIds.includes(senseId)))
      .map(set => set.id)
  }

  function getSenseSetNames(wordKey: string, senseId: string): string[] {
    return getSenseSetIds(wordKey, senseId)
      .map(setId => getSet(setId)?.setName)
      .filter((name): name is string => Boolean(name))
  }

  function updateSense(wordKey: string, senseId: string, patch: { pos?: string, meaningZh?: string, examples?: string[] }): WordSense | null {
    const normalizedWordKey = normalizeWordKey(wordKey)
    const word = state.value.words[normalizedWordKey]
    const current = word?.senses.find(sense => sense.id === senseId)
    if (!word || !current)
      return null
    const nextPos = patch.pos === undefined ? current.pos : normalizePartOfSpeech(patch.pos)
    const nextMeaning = patch.meaningZh === undefined ? current.meaningZh.trim() : patch.meaningZh.trim()
    if (!nextPos)
      throw new Error(t('library.invalidPartOfSpeech'))
    if (!nextMeaning)
      throw new Error(t('library.meaningRequired'))
    const nextId = buildSenseId(normalizedWordKey, nextPos, nextMeaning)
    const duplicate = word.senses.some(sense => sense.id !== senseId && sense.id === nextId)
    if (duplicate)
      throw new Error(t('library.senseExists'))
    const nextSense: WordSense = {
      ...current,
      id: nextId,
      pos: nextPos,
      meaningZh: nextMeaning,
      examples: patch.examples ? mergeUniqueStrings(patch.examples) : current.examples,
    }
    const nextSenses = word.senses.map(sense => sense.id === senseId ? nextSense : sense)
    state.value.words = {
      ...state.value.words,
      [normalizedWordKey]: { ...word, senses: nextSenses, updatedAt: new Date().toISOString() },
    }
    if (nextId !== senseId) {
      state.value.memberships = Object.fromEntries(Object.entries(state.value.memberships).map(([setId, memberships]) => [
        setId,
        memberships.map(member => member.wordKey === normalizedWordKey
          ? { ...member, senseIds: Array.from(new Set(member.senseIds.map(id => id === senseId ? nextId : id))) }
          : member),
      ]))
      state.value.questions = state.value.questions.map((question) => {
        if (question.kind === 'reading') {
          const questions = question.questions.map(child => child.wordKey === normalizedWordKey && child.senseId === senseId
            ? { ...child, senseId: nextId }
            : child)
          return questions.some((child, index) => child !== question.questions[index])
            ? canonicalizeQuestion({ ...question, questions })
            : question
        }
        return question.wordKey === normalizedWordKey && question.senseId === senseId
          ? canonicalizeQuestion({ ...question, senseId: nextId })
          : question
      })
      useLearningStore().renameSense(senseId, nextId)
    }
    touch()
    return nextSense
  }

  function removeSenseFromSet(setId: string, wordKey: string, senseId: string): boolean {
    const membership = getMembership(setId, wordKey)
    if (!membership || !membership.senseIds.includes(senseId))
      return false
    const nextMemberships = membership.senseIds.filter(id => id !== senseId)
    const setMembers = state.value.memberships[setId] ?? []
    const nextSetMembers = nextMemberships.length
      ? setMembers.map(item => item.wordKey === membership.wordKey ? { ...item, senseIds: nextMemberships } : item)
      : setMembers.filter(item => item.wordKey !== membership.wordKey)
    const nextAllMemberships = { ...state.value.memberships, [setId]: nextSetMembers }
    state.value.memberships = nextAllMemberships
    if (!nextSetMembers.length) {
      state.value.sets = state.value.sets.filter(set => set.id !== setId)
      delete nextAllMemberships[setId]
    }
    pruneOrphans()
    touch()
    return true
  }

  function captureLearningUndoState(): LearningUndoState | null {
    const learningStore = useLearningStore()
    if (!learningStore.loaded)
      return null
    return {
      progress: cloneJson(learningStore.progress),
      stats: cloneJson(learningStore.stats),
    }
  }

  function removeSenseFromSetWithUndo(setId: string, wordKey: string, senseId: string): SenseRemovalUndoSnapshot | null {
    if (!getMembership(setId, wordKey)?.senseIds.includes(senseId))
      return null
    const libraryBefore = cloneJson(state.value)
    const learningBefore = captureLearningUndoState()
    if (!removeSenseFromSet(setId, wordKey, senseId))
      return null
    return {
      libraryBefore,
      libraryAfter: cloneJson(state.value),
      learningBefore,
      learningAfter: captureLearningUndoState(),
    }
  }

  function restoreSenseRemoval(snapshot: SenseRemovalUndoSnapshot): boolean {
    if (stableHash(state.value) !== stableHash(snapshot.libraryAfter))
      return false

    const learningStore = useLearningStore()
    const currentLearning = captureLearningUndoState()
    if (snapshot.learningAfter && (!currentLearning || stableHash(currentLearning) !== stableHash(snapshot.learningAfter)))
      return false

    state.value = cloneJson(snapshot.libraryBefore)
    saveToStorage(LIBRARY_STORAGE_KEY, state.value)
    if (snapshot.learningBefore) {
      if (!learningStore.loaded)
        return false
      learningStore.replaceProgress(cloneJson(snapshot.learningBefore.progress))
      learningStore.replaceStats(cloneJson(snapshot.learningBefore.stats))
    }
    return true
  }

  function getQuestionSetIds(question: LibraryQuestion): string[] {
    return state.value.sets
      .filter((set) => {
        const memberships = state.value.memberships[set.id] ?? []
        return questionBelongsToMemberships(question, memberships)
      })
      .map(set => set.id)
  }

  function updateQuestion(question: LibraryQuestion): boolean {
    if (!state.value.questions.some(item => item.id === question.id))
      return false
    const normalized = normalizeQuestionForStore(question)
    if (!normalized)
      return false
    if (!questionUsesWords(normalized, state.value.words) || !questionBelongsToAnyMemberships(normalized, Object.values(state.value.memberships)))
      return false
    const duplicate = state.value.questions.find(item => item.id !== normalized.id && item.fingerprint === normalized.fingerprint)
    if (duplicate)
      return false
    state.value.questions = state.value.questions.map(item => item.id === normalized.id ? normalized : item)
    touch()
    return true
  }

  function removeQuestion(questionId: string): LibraryQuestion | null {
    const removed = state.value.questions.find(question => question.id === questionId) ?? null
    if (!removed)
      return null
    state.value.questions = state.value.questions.filter(question => question.id !== questionId)
    touch()
    return removed
  }

  function getQuestionsFor(setId: string, wordKey: string, kind?: LibraryQuestion['kind']): LibraryQuestion[] {
    const member = getMembership(setId, wordKey)
    const allowedSenseIds = new Set(member?.senseIds ?? [])
    return state.value.questions.filter((question) => {
      if (kind && question.kind !== kind)
        return false
      if (question.kind !== 'multipleChoice')
        return false
      if (question.wordKey !== normalizeWordKey(wordKey))
        return false
      return Boolean(question.senseId && allowedSenseIds.has(question.senseId))
    })
  }

  function addFolder(name: string, parentId?: string): VocabFolder {
    const normalizedName = name.trim()
    const normalizedParentId = normalizeFolderParentId(parentId)
    if (!normalizedName)
      throw new Error(t('library.folderNameRequired'))
    if (normalizedParentId && !state.value.folders.some(folder => folder.id === normalizedParentId))
      throw new Error(t('library.folderNotFound'))
    if (state.value.folders.some(folder => folder.parentId === normalizedParentId && folder.name.trim().toLocaleLowerCase() === normalizedName.toLocaleLowerCase()))
      throw new Error(t('library.folderNameExists'))
    const now = new Date().toISOString()
    const folder: VocabFolder = {
      id: `folder-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: normalizedName,
      ...(normalizedParentId ? { parentId: normalizedParentId } : {}),
      order: state.value.folders.filter(item => item.parentId === normalizedParentId).length,
      createdAt: now,
      updatedAt: now,
    }
    state.value.folders = [...state.value.folders, folder]
    touch()
    return folder
  }

  function getFolderTreeIds(folderId: string): Set<string> {
    const removed = new Set([folderId])
    let changed = true
    while (changed) {
      changed = false
      for (const folder of state.value.folders) {
        if (folder.parentId && removed.has(folder.parentId) && !removed.has(folder.id)) {
          removed.add(folder.id)
          changed = true
        }
      }
    }
    return removed
  }

  function updateFolder(folderId: string, patch: { name?: string, parentId?: string }) {
    const folder = state.value.folders.find(item => item.id === folderId)
    if (!folder || folder.id === UNCATEGORIZED_FOLDER_ID)
      return false
    const normalizedName = patch.name?.trim() ?? folder.name
    if (!normalizedName)
      return false
    const nextParentId = normalizeFolderParentId(patch.parentId)
    if (nextParentId && (!state.value.folders.some(item => item.id === nextParentId) || getFolderTreeIds(folderId).has(nextParentId)))
      return false
    if (state.value.folders.some(item => item.id !== folderId && item.parentId === nextParentId && item.name.trim().toLocaleLowerCase() === normalizedName.toLocaleLowerCase()))
      return false
    state.value.folders = state.value.folders.map((item) => {
      if (item.id !== folderId)
        return item
      const { parentId: _parentId, ...withoutParent } = item
      return { ...withoutParent, name: normalizedName, ...(nextParentId ? { parentId: nextParentId } : {}), updatedAt: new Date().toISOString() }
    })
    touch()
    return true
  }

  function removeFolder(folderId: string) {
    if (folderId === UNCATEGORIZED_FOLDER_ID)
      return new Set<string>()
    const removed = getFolderTreeIds(folderId)
    const removedSetIds = new Set(state.value.sets.filter(set => removed.has(set.folderId)).map(set => set.id))
    state.value.folders = state.value.folders.filter(folder => !removed.has(folder.id))
    state.value.sets = state.value.sets.filter(set => !removedSetIds.has(set.id))
    const nextMemberships = { ...state.value.memberships }
    for (const setId of removedSetIds)
      delete nextMemberships[setId]
    state.value.memberships = nextMemberships
    pruneOrphans()
    touch()
    return removed
  }

  function replaceState(next: LibraryState) {
    state.value = normalizeLibraryState(next)
    normalizeAllMemberships()
    pruneOrphans()
    saveToStorage(LIBRARY_STORAGE_KEY, state.value)
  }

  function resetForNamespace() {
    state.value = emptyState()
    loaded.value = false
  }

  function mergeImportedState(incoming: LibraryState): LibraryMergeResult {
    const nextWords = mergeWordEntries(state.value.words, Object.values(incoming.words))

    const existingFolderIds = new Set(state.value.folders.map(folder => folder.id))
    const nextFolders = [...state.value.folders]
    for (const folder of incoming.folders) {
      if (existingFolderIds.has(folder.id))
        continue
      const parentId = normalizeFolderParentId(folder.parentId)
      const { parentId: _parentId, ...withoutParent } = folder
      nextFolders.push({ ...withoutParent, ...(parentId ? { parentId } : {}) })
      existingFolderIds.add(folder.id)
    }

    const nextSets = [...state.value.sets]
    const existingSetIds = new Set(nextSets.map(set => set.id))
    const existingNames = new Set(nextSets.map(set => set.setName.trim().toLocaleLowerCase()))
    const setIdMap = new Map<string, string>()
    let addedSets = 0

    for (const incomingSet of incoming.sets) {
      if (existingSetIds.has(incomingSet.id)) {
        setIdMap.set(incomingSet.id, incomingSet.id)
        continue
      }
      const id = incomingSet.id
      const setName = createUniqueSetName(incomingSet.setName.trim() || 'Imported set', existingNames)
      existingNames.add(setName.toLocaleLowerCase())
      nextSets.push({ ...incomingSet, id, setName })
      existingSetIds.add(id)
      setIdMap.set(incomingSet.id, id)
      addedSets += 1
    }

    const nextMemberships = { ...state.value.memberships }
    for (const incomingSet of incoming.sets) {
      const targetSetId = setIdMap.get(incomingSet.id)
      if (!targetSetId || state.value.memberships[targetSetId])
        continue
      const memberships = incoming.memberships[incomingSet.id]
      if (memberships.length)
        nextMemberships[targetSetId] = memberships.map(member => ({ wordKey: member.wordKey, senseIds: [...member.senseIds] }))
    }

    const existingQuestionIds = new Set(state.value.questions.map(question => question.id))
    const existingQuestionFingerprints = new Set(state.value.questions.map(question => question.fingerprint))
    const nextQuestions = [...state.value.questions]
    let addedQuestions = 0
    for (const incomingQuestion of incoming.questions) {
      const question = incomingQuestion
      if (existingQuestionIds.has(question.id) || existingQuestionFingerprints.has(question.fingerprint))
        continue
      if (!questionUsesWords(question, nextWords))
        continue
      nextQuestions.push(question)
      existingQuestionIds.add(question.id)
      existingQuestionFingerprints.add(question.fingerprint)
      addedQuestions += 1
    }

    state.value = {
      ...state.value,
      words: nextWords,
      sets: nextSets,
      memberships: nextMemberships,
      folders: nextFolders,
      questions: nextQuestions,
    }
    normalizeAllMemberships()
    const populatedSetIds = new Set(Object.keys(state.value.memberships))
    state.value.sets = state.value.sets.filter(set => populatedSetIds.has(set.id))
    pruneOrphans()
    touch()
    return { addedSets, addedQuestions }
  }

  async function loadState() {
    if (loaded.value)
      return
    const stored = await loadFromStorage(LIBRARY_STORAGE_KEY)
    if (stored.value) {
      try {
        state.value = normalizeLibraryState(JSON.parse(stored.value))
        normalizeAllMemberships()
        pruneOrphans()
      }
      catch {
        state.value = emptyState()
      }
    }
    loaded.value = true
  }

  return {
    state,
    words,
    sets,
    folders,
    questions,
    loaded,
    loadState,
    replaceState,
    resetForNamespace,
    mergeImportedState,
    importWords,
    importQuestions,
    getSet,
    createSetWithContent,
    addWordToSets,
    updateSetWithContent,
    updateSet,
    removeSet,
    unlinkSet,
    getWord,
    getSetWords,
    getSetStudyWords,
    replaceSetMemberships,
    getMembership,
    getSenseSetIds,
    getSenseSetNames,
    updateSense,
    removeSenseFromSet,
    removeSenseFromSetWithUndo,
    restoreSenseRemoval,
    getQuestionsFor,
    getQuestionSetIds,
    updateQuestion,
    removeQuestion,
    addFolder,
    getFolderTreeIds,
    updateFolder,
    removeFolder,
  }
})

import type { LibraryQuestion, LibraryState, VocabFolder, VocabSet, VocabSetMember, WordEntry, WordSense } from '@/types'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { LIBRARY_STORAGE_KEY } from '@/constants'
import { stableHash } from '@/lib/hash'
import { canonicalizeQuestion, itemToMembership, itemToWordEntry, mergeWord, normalizeWordKey } from '@/lib/library'
import { loadFromStorage, saveToStorage } from '@/lib/persist'

const CURRENT_VERSION = 1

function emptyState(): LibraryState {
  return {
    version: CURRENT_VERSION,
    words: {},
    memberships: {},
    folders: [],
    questions: [],
    updatedAt: new Date().toISOString(),
  }
}

function normalizeQuestions(value: unknown): LibraryQuestion[] {
  if (!Array.isArray(value))
    return []
  const byId = new Map<string, LibraryQuestion>()
  for (const question of value) {
    if (!question || typeof question !== 'object' || Array.isArray(question))
      continue
    const normalized = canonicalizeQuestion(question as LibraryQuestion)
    byId.set(normalized.id, normalized)
  }
  return Array.from(byId.values())
}

function normalizeState(value: unknown): LibraryState {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return emptyState()
  const source = value as Partial<LibraryState>
  const base = emptyState()
  return {
    version: Number(source.version) || CURRENT_VERSION,
    words: source.words && typeof source.words === 'object' ? source.words as Record<string, WordEntry> : {},
    memberships: source.memberships && typeof source.memberships === 'object' ? source.memberships as Record<string, VocabSetMember[]> : {},
    folders: Array.isArray(source.folders) ? source.folders as VocabFolder[] : [],
    questions: normalizeQuestions(source.questions),
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : base.updatedAt,
  }
}

export const useLibraryStore = defineStore('library', () => {
  const state = ref<LibraryState>(emptyState())
  const loaded = ref(false)

  const words = computed(() => Object.values(state.value.words))
  const folders = computed(() => [...state.value.folders].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)))
  const questions = computed(() => state.value.questions)

  function touch() {
    state.value.updatedAt = new Date().toISOString()
    saveToStorage(LIBRARY_STORAGE_KEY, state.value)
  }

  function upsertWordInternal(incoming: WordEntry): WordEntry {
    const wordKey = normalizeWordKey(incoming.wordKey || incoming.word)
    const normalized = { ...incoming, wordKey }
    const existing = state.value.words[wordKey]
    const merged = mergeWord(existing, normalized)
    if (merged !== existing)
      state.value.words = { ...state.value.words, [wordKey]: merged }
    return merged
  }

  function upsertWord(incoming: WordEntry): WordEntry {
    const result = upsertWordInternal(incoming)
    touch()
    return result
  }

  function upsertSense(wordKey: string, sense: WordSense): WordEntry | null {
    const existing = state.value.words[normalizeWordKey(wordKey)]
    if (!existing)
      return null
    return upsertWord({ ...existing, senses: [...existing.senses, sense] })
  }

  function importWords(entries: WordEntry[]) {
    for (const entry of entries)
      upsertWordInternal(entry)
    touch()
  }

  function importQuestions(entries: LibraryQuestion[]) {
    const byId = new Map(state.value.questions.map(question => [question.id, question]))
    for (const question of entries) {
      const normalized = canonicalizeQuestion(question)
      byId.set(normalized.id, normalized)
    }
    state.value.questions = Array.from(byId.values())
    touch()
  }

  function linkSet(set: VocabSet) {
    const previousWords = state.value.words
    const nextMemberships = new Map<string, VocabSetMember>()
    for (const item of set.items) {
      upsertWordInternal(itemToWordEntry(item))
      const membership = itemToMembership(item)
      const existing = nextMemberships.get(membership.wordKey)
      if (existing) {
        existing.senseIds = Array.from(new Set([...existing.senseIds, ...membership.senseIds]))
        existing.tags = Array.from(new Set([...existing.tags, ...membership.tags]))
        existing.note = membership.note || existing.note
        existing.favorite = Boolean(existing.favorite || membership.favorite)
      }
      else {
        nextMemberships.set(membership.wordKey, { ...membership })
      }
    }
    const memberships = Array.from(nextMemberships.values())
    const currentMemberships = state.value.memberships[set.id] ?? []
    const membershipsChanged = JSON.stringify(currentMemberships) !== JSON.stringify(memberships)
    if (membershipsChanged)
      state.value.memberships = { ...state.value.memberships, [set.id]: memberships }
    const wordsChanged = state.value.words !== previousWords
    const orphansPruned = pruneOrphans()
    if (membershipsChanged || wordsChanged || orphansPruned)
      touch()
  }

  function unlinkSet(setId: string) {
    if (!(setId in state.value.memberships))
      return
    const nextMemberships = { ...state.value.memberships }
    delete nextMemberships[setId]
    state.value.memberships = nextMemberships
    pruneOrphans()
    touch()
  }

  function pruneOrphans(): boolean {
    const memberships = Object.values(state.value.memberships).flat()
    const referenced = new Set(memberships.map(member => normalizeWordKey(member.wordKey)))
    const senseReferences = new Map<string, Set<string>>()
    const keepAllSenses = new Set<string>()
    for (const member of memberships) {
      const wordKey = normalizeWordKey(member.wordKey)
      if (!member.senseIds.length) {
        keepAllSenses.add(wordKey)
        continue
      }
      const senseIds = senseReferences.get(wordKey) ?? new Set<string>()
      for (const senseId of member.senseIds)
        senseIds.add(senseId)
      senseReferences.set(wordKey, senseIds)
    }

    function keepsLink(wordKey: string, senseId?: string): boolean {
      const normalizedWordKey = normalizeWordKey(wordKey)
      if (!referenced.has(normalizedWordKey))
        return false
      return !senseId || keepAllSenses.has(normalizedWordKey) || Boolean(senseReferences.get(normalizedWordKey)?.has(senseId))
    }

    const nextWords = Object.fromEntries(Object.entries(state.value.words)
      .filter(([wordKey]) => referenced.has(wordKey))
      .map(([wordKey, word]) => {
        if (keepAllSenses.has(wordKey) || !senseReferences.get(wordKey)?.size)
          return [wordKey, word]
        const senseIds = senseReferences.get(wordKey)!
        const senses = word.senses.filter(sense => senseIds.has(sense.id))
        return [wordKey, senses.length ? { ...word, senses } : word]
      }))

    const nextQuestions: LibraryQuestion[] = []
    for (const question of state.value.questions) {
      if (question.kind !== 'reading') {
        if (!question.wordKey || keepsLink(question.wordKey, question.senseId))
          nextQuestions.push(question)
        continue
      }

      const wordKeys = question.wordKeys.map(normalizeWordKey).filter(wordKey => referenced.has(wordKey))
      const questions = question.questions.filter((child) => {
        if (child.wordKey)
          return keepsLink(child.wordKey, child.senseId)
        return wordKeys.length > 0
      })
      if (!wordKeys.length && !questions.length)
        continue
      if (question.senseId && !wordKeys.some(wordKey => keepsLink(wordKey, question.senseId)))
        continue
      nextQuestions.push({ ...question, wordKeys, questions })
    }

    const wordsChanged = stableHash(nextWords) !== stableHash(state.value.words)
    const questionsChanged = stableHash(nextQuestions) !== stableHash(state.value.questions)
    if (wordsChanged)
      state.value.words = nextWords
    if (questionsChanged)
      state.value.questions = nextQuestions
    return wordsChanged || questionsChanged
  }

  function getWord(word: string): WordEntry | null {
    return state.value.words[normalizeWordKey(word)] ?? null
  }

  function getSetWords(setId: string): WordEntry[] {
    return (state.value.memberships[setId] ?? [])
      .map(member => state.value.words[member.wordKey])
      .filter((word): word is WordEntry => Boolean(word))
  }

  function getMembership(setId: string, wordKey: string): VocabSetMember | null {
    return state.value.memberships[setId]?.find(member => member.wordKey === normalizeWordKey(wordKey)) ?? null
  }

  function getQuestionsFor(setId: string, wordKey: string, kind?: LibraryQuestion['kind']): LibraryQuestion[] {
    const member = getMembership(setId, wordKey)
    const allowedSenseIds = new Set(member?.senseIds ?? [])
    return state.value.questions.filter((question) => {
      if (kind && question.kind !== kind)
        return false
      if (question.wordKey !== normalizeWordKey(wordKey))
        return false
      return !question.senseId || !allowedSenseIds.size || allowedSenseIds.has(question.senseId)
    })
  }

  function addFolder(name: string, parentId?: string): VocabFolder {
    const now = new Date().toISOString()
    const folder: VocabFolder = {
      id: `folder-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim(),
      parentId,
      order: state.value.folders.filter(item => item.parentId === parentId).length,
      createdAt: now,
      updatedAt: now,
    }
    state.value.folders = [...state.value.folders, folder]
    touch()
    return folder
  }

  function updateFolder(folderId: string, name: string) {
    state.value.folders = state.value.folders.map(folder => folder.id === folderId ? { ...folder, name: name.trim(), updatedAt: new Date().toISOString() } : folder)
    touch()
  }

  function removeFolder(folderId: string) {
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
    state.value.folders = state.value.folders.filter(folder => !removed.has(folder.id))
    touch()
    return removed
  }

  function replaceState(next: LibraryState) {
    state.value = normalizeState(next)
    saveToStorage(LIBRARY_STORAGE_KEY, state.value)
  }

  async function loadState() {
    if (loaded.value)
      return
    const stored = await loadFromStorage(LIBRARY_STORAGE_KEY)
    if (stored.value) {
      try {
        state.value = normalizeState(JSON.parse(stored.value))
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
    folders,
    questions,
    loaded,
    loadState,
    replaceState,
    upsertWord,
    upsertSense,
    importWords,
    importQuestions,
    linkSet,
    unlinkSet,
    getWord,
    getSetWords,
    getMembership,
    getQuestionsFor,
    addFolder,
    updateFolder,
    removeFolder,
    touch,
  }
})

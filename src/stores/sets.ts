import type { EditorItem, ImportMode, ImportResult, VersionDiff, VocabSet, WordEntry } from '@/types'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { SETS_STORAGE_KEY } from '@/constants'
import { buildExportFileName, buildExportZipBlob, downloadBlob } from '@/lib/file'
import { folderIdFromSelection, UNCATEGORIZED_FOLDER_ID } from '@/lib/folders'
import { i18n } from '@/lib/i18n'
import { applyImportedSets, parseImportJson, refreshImportVersionDiffs, summarizeDuplicateResult } from '@/lib/import'
import { loadFromStorage, saveToStorage } from '@/lib/persist'
import { deduplicateSetsByName } from '@/lib/set-utils'
import { createBlankEditorItem, createEditorItems, normalizeItem, normalizeSet } from '@/lib/validation'
import { useLibraryStore } from './library'
import { useSessionStore } from './session'
import { useUIStore } from './ui'

const t = i18n.global.t

export const useSetsStore = defineStore('sets', () => {
  const sets = ref<VocabSet[]>([])
  const activeSetId = ref<string | null>(null)

  const setEditorOpen = ref(false)
  const setEditorMode = ref<'create' | 'edit'>('create')
  const setEditorId = ref<string | null>(null)
  const setEditorName = ref('')
  const setEditorFolderId = ref<string | undefined>(undefined)
  const setEditorError = ref('')
  const setEditorDraftItems = ref<EditorItem[]>([])
  const pendingSetItems = ref<EditorItem[]>([])

  const importOpen = ref(false)
  const importStep = ref(1)
  const importWords = ref('')
  const importJson = ref('')
  const importError = ref('')
  const importPreview = ref('')
  const importDifficulty = ref(2)
  const importFolderId = ref(UNCATEGORIZED_FOLDER_ID)
  const pendingDeleteId = ref<string | null>(null)

  const importMode = ref<ImportMode>('append')
  const duplicateSummary = ref<ImportResult | null>(null)
  const importVersionDiffs = ref<VersionDiff[]>([])
  const importVersionChoices = ref<Record<string, string>>({})

  const hasSets = computed(() => sets.value.length > 0)
  const activeSet = computed(() => sets.value.find(set => set.id === activeSetId.value) ?? null)
  const totalWordCount = computed(() => sets.value.reduce((sum, set) => sum + set.items.length, 0))

  const exportSelectedIds = ref<string[]>([])
  const exportSelectedSets = computed(() =>
    sets.value.filter(set => exportSelectedIds.value.includes(set.id)),
  )
  const exportSelectedCount = computed(() => exportSelectedSets.value.length)
  const exportSelectedWordCount = computed(() =>
    exportSelectedSets.value.reduce((sum, set) => sum + set.items.length, 0),
  )
  const exportAllSelected = computed(() =>
    sets.value.length > 0 && exportSelectedCount.value === sets.value.length,
  )
  const exportError = ref('')

  function saveState() {
    saveToStorage(SETS_STORAGE_KEY, {
      sets: sets.value,
      activeSetId: activeSetId.value,
    })
  }

  function applyRemoteSets(remoteSets: VocabSet[]) {
    const canonicalSets = deduplicateSetsByName(remoteSets)
    sets.value = canonicalSets
    exportSelectedIds.value = canonicalSets.map(set => set.id)
    if (activeSetId.value && canonicalSets.some(set => set.id === activeSetId.value)) {
      saveState()
      return
    }
    activeSetId.value = canonicalSets[0]?.id ?? null
    saveState()
    for (const set of canonicalSets)
      useLibraryStore().linkSet(set)
  }

  async function loadState() {
    const loaded = await loadFromStorage(SETS_STORAGE_KEY)
    if (!loaded.value)
      return

    try {
      const parsed = JSON.parse(loaded.value)
      if (Array.isArray(parsed.sets)) {
        const sanitizedSets = deduplicateSetsByName<VocabSet>(parsed.sets
          .map((set: unknown, index: number) => {
            try {
              return normalizeSet(set, (set as Record<string, unknown>)?.id as string ?? `saved-${index + 1}`)
            }
            catch {
              return null
            }
          })
          .filter((set: VocabSet | null): set is VocabSet => set !== null))

        sets.value = sanitizedSets
        exportSelectedIds.value = sanitizedSets.map((s: VocabSet) => s.id)
        const validSetIds = new Set(sanitizedSets.map((s: VocabSet) => s.id))
        if (parsed.activeSetId && validSetIds.has(parsed.activeSetId)) {
          activeSetId.value = parsed.activeSetId
        }
        else if (sanitizedSets.length > 0) {
          activeSetId.value = sanitizedSets[0].id
        }
      }
    }
    catch {
      // Ignore parse errors
    }
  }

  function ensureActiveSet(setId: string) {
    activeSetId.value = setId
    saveState()
  }

  function moveSetToFolder(setId: string, folderId?: string) {
    const target = sets.value.find(set => set.id === setId)
    if (!target || target.folderId === folderId)
      return
    const nextSet = { ...target, folderId: folderId || undefined, updatedAt: new Date().toISOString() }
    sets.value = sets.value.map(set => set.id === setId ? nextSet : set)
    saveState()
    useLibraryStore().linkSet(nextSet)
  }

  function isSetInProgress(setId: string): boolean {
    const sessionStore = useSessionStore()
    return sessionStore.isSetInProgress(setId)
  }

  function openSetEditor(mode: 'create' | 'edit', set?: VocabSet | null) {
    setEditorMode.value = mode
    setEditorId.value = set?.id ?? null
    setEditorName.value = set?.setName ?? ''
    setEditorFolderId.value = set?.folderId
    setEditorDraftItems.value = mode === 'edit' && set ? createEditorItems(set.items) : []
    pendingSetItems.value = mode === 'create' ? [...pendingSetItems.value] : []
    setEditorError.value = ''
    setEditorOpen.value = true
  }

  function closeSetEditor() {
    setEditorOpen.value = false
  }

  function createSetFromItems(
    sourceItems: Array<Pick<EditorItem, 'word' | 'pos' | 'meaning'> & Partial<EditorItem>>,
    name = '',
    difficulty = 2,
    folderId?: string,
  ): VocabSet | null {
    const uiStore = useUIStore()
    try {
      const items = sourceItems.map((item, index) => normalizeItem(item, index))
      if (!items.length)
        throw new Error(t('editor.itemsRequired'))

      const now = new Date()
      const fallbackName = `單字集 ${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      const nextSet: VocabSet = {
        id: `${Date.now()}`,
        setName: name.trim() || fallbackName,
        difficulty: typeof difficulty === 'number' ? difficulty : 2,
        items,
        folderId,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      }
      const existing = sets.value.find(set => set.setName.trim().toLocaleLowerCase() === nextSet.setName.toLocaleLowerCase())
      const savedSet = existing ? { ...nextSet, id: existing.id, createdAt: existing.createdAt } : nextSet
      sets.value = deduplicateSetsByName([...sets.value.filter(set => set.id !== existing?.id), savedSet])
      exportSelectedIds.value = sets.value.map(set => set.id)
      activeSetId.value = savedSet.id
      saveState()
      useLibraryStore().linkSet(savedSet)
      setEditorOpen.value = false
      importOpen.value = false
      setEditorError.value = ''
      uiStore.showToast(t(existing ? 'editor.replaced' : 'editor.created', { name: savedSet.setName, count: savedSet.items.length }))
      return savedSet
    }
    catch (error) {
      setEditorError.value = (error as Error).message
      return null
    }
  }

  function saveSetEditor() {
    const uiStore = useUIStore()
    try {
      if (!setEditorName.value.trim()) {
        throw new Error(t('editor.nameRequired'))
      }

      const sourceItems = setEditorMode.value === 'create' ? pendingSetItems.value : setEditorDraftItems.value
      const items = sourceItems.map((item, index) => normalizeItem(item, index))

      if (!items.length) {
        throw new Error(t('editor.itemsRequired'))
      }

      if (setEditorMode.value === 'create') {
        createSetFromItems(items, setEditorName.value, importDifficulty.value, setEditorFolderId.value)
        return
      }
      else {
        const targetIndex = sets.value.findIndex(s => s.id === setEditorId.value)
        if (targetIndex === -1)
          throw new Error(t('editor.notFound'))

        const nextSet: VocabSet = {
          ...sets.value[targetIndex],
          setName: setEditorName.value.trim(),
          items,
          folderId: setEditorFolderId.value || undefined,
          updatedAt: new Date().toISOString(),
        }
        sets.value = sets.value.map(s => (s.id === setEditorId.value ? nextSet : s))

        const sessionStore = useSessionStore()
        if (sessionStore.isSetInProgress(nextSet.id) || sessionStore.currentSession?.sourceSetId === nextSet.id) {
          sessionStore.clearSessionsForSet(nextSet.id)
        }
        uiStore.showToast(t('editor.updated', { name: nextSet.setName, count: nextSet.items.length }))
      }

      saveState()
      useLibraryStore().linkSet(sets.value.find(set => set.id === setEditorId.value)!)
      setEditorOpen.value = false
      importOpen.value = false
    }
    catch (error) {
      setEditorError.value = (error as Error).message
    }
  }

  function addEditorItem() {
    setEditorDraftItems.value = [...setEditorDraftItems.value, createBlankEditorItem(setEditorDraftItems.value.length)]
  }

  function removeEditorItem(index: number) {
    setEditorDraftItems.value = setEditorDraftItems.value.filter((_, i) => i !== index)
  }

  function openImport(folderId?: string) {
    importStep.value = 1
    importWords.value = ''
    importJson.value = ''
    importError.value = ''
    importPreview.value = ''
    importDifficulty.value = 2
    importFolderId.value = folderId ?? UNCATEGORIZED_FOLDER_ID
    importOpen.value = true
  }

  function closeImport() {
    importOpen.value = false
  }

  function nextImportStep() {
    importStep.value = 2
  }

  function importSet() {
    const result = parseImportJson(importJson.value.trim())
    if (!result.valid) {
      importError.value = result.error
      return
    }

    createSetFromItems(result.data.items, result.data.setName, result.data.difficulty, folderIdFromSelection(importFolderId.value))
  }

  async function requestDelete(setId: string) {
    pendingDeleteId.value = setId
    const uiStore = useUIStore()
    const lastSet = sets.value.length <= 1
    const confirmed = await uiStore.showConfirm(
      t('confirm.deleteTitle'),
      lastSet ? t('confirm.deleteLastMessage') : t('confirm.deleteMessage'),
    )
    if (!confirmed)
      return

    const sessionStore = useSessionStore()
    if (lastSet) {
      sets.value = []
      activeSetId.value = null
      useLibraryStore().unlinkSet(pendingDeleteId.value!)
      sessionStore.resetStudyView()
    }
    else {
      sets.value = sets.value.filter(s => s.id !== pendingDeleteId.value)
      useLibraryStore().unlinkSet(pendingDeleteId.value!)
      sessionStore.clearSessionsForSet(pendingDeleteId.value!)
      if (activeSetId.value === pendingDeleteId.value) {
        activeSetId.value = sets.value[0]?.id ?? null
      }
    }

    saveState()
    pendingDeleteId.value = null
  }

  async function deleteActiveSet() {
    if (!activeSet.value)
      return
    await requestDelete(activeSet.value.id)
  }

  function editActiveSet() {
    if (!activeSet.value)
      return
    openSetEditor('edit', activeSet.value)
  }

  function addItemToSet(setId: string, draft: Pick<EditorItem, 'word' | 'meaning' | 'example' | 'pos'> & Partial<EditorItem>) {
    const target = sets.value.find(set => set.id === setId)
    if (!target)
      return false

    const word = draft.word.trim()
    const item = normalizeItem({
      ...draft,
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      word,
      meaning: draft.meaning.trim(),
      example: draft.example.trim() || `I am learning the word ${word}.`,
    }, target.items.length)

    const nextSet = {
      ...target,
      items: [...target.items, item],
      updatedAt: new Date().toISOString(),
    }
    sets.value = sets.value.map(set => set.id === setId ? nextSet : set)
    saveState()
    useLibraryStore().linkSet(nextSet)
    useUIStore().showToast(t('dictionary.addedToSet', { word }))
    return true
  }

  function importLibraryWords(words: WordEntry[], setName: string, folderId?: string) {
    if (!words.length)
      return null
    const items = words.map((word, index) => {
      const sense = word.senses[0]
      return normalizeItem({
        id: `library-${word.wordKey}-${index}`,
        word: word.word,
        pos: sense?.pos ?? '',
        meaning: sense?.meaningZh ?? '',
        example: sense?.examples[0] ?? '',
        definition: sense?.definitionEn,
        phonetic: word.phonetic,
        audioUrl: word.audioUrl,
        origin: word.origin,
        dictionarySource: word.dictionarySource,
        synonyms: word.synonyms,
        antonyms: word.antonyms,
      }, index)
    })
    const set = normalizeSet({ id: `import-${Date.now()}`, setName: setName.trim() || `匯入單字 ${new Date().toLocaleDateString()}`, difficulty: 2, items, folderId })
    sets.value = deduplicateSetsByName([...sets.value, set])
    exportSelectedIds.value = sets.value.map(item => item.id)
    activeSetId.value = set.id
    saveState()
    useLibraryStore().linkSet(set)
    return set
  }

  function toggleExportAll() {
    exportSelectedIds.value = exportAllSelected.value ? [] : sets.value.map(s => s.id)
  }

  async function exportSelectedSetsToZip() {
    const uiStore = useUIStore()
    exportError.value = ''
    if (!exportSelectedSets.value.length) {
      exportError.value = t('backup.selectAtLeastOne')
      return
    }

    const blob = await buildExportZipBlob(exportSelectedSets.value)
    downloadBlob(blob, buildExportFileName())
    uiStore.showToast(t('backup.exported', { count: exportSelectedSets.value.length }))
  }

  function refreshDiffs(targetSets: VocabSet[]) {
    const { diffs, choices } = refreshImportVersionDiffs(sets.value, targetSets, importVersionChoices.value)
    importVersionDiffs.value = diffs
    importVersionChoices.value = choices
  }

  function resetImportVersionDiffs() {
    importVersionDiffs.value = []
    importVersionChoices.value = {}
  }

  function setImportVersionChoice(setName: string, choice: string) {
    importVersionChoices.value = { ...importVersionChoices.value, [setName]: choice }
  }

  function applyImported(targetSets: VocabSet[], mode: ImportMode, folderId?: string): ImportResult | null {
    const uiStore = useUIStore()
    const sessionStore = useSessionStore()

    const result = applyImportedSets(sets.value, targetSets, mode, importVersionChoices.value)

    if (mode === 'overwrite') {
      sets.value = result.imported.map(set => ({ ...set, folderId, updatedAt: new Date().toISOString() }))
      exportSelectedIds.value = result.imported.map(s => s.id)
      activeSetId.value = result.imported[0]?.id ?? null
      sessionStore.resetStudyView()
      saveState()
      duplicateSummary.value = result
      uiStore.showToast(t('backup.overwriteSuccess', { count: result.imported.length }))
      return result
    }

    const replacedSetIds = new Set(
      sets.value
        .filter(s => result.replacedVersions.includes(s.setName))
        .map(s => s.id),
    )

    const nextSets = sets.value.map((s) => {
      if (result.replacedVersions.includes(s.setName)) {
        const replacement = result.imported.find(imp => imp.setName === s.setName)
        return replacement ? { ...replacement, id: s.id, folderId, updatedAt: new Date().toISOString() } : s
      }
      return s
    })

    const newSets = result.imported
      .filter(imp => !result.replacedVersions.includes(imp.setName))
      .map(set => ({ ...set, folderId, updatedAt: new Date().toISOString() }))
    sets.value = [...nextSets, ...newSets]
    exportSelectedIds.value = [...exportSelectedIds.value, ...newSets.map(s => s.id)]

    if (result.replacedVersions.length) {
      for (const id of replacedSetIds)
        sessionStore.clearSessionsForSet(id)
    }

    if (!activeSetId.value && newSets.length > 0) {
      activeSetId.value = newSets[0].id
    }

    saveState()
    for (const set of sets.value)
      useLibraryStore().linkSet(set)
    duplicateSummary.value = result
    const text = summarizeDuplicateResult(result)
    uiStore.showToast(text ? `${t('backup.importSuccess', { count: result.imported.length })}；${text}` : t('backup.importSuccess', { count: result.imported.length }))
    return result
  }

  return {
    sets,
    applyRemoteSets,
    activeSetId,
    hasSets,
    activeSet,
    totalWordCount,
    setEditorOpen,
    setEditorMode,
    setEditorId,
    setEditorName,
    setEditorFolderId,
    setEditorError,
    setEditorDraftItems,
    pendingSetItems,
    importOpen,
    importStep,
    importWords,
    importJson,
    importError,
    importPreview,
    importDifficulty,
    importFolderId,
    pendingDeleteId,
    importMode,
    duplicateSummary,
    importVersionDiffs,
    importVersionChoices,
    exportSelectedIds,
    exportSelectedSets,
    exportSelectedCount,
    exportSelectedWordCount,
    exportAllSelected,
    exportError,
    saveState,
    loadState,
    ensureActiveSet,
    moveSetToFolder,
    isSetInProgress,
    openSetEditor,
    closeSetEditor,
    createSetFromItems,
    saveSetEditor,
    addEditorItem,
    removeEditorItem,
    openImport,
    closeImport,
    nextImportStep,
    importSet,
    requestDelete,
    deleteActiveSet,
    editActiveSet,
    addItemToSet,
    importLibraryWords,
    toggleExportAll,
    exportSelectedSetsToZip,
    refreshDiffs,
    resetImportVersionDiffs,
    setImportVersionChoice,
    applyImported,
  }
})

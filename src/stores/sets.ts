import type { EditorItem, ImportResult, LibrarySet, LibrarySetSummary, LibraryState, SetMembership, SharedSet, WordEntry } from '@/types'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { cloneJson } from '@/lib/clone'
import { syncAfterLocalCommit } from '@/lib/commit-sync'
import { buildExportFileName, buildExportZipBlob, downloadBlob } from '@/lib/file'
import { UNCATEGORIZED_FOLDER_ID } from '@/lib/folders'
import { i18n } from '@/lib/i18n'
import { itemToMembership, itemToWordEntry, normalizeWordKey } from '@/lib/library'
import { getLibraryRepository } from '@/lib/library-repository'
import { questionBelongsToMemberships } from '@/lib/question-ownership'
import { createUniqueSetName } from '@/lib/set-name'
import { createBlankSenseDraft } from '@/lib/validation'
import { useLibraryStore } from './library'
import { useSessionStore } from './session'
import { useUIStore } from './ui'

const t = i18n.global.t

export const useSetsStore = defineStore('sets', () => {
  const router = useRouter()
  const libraryStore = useLibraryStore()
  const sets = computed(() => libraryStore.sets)
  const activeSetId = ref<string | null>(null)
  const activeSet = computed(() => sets.value.find(set => set.id === activeSetId.value) ?? null)
  const hasSets = computed(() => sets.value.length > 0)
  const totalWordCount = computed(() => sets.value.reduce((sum, set) => sum + ((set as LibrarySetSummary).senseCount ?? libraryStore.getSetStudyWords(set.id).length), 0))

  const setEditorMode = ref<'create' | 'edit'>('create')
  const setEditorId = ref<string | null>(null)
  const setEditorName = ref('')
  const setEditorFolderId = ref<string | undefined>(undefined)
  const setEditorError = ref('')
  const setEditorDraftItems = ref<EditorItem[]>([])

  const importOpen = ref(false)
  const importError = ref('')
  const importPreview = ref('')
  const importFolderId = ref(UNCATEGORIZED_FOLDER_ID)
  const pendingDeleteId = ref<string | null>(null)

  const exportSelectedIds = ref<string[]>([])
  const exportSelectedSets = computed<SharedSet[]>(() => sets.value
    .filter(set => exportSelectedIds.value.includes(set.id))
    .map(toSharedSet))
  const selectedSummarySets = computed(() => sets.value.filter(set => exportSelectedIds.value.includes(set.id)))
  const exportSelectedCount = computed(() => selectedSummarySets.value.length)
  const exportSelectedWordCount = computed(() => selectedSummarySets.value.reduce((total, set) => total + ((set as LibrarySetSummary).senseCount ?? libraryStore.getSetStudyWords(set.id).length), 0))
  const exportAllSelected = computed(() => sets.value.length > 0 && exportSelectedCount.value === sets.value.length)
  const exportError = ref('')

  function toSharedSetFromState(set: LibrarySet, library: LibraryState): SharedSet {
    const memberships = (library.memberships[set.id] ?? []).map(membership => ({
      wordKey: membership.wordKey,
      senseIds: [...membership.senseIds],
    }))
    const words = memberships
      .map((membership) => {
        const word = library.words[normalizeWordKey(membership.wordKey)]
        if (!word)
          return null
        const senseIds = new Set(membership.senseIds)
        return {
          ...cloneJson(word),
          senses: word.senses.filter(sense => senseIds.has(sense.id)),
        }
      })
      .filter((word): word is WordEntry => Boolean(word))
    const questions = library.questions
      .filter(question => questionBelongsToMemberships(question, memberships))
      .map(question => cloneJson(question))
    return {
      ...set,
      memberships,
      words,
      questions,
    }
  }

  function toSharedSet(set: LibrarySet): SharedSet {
    return toSharedSetFromState(set, libraryStore.state)
  }

  function getSetWordCount(setId: string): number {
    const set = sets.value.find(item => item.id === setId)
    return (set as LibrarySetSummary | undefined)?.senseCount ?? libraryStore.getSetStudyWords(setId).length
  }

  function wordToEditorItem(word: WordEntry, setId: string): EditorItem {
    const membership = libraryStore.getMembership(setId, word.wordKey)
    const allowedSenseIds = new Set(membership?.senseIds ?? [])
    return {
      id: `editor-${word.wordKey}`,
      word: word.word,
      senses: word.senses
        .filter(sense => allowedSenseIds.has(sense.id))
        .map(sense => ({ id: sense.id, pos: sense.pos, meaning: sense.meaningZh, examples: [...sense.examples] })),
    }
  }

  function prepareSetContent(sourceItems: Array<Pick<EditorItem, 'word' | 'senses'>>): { entries: WordEntry[], memberships: SetMembership[] } {
    const entries = sourceItems
      .map(item => ({
        ...item,
        word: item.word.trim(),
        senses: item.senses.map(sense => ({
          ...sense,
          pos: sense.pos.trim(),
          meaning: sense.meaning.trim(),
          examples: sense.examples.map(example => example.trim()).filter(Boolean),
        })),
      }))
      .filter(item => item.word && item.senses.length)
      .map(itemToWordEntry)
    if (!entries.length)
      throw new Error(t('editor.itemsRequired'))

    const memberships = new Map<string, SetMembership>()
    for (const entry of entries) {
      const membership = itemToMembership({ word: entry.word, senses: entry.senses.map(sense => ({ id: sense.id, pos: sense.pos, meaning: sense.meaningZh, examples: sense.examples })) })
      const current = memberships.get(membership.wordKey)
      memberships.set(membership.wordKey, current
        ? { ...current, senseIds: Array.from(new Set([...current.senseIds, ...membership.senseIds])) }
        : membership)
    }
    return { entries, memberships: Array.from(memberships.values()) }
  }

  async function loadState() {
    await libraryStore.loadState()
    exportSelectedIds.value = sets.value.map(set => set.id)
    if (!activeSetId.value)
      activeSetId.value = sets.value[0]?.id ?? null
  }

  function resetForNamespace() {
    activeSetId.value = null
    setEditorMode.value = 'create'
    setEditorId.value = null
    setEditorName.value = ''
    setEditorFolderId.value = undefined
    setEditorError.value = ''
    setEditorDraftItems.value = []
    importOpen.value = false
    importError.value = ''
    importPreview.value = ''
    importFolderId.value = UNCATEGORIZED_FOLDER_ID
    pendingDeleteId.value = null
    exportSelectedIds.value = []
    exportError.value = ''
  }

  function ensureActiveSet(setId: string) {
    if (sets.value.some(set => set.id === setId))
      activeSetId.value = setId
  }

  function moveSetToFolder(setId: string, folderId?: string) {
    if (!libraryStore.getSet(setId))
      return
    libraryStore.updateSet(setId, { folderId: folderId || undefined })
  }

  function isSetInProgress(setId: string): boolean {
    return useSessionStore().isSetInProgress(setId)
  }

  function prepareSetEditor(mode: 'create' | 'edit', set?: LibrarySet | null) {
    setEditorMode.value = mode
    setEditorId.value = set?.id ?? null
    setEditorName.value = set?.setName ?? ''
    setEditorFolderId.value = set?.folderId
    setEditorDraftItems.value = mode === 'edit' && set
      ? libraryStore.getSetWords(set.id).map(word => wordToEditorItem(word, set.id))
      : [{ id: `editor-${crypto.randomUUID()}`, word: '', senses: [createBlankSenseDraft()] }]
    setEditorError.value = ''
  }

  function setSetEditorName(value: string) {
    setEditorName.value = value
  }

  function setSetEditorFolderId(value: string | undefined) {
    setEditorFolderId.value = value
  }

  function setSetEditorError(value: string) {
    setEditorError.value = value
  }

  function editorErrorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : ''
    const knownMessages = [
      t('editor.nameRequired'),
      t('editor.itemsRequired'),
      t('editor.nameExists'),
      t('editor.notFound'),
      t('library.folderNotFound'),
    ]
    return knownMessages.includes(message) ? message : t('editor.saveFailed')
  }

  function updateSetEditorItem(index: number, item: EditorItem) {
    setEditorDraftItems.value = setEditorDraftItems.value.map((current, currentIndex) => currentIndex === index ? item : current)
  }

  function openSetEditor(mode: 'create' | 'edit', set?: LibrarySet | null) {
    prepareSetEditor(mode, set)
    void router.push(mode === 'create'
      ? { name: 'set-create' }
      : { name: 'set-edit', params: { setId: set?.id ?? '' } })
  }

  function closeSetEditor() {
    if (router.currentRoute.value.name === 'set-create' || router.currentRoute.value.name === 'set-edit')
      void router.push({ name: 'library' })
  }

  function createSetFromItems(sourceItems: Array<Pick<EditorItem, 'word' | 'senses'> & Partial<Pick<EditorItem, 'id'>>>, name: string, folderId?: string): LibrarySet | null {
    try {
      if (!name.trim())
        throw new Error(t('editor.nameRequired'))
      if (!sourceItems.length)
        throw new Error(t('editor.itemsRequired'))
      const setName = name.trim()
      const existing = sets.value.find(set => set.setName.trim().toLocaleLowerCase() === setName.toLocaleLowerCase())
      if (existing)
        throw new Error(t('editor.nameExists'))
      const content = prepareSetContent(sourceItems)
      const set = libraryStore.createSetWithContent(setName, folderId, content.entries, content.memberships)
      activeSetId.value = set.id
      exportSelectedIds.value = sets.value.map(item => item.id)
      importOpen.value = false
      setEditorError.value = ''
      useUIStore().showToast(t('editor.created', { name: setName, count: sourceItems.length }))
      return libraryStore.getSet(set.id)
    }
    catch (error) {
      setEditorError.value = editorErrorMessage(error)
      return null
    }
  }

  function saveSetEditor(options: { navigate?: boolean } = {}): boolean {
    const navigate = options.navigate ?? true
    try {
      if (!setEditorName.value.trim())
        throw new Error(t('editor.nameRequired'))
      if (!setEditorDraftItems.value.length)
        throw new Error(t('editor.itemsRequired'))
      if (setEditorMode.value === 'create') {
        const created = createSetFromItems(setEditorDraftItems.value, setEditorName.value, setEditorFolderId.value)
        if (created && navigate)
          void router.push({ name: 'set-overview', params: { setId: created.id } })
        return Boolean(created)
      }
      if (!setEditorId.value || !libraryStore.getSet(setEditorId.value))
        throw new Error(t('editor.notFound'))
      const content = prepareSetContent(setEditorDraftItems.value)
      libraryStore.updateSetWithContent(setEditorId.value, { setName: setEditorName.value.trim(), folderId: setEditorFolderId.value }, content.entries, content.memberships)
      useSessionStore().clearSessionsForSet(setEditorId.value)
      useUIStore().showToast(t('editor.updated', { name: setEditorName.value.trim(), count: setEditorDraftItems.value.length }))
      importOpen.value = false
      if (navigate)
        void router.push({ name: 'set-overview', params: { setId: setEditorId.value } })
      return true
    }
    catch (error) {
      setEditorError.value = editorErrorMessage(error)
      return false
    }
  }

  function addEditorItem() {
    setEditorDraftItems.value = [...setEditorDraftItems.value, { id: `editor-${Date.now()}`, word: '', senses: [createBlankSenseDraft()] }]
  }

  function removeEditorItem(index: number) {
    setEditorDraftItems.value = setEditorDraftItems.value.filter((_, i) => i !== index)
  }

  function openImport(folderId?: string) {
    importError.value = ''
    importPreview.value = ''
    importFolderId.value = folderId ?? UNCATEGORIZED_FOLDER_ID
    importOpen.value = true
  }

  function setImportError(value: string) {
    importError.value = value
  }

  function setImportPreview(value: string) {
    importPreview.value = value
  }

  function setImportFolderId(value: string) {
    importFolderId.value = value
  }

  function closeImport() {
    importOpen.value = false
  }

  async function requestDelete(setId: string): Promise<boolean> {
    pendingDeleteId.value = setId
    const confirmed = await useUIStore().showConfirm(t('confirm.deleteTitle'), sets.value.length <= 1 ? t('confirm.deleteLastMessage') : t('confirm.deleteMessage'))
    if (!confirmed) {
      pendingDeleteId.value = null
      return false
    }
    libraryStore.removeSet(setId)
    useSessionStore().clearSessionsForSet(setId)
    if (activeSetId.value === setId)
      activeSetId.value = sets.value[0]?.id ?? null
    pendingDeleteId.value = null
    return (await syncAfterLocalCommit()).localPersisted
  }

  async function deleteActiveSet(): Promise<boolean> {
    if (activeSet.value)
      return requestDelete(activeSet.value.id)
    return false
  }

  function editActiveSet() {
    if (activeSet.value)
      openSetEditor('edit', activeSet.value)
  }

  function addItemToSet(setId: string, draft: EditorItem) {
    if (!libraryStore.getSet(setId))
      return false
    try {
      const item = { ...draft, id: draft.id || `item-${Date.now()}`, word: draft.word.trim(), senses: draft.senses.map(sense => ({ ...sense, pos: sense.pos.trim(), meaning: sense.meaning.trim(), examples: sense.examples.map(example => example.trim()).filter(Boolean) })) }
      const word = itemToWordEntry(item)
      libraryStore.addWordToSets(word, [{ setId, membership: itemToMembership(item) }])
      useUIStore().showToast(t('dictionary.addedToSet', { word: item.word }))
      return true
    }
    catch {
      return false
    }
  }

  function importSharedSet(sharedSet: SharedSet, folderId = sharedSet.folderId): LibrarySet {
    const setName = createUniqueSetName(sharedSet.setName, sets.value.map(set => set.setName))
    return libraryStore.createSetWithContent(setName, folderId, sharedSet.words, sharedSet.memberships, sharedSet.questions)
  }

  function importLibraryWords(words: WordEntry[], setName: string, folderId?: string) {
    if (!words.length || !setName.trim())
      return null
    const uniqueName = createUniqueSetName(setName, sets.value.map(set => set.setName))
    const set = libraryStore.createSetWithContent(uniqueName, folderId, words, words.map(word => ({ wordKey: normalizeWordKey(word.wordKey), senseIds: word.senses.map(sense => sense.id) })))
    activeSetId.value = set.id
    exportSelectedIds.value = sets.value.map(item => item.id)
    return set
  }

  function toggleExportAll() {
    exportSelectedIds.value = exportAllSelected.value ? [] : sets.value.map(set => set.id)
  }

  async function exportSelectedSetsToZip() {
    exportError.value = ''
    await libraryStore.waitForPersistence()
    const library = await getLibraryRepository().loadState()
    const selectedSets = library.sets
      .filter(set => exportSelectedIds.value.includes(set.id))
      .map(set => toSharedSetFromState(set, library))
    if (!selectedSets.length) {
      exportError.value = t('backup.selectAtLeastOne')
      return
    }
    const blob = await buildExportZipBlob(selectedSets)
    downloadBlob(blob, buildExportFileName())
    useUIStore().showToast(t('backup.exported', { count: selectedSets.length }))
  }

  function applyImported(targetSets: SharedSet[], folderId?: string): ImportResult | null {
    if (!targetSets.length)
      return null
    const imported: SharedSet[] = []
    const renamed: ImportResult['renamed'] = []
    for (const target of targetSets) {
      const beforeNames = new Set(sets.value.map(set => set.setName))
      const importedSet = importSharedSet(target, folderId ?? target.folderId)
      const sourceName = target.setName.trim()
      if (importedSet.setName !== sourceName)
        renamed.push({ from: sourceName, to: importedSet.setName })
      imported.push(toSharedSet(importedSet))
      if (!beforeNames.has(importedSet.setName))
        activeSetId.value = importedSet.id
    }
    const result: ImportResult = { imported, renamed }
    exportSelectedIds.value = sets.value.map(set => set.id)
    const renamedSummary = renamed.length
      ? `；${renamed.map(item => `${item.from} → ${item.to}`).join('、')}`
      : ''
    useUIStore().showToast(`${t('backup.importSuccess', { count: result.imported.length })}${renamedSummary}`)
    return result
  }

  return {
    sets,
    activeSetId,
    hasSets,
    activeSet,
    totalWordCount,
    getSetWordCount,
    setEditorMode,
    setEditorId,
    setEditorName,
    setEditorFolderId,
    setEditorError,
    setEditorDraftItems,
    setSetEditorName,
    setSetEditorFolderId,
    setSetEditorError,
    updateSetEditorItem,
    importOpen,
    importError,
    importPreview,
    importFolderId,
    setImportError,
    setImportPreview,
    setImportFolderId,
    pendingDeleteId,
    exportSelectedIds,
    exportSelectedSets,
    exportSelectedCount,
    exportSelectedWordCount,
    exportAllSelected,
    exportError,
    loadState,
    resetForNamespace,
    ensureActiveSet,
    moveSetToFolder,
    isSetInProgress,
    openSetEditor,
    prepareSetEditor,
    closeSetEditor,
    createSetFromItems,
    saveSetEditor,
    addEditorItem,
    removeEditorItem,
    openImport,
    closeImport,
    requestDelete,
    deleteActiveSet,
    editActiveSet,
    addItemToSet,
    importLibraryWords,
    toggleExportAll,
    exportSelectedSetsToZip,
    applyImported,
  }
})

import type { EditorItem, ImportMode, ImportResult, VersionDiff, VocabSet } from '@/types'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { LEGACY_STORAGE_KEY, SETS_STORAGE_KEY } from '@/constants'
import { buildExportFileName, buildExportZipBlob, downloadBlob } from '@/lib/file'
import { i18n } from '@/lib/i18n'
import { applyImportedSets, parseImportJson, refreshImportVersionDiffs, summarizeDuplicateResult } from '@/lib/import'
import { loadFromStorage, saveToStorage } from '@/lib/persist'
import { deduplicateSetsByName } from '@/lib/set-utils'
import { createBlankEditorItem, createEditorItems, normalizeItem, normalizeSet } from '@/lib/validation'
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
  }

  async function loadState() {
    const loaded = await loadFromStorage(SETS_STORAGE_KEY, [LEGACY_STORAGE_KEY])
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

        if (loaded.sourceKey !== SETS_STORAGE_KEY)
          saveState()
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

  function isSetInProgress(setId: string): boolean {
    const sessionStore = useSessionStore()
    return sessionStore.isSetInProgress(setId)
  }

  function openSetEditor(mode: 'create' | 'edit', set?: VocabSet | null) {
    setEditorMode.value = mode
    setEditorId.value = set?.id ?? null
    setEditorName.value = set?.setName ?? ''
    setEditorDraftItems.value = mode === 'edit' && set ? createEditorItems(set.items) : []
    pendingSetItems.value = mode === 'create' ? [...pendingSetItems.value] : []
    setEditorError.value = ''
    setEditorOpen.value = true
  }

  function closeSetEditor() {
    setEditorOpen.value = false
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
        const nextSet: VocabSet = {
          id: `${Date.now()}`,
          setName: setEditorName.value.trim(),
          difficulty: importDifficulty.value,
          items,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        const existing = sets.value.find(set => set.setName.trim().toLocaleLowerCase() === nextSet.setName.toLocaleLowerCase())
        const savedSet = existing ? { ...nextSet, id: existing.id, createdAt: existing.createdAt } : nextSet
        sets.value = deduplicateSetsByName([...sets.value.filter(set => set.id !== existing?.id), savedSet])
        exportSelectedIds.value = sets.value.map(set => set.id)
        activeSetId.value = savedSet.id
        uiStore.showToast(t(existing ? 'editor.replaced' : 'editor.created', { name: savedSet.setName, count: savedSet.items.length }))
      }
      else {
        const targetIndex = sets.value.findIndex(s => s.id === setEditorId.value)
        if (targetIndex === -1)
          throw new Error(t('editor.notFound'))

        const nextSet: VocabSet = {
          ...sets.value[targetIndex],
          setName: setEditorName.value.trim(),
          items,
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

  function openImport() {
    importStep.value = 1
    importWords.value = ''
    importJson.value = ''
    importError.value = ''
    importPreview.value = ''
    importDifficulty.value = 2
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

    setEditorMode.value = 'create'
    setEditorId.value = null
    setEditorName.value = ''
    pendingSetItems.value = createEditorItems(result.data.items)
    setEditorError.value = ''
    setEditorOpen.value = true
    importOpen.value = false
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
      sessionStore.resetStudyView()
    }
    else {
      sets.value = sets.value.filter(s => s.id !== pendingDeleteId.value)
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
      question: draft.question ?? {
        prompt: `Choose the word that best completes the sentence: I am learning _____.`,
        opts: [word, 'another word', 'not sure', 'skip this one'],
        ans: 0,
      },
    }, target.items.length)

    const nextSet = {
      ...target,
      items: [...target.items, item],
      updatedAt: new Date().toISOString(),
    }
    sets.value = sets.value.map(set => set.id === setId ? nextSet : set)
    saveState()
    useUIStore().showToast(t('dictionary.addedToSet', { word }))
    return true
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

  function applyImported(targetSets: VocabSet[], mode: ImportMode): ImportResult | null {
    const uiStore = useUIStore()
    const sessionStore = useSessionStore()

    const result = applyImportedSets(sets.value, targetSets, mode, importVersionChoices.value)

    if (mode === 'overwrite') {
      sets.value = result.imported.map(set => ({ ...set, updatedAt: new Date().toISOString() }))
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
        return replacement ? { ...replacement, id: s.id, updatedAt: new Date().toISOString() } : s
      }
      return s
    })

    const newSets = result.imported
      .filter(imp => !result.replacedVersions.includes(imp.setName))
      .map(set => ({ ...set, updatedAt: new Date().toISOString() }))
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
    isSetInProgress,
    openSetEditor,
    closeSetEditor,
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
    toggleExportAll,
    exportSelectedSetsToZip,
    refreshDiffs,
    resetImportVersionDiffs,
    setImportVersionChoice,
    applyImported,
  }
})

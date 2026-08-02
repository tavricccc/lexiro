import type { SenseEditValue, WordSense } from '@/types'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLibraryStore } from '@/stores/library'
import { useUIStore } from '@/stores/ui'
import { calculateSenseRemovalImpact } from './sense-impact'

interface SenseManagementOptions {
  getWordKey: () => string
  getSetId: () => string
  onRemoved?: () => void | Promise<void>
}

export function useSenseManagement(options: SenseManagementOptions) {
  const libraryStore = useLibraryStore()
  const uiStore = useUIStore()
  const { t } = useI18n()
  const editingSenseId = ref<string | null>(null)
  const pendingRemovalId = ref<string | null>(null)
  const editorError = ref('')

  const editingSense = computed(() => {
    const word = libraryStore.getWord(options.getWordKey())
    return word?.senses.find(sense => sense.id === editingSenseId.value) ?? null
  })
  const pendingRemoval = computed(() => {
    const word = libraryStore.getWord(options.getWordKey())
    return word?.senses.find(sense => sense.id === pendingRemovalId.value) ?? null
  })
  const impact = computed(() => pendingRemoval.value
    ? calculateSenseRemovalImpact({
        setId: options.getSetId(),
        wordKey: options.getWordKey(),
        senseId: pendingRemoval.value.id,
        memberships: libraryStore.state.memberships,
        questions: libraryStore.questions,
      })
    : null)
  const otherSetNames = computed(() => (impact.value?.otherSetIds ?? [])
    .map(setId => libraryStore.getSet(setId)?.setName)
    .filter((name): name is string => Boolean(name)))

  function openEditor(sense: WordSense) {
    editingSenseId.value = sense.id
    editorError.value = ''
  }

  function closeEditor() {
    editingSenseId.value = null
    editorError.value = ''
  }

  async function saveEditor(value: SenseEditValue): Promise<boolean> {
    const sense = editingSense.value
    if (!sense)
      return false
    const usages = libraryStore.getSenseSetIds(options.getWordKey(), sense.id)
    if (usages.length > 1) {
      const confirmed = await uiStore.showConfirm(
        t('vocabulary.sharedChangeTitle'),
        t('vocabulary.sharedChangeMessage', { count: usages.length, sets: usages.map(id => libraryStore.getSet(id)?.setName).filter(Boolean).join('、') }),
      )
      if (!confirmed)
        return false
    }
    try {
      if (!libraryStore.updateSense(options.getWordKey(), sense.id, value))
        throw new Error(t('vocabulary.saveFailed'))
      closeEditor()
      return true
    }
    catch (error) {
      editorError.value = error instanceof Error ? error.message : t('vocabulary.saveFailed')
      return false
    }
  }

  async function removeSense(sense: WordSense, withUndo: boolean) {
    const wordKey = options.getWordKey()
    const setId = options.getSetId()
    if (!setId)
      return
    if (withUndo) {
      const snapshot = libraryStore.removeSenseFromSetWithUndo(setId, wordKey, sense.id)
      if (!snapshot)
        return
      uiStore.showToast(t('vocabulary.senseRemoved', { meaning: sense.meaningZh }), {
        actionLabel: t('toast.undo'),
        duration: 5000,
        action: () => {
          if (libraryStore.restoreSenseRemoval(snapshot))
            uiStore.showToast(t('vocabulary.senseRestored'))
        },
      })
    }
    else if (!libraryStore.removeSenseFromSet(setId, wordKey, sense.id)) {
      return
    }
    else {
      uiStore.showToast(t('vocabulary.senseRemoved', { meaning: sense.meaningZh }))
    }
    await options.onRemoved?.()
  }

  async function requestRemove(sense: WordSense) {
    pendingRemovalId.value = sense.id
    const currentImpact = impact.value
    pendingRemovalId.value = null
    if (currentImpact?.requiresConfirmation) {
      pendingRemovalId.value = sense.id
      return
    }
    await removeSense(sense, true)
  }

  function cancelRemove() {
    pendingRemovalId.value = null
  }

  async function confirmRemove() {
    const sense = pendingRemoval.value
    pendingRemovalId.value = null
    if (sense)
      await removeSense(sense, false)
  }

  return {
    editingSense,
    editorError,
    editorOpen: computed(() => Boolean(editingSenseId.value)),
    impact,
    otherSetNames,
    deleteImpactOpen: computed(() => Boolean(pendingRemovalId.value && impact.value)),
    openEditor,
    closeEditor,
    saveEditor,
    requestRemove,
    cancelRemove,
    confirmRemove,
  }
}

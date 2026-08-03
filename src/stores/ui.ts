import type { DirtyFormController } from '@/lib/dirty-form'
import { defineStore } from 'pinia'
import { computed, reactive, ref, shallowRef } from 'vue'
import { UI_STORAGE_KEY } from '@/constants'
import { UNCATEGORIZED_FOLDER_ID } from '@/lib/folders'
import { loadFromStorage, saveToStorage } from '@/lib/persist'

export type GuestDataDecision = 'export' | 'continue' | 'cancel'
export type DirtyFormDecision = 'save' | 'discard' | 'cancel'

export const useUIStore = defineStore('ui', () => {
  const theme = ref<'light' | 'dark'>('light')
  const toastMessage = ref('')
  const toastVisible = ref(false)
  const toastActionLabel = ref('')
  const toastAction = shallowRef<(() => void) | null>(null)
  const confirmOpen = ref(false)
  const confirmTitle = ref('')
  const confirmMessage = ref('')
  const confirmConfirmLabel = ref('')
  const confirmCancelLabel = ref('')
  const confirmDestructive = ref(true)
  const dirtyFormPromptOpen = ref(false)
  const guestDataWarningOpen = ref(false)
  const transferOpen = ref(false)
  const transferFolderId = ref(UNCATEGORIZED_FOLDER_ID)
  const versionUpdateAvailable = ref(false)
  const versionUpdatePending = ref(false)
  const versionUpdateReady = ref(false)
  const versionUpdateLoading = ref(false)
  const versionUpdateError = ref('')
  const sidebarExpanded = ref(true)
  const pageLoading = ref(false)
  const appStarting = ref(true)
  const questionCountPreference = ref(5)
  const dirtyForms = reactive(new Map<string, DirtyFormController>())
  const dirtyFormCount = computed(() => Array.from(dirtyForms.values()).filter(form => form.isDirty()).length)
  const hasDirtyForms = computed(() => dirtyFormCount.value > 0)
  let themeMediaQuery: MediaQueryList | null = null
  let themeListener: ((event: MediaQueryListEvent) => void) | null = null

  let confirmResolver: ((value: boolean) => void) | null = null
  let guestDataResolver: ((value: GuestDataDecision) => void) | null = null
  let dirtyFormResolver: ((value: DirtyFormDecision) => void) | null = null
  let toastTimer: ReturnType<typeof setTimeout> | null = null
  let pageLoadingToken = 0

  function finishAppStartup() {
    appStarting.value = false
  }

  function showToast(message: string, options?: { actionLabel?: string, action?: () => void, duration?: number }) {
    toastMessage.value = message
    toastVisible.value = true
    toastActionLabel.value = options?.actionLabel ?? ''
    toastAction.value = options?.action ?? null
    if (toastTimer)
      clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
      toastVisible.value = false
      toastActionLabel.value = ''
      toastAction.value = null
    }, options?.duration ?? 2200)
  }

  function triggerToastAction() {
    const action = toastAction.value
    toastVisible.value = false
    toastActionLabel.value = ''
    toastAction.value = null
    if (toastTimer)
      clearTimeout(toastTimer)
    if (action)
      action()
  }

  function registerDirtyForm(controller: DirtyFormController): () => void {
    dirtyForms.set(controller.id, controller)
    return () => {
      dirtyForms.delete(controller.id)
    }
  }

  async function saveDirtyForms(): Promise<boolean> {
    for (const form of dirtyForms.values()) {
      if (!form.isDirty())
        continue
      if (!await form.save() || form.isDirty())
        return false
    }
    return true
  }

  function discardDirtyForms() {
    for (const form of dirtyForms.values()) {
      if (form.isDirty())
        form.discard()
    }
  }

  function showDirtyFormPrompt(formId?: string): Promise<DirtyFormDecision> {
    if (formId && !dirtyForms.get(formId)?.isDirty())
      return Promise.resolve('discard')
    if (!hasDirtyForms.value)
      return Promise.resolve('discard')
    dirtyFormPromptOpen.value = true
    return new Promise((resolve) => {
      dirtyFormResolver = resolve
    })
  }

  function resolveDirtyFormPrompt(decision: DirtyFormDecision) {
    dirtyFormPromptOpen.value = false
    if (dirtyFormResolver) {
      dirtyFormResolver(decision)
      dirtyFormResolver = null
    }
  }

  function showConfirm(
    title: string,
    message: string,
    options?: {
      confirmLabel?: string
      cancelLabel?: string
      destructive?: boolean
    },
  ): Promise<boolean> {
    confirmTitle.value = title
    confirmMessage.value = message
    confirmConfirmLabel.value = options?.confirmLabel ?? ''
    confirmCancelLabel.value = options?.cancelLabel ?? ''
    confirmDestructive.value = options?.destructive ?? true
    confirmOpen.value = true
    return new Promise((resolve) => {
      confirmResolver = resolve
    })
  }

  function resolveConfirm(result: boolean) {
    confirmOpen.value = false
    if (confirmResolver) {
      confirmResolver(result)
      confirmResolver = null
    }
  }

  function showGuestDataWarning(): Promise<GuestDataDecision> {
    guestDataWarningOpen.value = true
    return new Promise((resolve) => {
      guestDataResolver = resolve
    })
  }

  function resolveGuestDataWarning(decision: GuestDataDecision) {
    guestDataWarningOpen.value = false
    if (guestDataResolver) {
      guestDataResolver(decision)
      guestDataResolver = null
    }
  }

  function toggleSidebar() {
    sidebarExpanded.value = !sidebarExpanded.value
    void saveToStorage(UI_STORAGE_KEY, { sidebarExpanded: sidebarExpanded.value })
  }

  function beginPageLoading(): number {
    pageLoadingToken += 1
    pageLoading.value = true
    return pageLoadingToken
  }

  function endPageLoading(token?: number) {
    if (token !== undefined && token !== pageLoadingToken)
      return
    pageLoading.value = false
  }

  async function loadState() {
    const stored = await loadFromStorage(UI_STORAGE_KEY)
    if (!stored.value)
      return
    try {
      const parsed = JSON.parse(stored.value) as Record<string, unknown>
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed) || !Object.keys(parsed).every(key => ['sidebarExpanded', 'questionCountPreference'].includes(key)))
        throw new Error('Invalid UI preference state')
      if (typeof parsed.sidebarExpanded === 'boolean')
        sidebarExpanded.value = parsed.sidebarExpanded
      if (typeof parsed.questionCountPreference === 'number' && Number.isInteger(parsed.questionCountPreference) && parsed.questionCountPreference > 0)
        questionCountPreference.value = parsed.questionCountPreference
    }
    catch {
      sidebarExpanded.value = true
    }
  }

  function initTheme() {
    themeListener && themeMediaQuery?.removeEventListener('change', themeListener)
    themeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const applySystemTheme = (isDark: boolean) => {
      theme.value = isDark ? 'dark' : 'light'
      document.documentElement.classList.toggle('dark', isDark)
      document.documentElement.dataset.theme = isDark ? 'dark' : 'light'
    }
    applySystemTheme(themeMediaQuery.matches)
    themeListener = event => applySystemTheme(event.matches)
    themeMediaQuery.addEventListener('change', themeListener)
  }

  function openTransfer(folderId?: string) {
    transferFolderId.value = folderId ?? UNCATEGORIZED_FOLDER_ID
    transferOpen.value = true
  }

  function setQuestionCountPreference(value: number) {
    if (!Number.isInteger(value) || value < 1)
      return
    questionCountPreference.value = value
    void saveToStorage(UI_STORAGE_KEY, { sidebarExpanded: sidebarExpanded.value, questionCountPreference: value })
  }

  function closeTransfer() {
    transferOpen.value = false
  }

  function setVersionUpdateAvailable(value: boolean) {
    versionUpdateAvailable.value = value
    if (value)
      versionUpdateError.value = ''
  }

  function setVersionUpdatePending(value: boolean) {
    versionUpdatePending.value = value
  }

  function setVersionUpdateReady(value: boolean) {
    versionUpdateReady.value = value
  }

  function setVersionUpdateLoading(value: boolean) {
    versionUpdateLoading.value = value
  }

  function setVersionUpdateError(value: string) {
    versionUpdateError.value = value
  }

  return {
    theme,
    toastMessage,
    toastVisible,
    toastActionLabel,
    confirmOpen,
    confirmTitle,
    confirmMessage,
    confirmConfirmLabel,
    confirmCancelLabel,
    confirmDestructive,
    dirtyFormPromptOpen,
    guestDataWarningOpen,
    transferOpen,
    transferFolderId,
    versionUpdateAvailable,
    versionUpdatePending,
    versionUpdateReady,
    versionUpdateLoading,
    versionUpdateError,
    sidebarExpanded,
    pageLoading,
    appStarting,
    questionCountPreference,
    dirtyFormCount,
    hasDirtyForms,
    loadState,
    showToast,
    triggerToastAction,
    registerDirtyForm,
    saveDirtyForms,
    discardDirtyForms,
    showDirtyFormPrompt,
    resolveDirtyFormPrompt,
    showConfirm,
    resolveConfirm,
    showGuestDataWarning,
    resolveGuestDataWarning,
    toggleSidebar,
    beginPageLoading,
    endPageLoading,
    finishAppStartup,
    setQuestionCountPreference,
    initTheme,
    openTransfer,
    closeTransfer,
    setVersionUpdateAvailable,
    setVersionUpdatePending,
    setVersionUpdateReady,
    setVersionUpdateLoading,
    setVersionUpdateError,
  }
})

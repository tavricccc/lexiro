import { defineStore } from 'pinia'
import { ref } from 'vue'
import { UI_STORAGE_KEY } from '@/constants'
import { UNCATEGORIZED_FOLDER_ID } from '@/lib/folders'
import { loadFromStorage, saveToStorage } from '@/lib/persist'

export type GuestDataDecision = 'export' | 'continue' | 'cancel'

export const useUIStore = defineStore('ui', () => {
  const theme = ref<'light' | 'dark'>('light')
  const toastMessage = ref('')
  const toastVisible = ref(false)
  const confirmOpen = ref(false)
  const confirmTitle = ref('')
  const confirmMessage = ref('')
  const confirmConfirmLabel = ref('')
  const confirmCancelLabel = ref('')
  const confirmDestructive = ref(true)
  const guestDataWarningOpen = ref(false)
  const transferOpen = ref(false)
  const transferFolderId = ref(UNCATEGORIZED_FOLDER_ID)
  const versionUpdateAvailable = ref(false)
  const versionUpdatePending = ref(false)
  const versionUpdateReady = ref(false)
  const versionUpdateLoading = ref(false)
  const sidebarExpanded = ref(true)
  const questionCountPreference = ref(5)
  let themeMediaQuery: MediaQueryList | null = null
  let themeListener: ((event: MediaQueryListEvent) => void) | null = null

  let confirmResolver: ((value: boolean) => void) | null = null
  let guestDataResolver: ((value: GuestDataDecision) => void) | null = null
  let toastTimer: ReturnType<typeof setTimeout> | null = null

  function showToast(message: string) {
    toastMessage.value = message
    toastVisible.value = true
    if (toastTimer)
      clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
      toastVisible.value = false
    }, 2200)
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

  return {
    theme,
    toastMessage,
    toastVisible,
    confirmOpen,
    confirmTitle,
    confirmMessage,
    confirmConfirmLabel,
    confirmCancelLabel,
    confirmDestructive,
    guestDataWarningOpen,
    transferOpen,
    transferFolderId,
    versionUpdateAvailable,
    versionUpdatePending,
    versionUpdateReady,
    versionUpdateLoading,
    sidebarExpanded,
    questionCountPreference,
    loadState,
    showToast,
    showConfirm,
    resolveConfirm,
    showGuestDataWarning,
    resolveGuestDataWarning,
    toggleSidebar,
    setQuestionCountPreference,
    initTheme,
    openTransfer,
    closeTransfer,
    setVersionUpdateAvailable,
    setVersionUpdatePending,
    setVersionUpdateReady,
    setVersionUpdateLoading,
  }
})

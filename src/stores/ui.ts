import { defineStore } from 'pinia'
import { ref } from 'vue'

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
  const transferOpen = ref(false)
  const versionUpdateAvailable = ref(false)
  const versionUpdatePending = ref(false)
  const versionUpdateReady = ref(false)
  const versionUpdateLoading = ref(false)
  const sidebarExpanded = ref(localStorage.getItem('lexiro_sidebar_expanded') !== 'false')
  let themeMediaQuery: MediaQueryList | null = null
  let themeListener: ((event: MediaQueryListEvent) => void) | null = null

  let confirmResolver: ((value: boolean) => void) | null = null
  let toastTimer: number | null = null

  function showToast(message: string) {
    toastMessage.value = message
    toastVisible.value = true
    window.clearTimeout(toastTimer!)
    toastTimer = window.setTimeout(() => {
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

  function toggleSidebar() {
    sidebarExpanded.value = !sidebarExpanded.value
    localStorage.setItem('lexiro_sidebar_expanded', String(sidebarExpanded.value))
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

  function openTransfer() {
    transferOpen.value = true
  }

  function closeTransfer() {
    transferOpen.value = false
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
    transferOpen,
    versionUpdateAvailable,
    versionUpdatePending,
    versionUpdateReady,
    versionUpdateLoading,
    sidebarExpanded,
    showToast,
    showConfirm,
    resolveConfirm,
    toggleSidebar,
    initTheme,
    openTransfer,
    closeTransfer,
  }
})

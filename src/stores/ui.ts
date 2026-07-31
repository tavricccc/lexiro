import { defineStore } from 'pinia'
import { ref } from 'vue'
import { THEME_KEY } from '@/constants'

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

  function toggleTheme() {
    if (theme.value === 'light') {
      theme.value = 'dark'
      document.documentElement.classList.add('dark')
      document.documentElement.dataset.theme = 'dark'
      localStorage.setItem(THEME_KEY, 'dark')
    }
    else {
      theme.value = 'light'
      document.documentElement.classList.remove('dark')
      document.documentElement.dataset.theme = 'light'
      localStorage.setItem(THEME_KEY, 'light')
    }
  }

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      theme.value = 'dark'
      document.documentElement.classList.add('dark')
      document.documentElement.dataset.theme = 'dark'
    }
    else {
      theme.value = 'light'
      document.documentElement.classList.remove('dark')
      document.documentElement.dataset.theme = 'light'
    }
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
    showToast,
    showConfirm,
    resolveConfirm,
    toggleTheme,
    initTheme,
    openTransfer,
    closeTransfer,
  }
})

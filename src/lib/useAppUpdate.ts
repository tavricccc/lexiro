import { readonly, ref } from 'vue'

const updateAvailable = ref(false)
const checking = ref(false)
const reloading = ref<false | 'update' | 'restart'>(false)
const remoteVersion = ref('')
const initialCheckDone = ref(false)
let lastCheckedAt = 0
let listenersRegistered = false

const APP_RELOAD_TIMEOUT_MS = 5_000
const SERVICE_WORKER_PREPARE_TIMEOUT_MS = 4_000
const RELOAD_NAVIGATION_RETRY_MS = 4_000
const RELOAD_RECOVERY_TIMEOUT_MS = 10_000
const MAX_AUTO_RELOAD_ATTEMPTS = 1

export const LAST_APP_VERSION_STORAGE_KEY = 'lexiro:last-app-version'
export const PENDING_UPDATE_VERSION_STORAGE_KEY = 'lexiro:pending-update-version'
const AUTO_RELOAD_STORAGE_KEY = 'lexiro:auto-update-reloaded-version'
const AUTO_RELOAD_COUNT_KEY = 'lexiro:auto-update-reloaded-count'

interface VersionResponse {
  version?: string
}

function readStorage(type: 'session' | 'local', key: string): string | null {
  try {
    const storage = type === 'session' ? window.sessionStorage : window.localStorage
    return storage.getItem(key)
  }
  catch {
    return null
  }
}

function writeStorage(type: 'session' | 'local', key: string, value: string) {
  try {
    const storage = type === 'session' ? window.sessionStorage : window.localStorage
    storage.setItem(key, value)
  }
  catch {
    // Ignore storage errors
  }
}

export async function checkAppVersion(force = false) {
  if (checking.value || (!force && Date.now() - lastCheckedAt < 60_000)) {
    return
  }

  checking.value = true
  lastCheckedAt = Date.now()

  try {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), APP_RELOAD_TIMEOUT_MS)
    const response = await fetch(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
    window.clearTimeout(timeoutId)

    if (!response.ok)
      return

    const data = await response.json() as VersionResponse
    const nextRemoteVersion = typeof data.version === 'string' ? data.version : ''
    remoteVersion.value = nextRemoteVersion
    updateAvailable.value = Boolean(
      nextRemoteVersion && nextRemoteVersion !== __APP_VERSION__,
    )
  }
  catch {
    // Version check request failed
  }
  finally {
    checking.value = false
  }
}

function shouldCheckAfterResume() {
  return Date.now() - lastCheckedAt >= 5 * 60_000
}

async function updateServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    return null
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration()
    if (registration) {
      await registration.update()
      return registration
    }
    return null
  }
  catch {
    return null
  }
}

async function waitForServiceWorkerTakeover(registration: ServiceWorkerRegistration, signal: AbortSignal) {
  const candidate = registration.waiting ?? registration.installing
  if (!candidate)
    return

  await new Promise<void>((resolve) => {
    let settled = false
    const finish = () => {
      if (settled)
        return
      settled = true
      candidate.removeEventListener('statechange', handleStateChange)
      navigator.serviceWorker.removeEventListener('controllerchange', finish)
      signal.removeEventListener('abort', finish)
      resolve()
    }
    const handleStateChange = () => {
      if (candidate.state === 'activated' || candidate.state === 'redundant')
        finish()
    }

    candidate.addEventListener('statechange', handleStateChange)
    navigator.serviceWorker.addEventListener('controllerchange', finish, { once: true })
    signal.addEventListener('abort', finish, { once: true })
    registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
    handleStateChange()
  })
}

async function prepareServiceWorkerForReload() {
  try {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), SERVICE_WORKER_PREPARE_TIMEOUT_MS)
    const registration = await updateServiceWorker()
    if (registration && !controller.signal.aborted) {
      await waitForServiceWorkerTakeover(registration, controller.signal)
    }
    window.clearTimeout(timeoutId)
  }
  catch {
    // Navigation still proceeds bounded by reload watchdog
  }
}

export async function initializeAppUpdate() {
  if (!listenersRegistered && typeof window !== 'undefined') {
    listenersRegistered = true
    window.addEventListener('online', () => void checkAppVersion())
    window.addEventListener('pageshow', () => {
      if (shouldCheckAfterResume())
        void checkAppVersion()
    })
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && shouldCheckAfterResume()) {
        void checkAppVersion()
      }
    })
  }

  void updateServiceWorker()
  try {
    await checkAppVersion()
  }
  finally {
    initialCheckDone.value = true
  }
}

export function useAppUpdate() {
  function getAutoReloadCount() {
    const savedCount = Number.parseInt(readStorage('session', AUTO_RELOAD_COUNT_KEY) || '0', 10)
    return Number.isFinite(savedCount) && savedCount > 0 ? savedCount : 0
  }

  function canAutoReloadCurrentVersion() {
    if (!remoteVersion.value)
      return false
    const savedVersion = readStorage('session', AUTO_RELOAD_STORAGE_KEY)
    if (savedVersion !== remoteVersion.value) {
      return true
    }
    return getAutoReloadCount() < MAX_AUTO_RELOAD_ATTEMPTS
  }

  function markAutomaticReloadExhausted() {
    if (!remoteVersion.value)
      return
    writeStorage('session', AUTO_RELOAD_STORAGE_KEY, remoteVersion.value)
    writeStorage('session', AUTO_RELOAD_COUNT_KEY, String(MAX_AUTO_RELOAD_ATTEMPTS))
  }

  function startReloadRecoveryWatchdog() {
    window.setTimeout(() => {
      try {
        window.location.reload()
      }
      catch {
        // Recovery prompt restored if navigation fails
      }
    }, RELOAD_NAVIGATION_RETRY_MS)

    window.setTimeout(() => {
      if (updateAvailable.value) {
        markAutomaticReloadExhausted()
      }
      reloading.value = false
    }, RELOAD_RECOVERY_TIMEOUT_MS)
  }

  async function reloadApp(options: { automatic?: boolean, reason?: 'update' | 'restart' } = {}) {
    if (reloading.value) {
      return
    }

    if (options.automatic && !canAutoReloadCurrentVersion()) {
      return
    }

    reloading.value = options.reason || 'update'

    if (options.automatic && remoteVersion.value) {
      const savedVersion = readStorage('session', AUTO_RELOAD_STORAGE_KEY)
      if (savedVersion === remoteVersion.value) {
        writeStorage('session', AUTO_RELOAD_COUNT_KEY, String(getAutoReloadCount() + 1))
      }
      else {
        writeStorage('session', AUTO_RELOAD_STORAGE_KEY, remoteVersion.value)
        writeStorage('session', AUTO_RELOAD_COUNT_KEY, '1')
      }
    }

    if (remoteVersion.value) {
      writeStorage('local', PENDING_UPDATE_VERSION_STORAGE_KEY, remoteVersion.value)
    }

    if ((options.reason ?? 'update') === 'update') {
      await prepareServiceWorkerForReload()
    }

    startReloadRecoveryWatchdog()

    try {
      window.location.replace(window.location.href)
    }
    catch {
      window.location.reload()
    }
  }

  return {
    canAutoReloadCurrentVersion,
    checking: readonly(checking),
    initialCheckDone: readonly(initialCheckDone),
    reloadApp,
    reloading: readonly(reloading),
    remoteVersion: readonly(remoteVersion),
    updateAvailable: readonly(updateAvailable),
  }
}

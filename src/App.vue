<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import AppSidebar from '@/components/AppSidebar.vue'
import ConfirmDialog from '@/components/dialogs/ConfirmDialog.vue'
import DirtyFormDialog from '@/components/dialogs/DirtyFormDialog.vue'
import GuestDataDialog from '@/components/dialogs/GuestDataDialog.vue'
import ImportDialog from '@/components/dialogs/ImportDialog.vue'
import TransferDialog from '@/components/dialogs/TransferDialog.vue'
import VersionUpdateDialog from '@/components/dialogs/VersionUpdateDialog.vue'
import MobileBottomTabs from '@/components/MobileBottomTabs.vue'
import SyncProgress from '@/components/ui/sync-progress/SyncProgress.vue'
import Toast from '@/components/ui/toast/Toast.vue'
import { useCloudSyncStore } from '@/stores/cloudSync'
import { useSessionStore } from '@/stores/session'
import { useUIStore } from '@/stores/ui'

const uiStore = useUIStore()
const sessionStore = useSessionStore()
const cloudStore = useCloudSyncStore()
const router = useRouter()
const route = useRoute()
const { sidebarExpanded, hasDirtyForms } = storeToRefs(uiStore)
const { appReady, configured, progress, pendingWrites } = storeToRefs(cloudStore)
const { setVersionUpdateAvailable, setVersionUpdatePending, setVersionUpdateReady } = uiStore

const isSessionRoute = computed(() => ['quiz', 'fillBlank', 'reading', 'review', 'result'].includes(String(route.name)))
const showSyncGate = computed(() => configured.value && !appReady.value)
const showInlineSync = computed(() => !showSyncGate.value && ['preparing', 'downloading', 'reconciling', 'uploading', 'verifying', 'offline', 'error'].includes(progress.value.phase))

let versionCheckInterval: ReturnType<typeof setInterval> | null = null
let controllerChangeListener: (() => void) | null = null
let lastVersionCheckAt = 0
const VERSION_CHECK_INTERVAL = 10 * 60 * 1000

async function checkVersion(force = false) {
  if (import.meta.env.DEV)
    return
  if (!force && Date.now() - lastVersionCheckAt < VERSION_CHECK_INTERVAL)
    return
  if (uiStore.versionUpdateAvailable || uiStore.versionUpdatePending)
    return
  lastVersionCheckAt = Date.now()
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`)
    if (!res.ok)
      return
    const data = await res.json()
    if (data && data.version && data.version !== __APP_VERSION__) {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then((reg) => {
          reg?.update().catch(err => console.error('Failed to trigger SW update:', err))
        })
      }

      if (router.currentRoute.value.path === '/') {
        setVersionUpdateAvailable(true)
      }
      else {
        setVersionUpdatePending(true)
      }
    }
  }
  catch (e) {
    console.error('Failed to check app version:', e)
  }
}

function handleVisibilityChange() {
  document.documentElement.classList.toggle('motion-paused', document.hidden)
  if (document.hidden) {
    sessionStore.saveState(true)
  }
  else {
    checkVersion()
  }
}

function handleBeforeUnload(event: BeforeUnloadEvent) {
  sessionStore.saveState(true)
  if (hasDirtyForms.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}

onMounted(() => {
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('beforeunload', handleBeforeUnload)

  if (!import.meta.env.DEV) {
    setTimeout(checkVersion, 2000)
    versionCheckInterval = setInterval(checkVersion, VERSION_CHECK_INTERVAL, true)
  }

  router.afterEach((to) => {
    if (to.path === '/' && uiStore.versionUpdatePending) {
      setVersionUpdateAvailable(true)
    }
    else {
      checkVersion()
    }
  })

  if ('serviceWorker' in navigator) {
    controllerChangeListener = () => {
      setVersionUpdateReady(true)
      if (uiStore.versionUpdateLoading) {
        window.location.reload()
      }
    }
    navigator.serviceWorker.addEventListener('controllerchange', controllerChangeListener)
  }
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('beforeunload', handleBeforeUnload)
  if (versionCheckInterval) {
    clearInterval(versionCheckInterval)
  }
  if ('serviceWorker' in navigator && controllerChangeListener) {
    navigator.serviceWorker.removeEventListener('controllerchange', controllerChangeListener)
  }
})
</script>

<template>
  <SyncProgress v-if="showSyncGate" fullscreen :state="progress" allow-offline @retry="cloudStore.retryConnection" @continue-offline="cloudStore.continueOffline" />
  <div v-else class="app-root min-h-screen text-ink-950 dark:text-ink-50 transition-colors duration-250 relative overflow-x-hidden" :class="[isSessionRoute ? 'app-root--session' : 'app-root--workspace', sidebarExpanded ? 'app-root--sidebar-expanded' : '']">
    <AppSidebar v-if="!isSessionRoute" />
    <MobileBottomTabs v-if="!isSessionRoute" />
    <AppHeader v-if="isSessionRoute" />

    <main class="app-main-content viewport-frame">
      <div class="route-page-frame">
        <router-view v-slot="{ Component }">
          <Transition name="page" mode="out-in">
            <component :is="Component" />
          </Transition>
        </router-view>
      </div>
    </main>

    <ImportDialog />
    <TransferDialog />
    <ConfirmDialog />
    <DirtyFormDialog />
    <GuestDataDialog />
    <VersionUpdateDialog />

    <Toast :message="uiStore.toastMessage" :visible="uiStore.toastVisible" :action-label="uiStore.toastActionLabel" @action="uiStore.triggerToastAction" />
    <Transition name="toast-slide">
      <div v-if="showInlineSync" class="fixed bottom-4 left-4 z-[80] w-[min(26rem,calc(100vw-2rem))]">
        <SyncProgress :state="progress" allow-offline @retry="cloudStore.retryConnection" @continue-offline="cloudStore.continueOffline" />
      </div>
    </Transition>
    <div v-if="pendingWrites > 0" class="fixed right-4 top-4 z-[80] rounded-full border border-amber-300/70 bg-amber-50/95 px-3 py-2 text-xs font-black text-amber-800 shadow-soft backdrop-blur dark:border-amber-700/60 dark:bg-amber-950/90 dark:text-amber-100" role="status">
      {{ $t('sync.pending', { count: pendingWrites }) }}
    </div>
  </div>
</template>

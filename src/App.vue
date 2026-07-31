<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import AppSidebar from '@/components/AppSidebar.vue'
import ConfirmDialog from '@/components/dialogs/ConfirmDialog.vue'
import ImportDialog from '@/components/dialogs/ImportDialog.vue'
import PracticeDialog from '@/components/dialogs/PracticeDialog.vue'
import SetEditorDialog from '@/components/dialogs/SetEditorDialog.vue'
import TransferDialog from '@/components/dialogs/TransferDialog.vue'
import VersionUpdateDialog from '@/components/dialogs/VersionUpdateDialog.vue'
import MobileBottomTabs from '@/components/MobileBottomTabs.vue'
import Toast from '@/components/ui/toast/Toast.vue'
import { useSessionStore } from '@/stores/session'
import { useUIStore } from '@/stores/ui'

const uiStore = useUIStore()
const sessionStore = useSessionStore()
const router = useRouter()
const route = useRoute()
const { sidebarExpanded } = storeToRefs(uiStore)

const isSessionRoute = computed(() => ['quiz', 'spelling', 'flashcard', 'review', 'result'].includes(String(route.name)))

let versionCheckInterval: ReturnType<typeof setInterval> | null = null
let controllerChangeListener: (() => void) | null = null

async function checkVersion() {
  if (import.meta.env.DEV)
    return
  if (uiStore.versionUpdateAvailable || uiStore.versionUpdatePending)
    return
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
        uiStore.versionUpdateAvailable = true
      }
      else {
        uiStore.versionUpdatePending = true
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

function handleBeforeUnload() {
  sessionStore.saveState(true)
}

onMounted(() => {
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('beforeunload', handleBeforeUnload)

  if (!import.meta.env.DEV) {
    setTimeout(checkVersion, 2000)
    versionCheckInterval = setInterval(checkVersion, 10 * 60 * 1000)
  }

  router.afterEach((to) => {
    if (to.path === '/' && uiStore.versionUpdatePending) {
      uiStore.versionUpdateAvailable = true
    }
    else {
      checkVersion()
    }
  })

  if ('serviceWorker' in navigator) {
    controllerChangeListener = () => {
      uiStore.versionUpdateReady = true
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
  <div class="app-root min-h-screen text-ink-950 dark:text-ink-50 transition-colors duration-250 relative overflow-x-hidden" :class="[isSessionRoute ? 'app-root--session' : 'app-root--workspace', sidebarExpanded ? 'app-root--sidebar-expanded' : '']">
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
    <SetEditorDialog />
    <ConfirmDialog />
    <PracticeDialog />
    <VersionUpdateDialog />

    <Toast :message="uiStore.toastMessage" :visible="uiStore.toastVisible" />
  </div>
</template>

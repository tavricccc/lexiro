<script setup lang="ts">
import { LoaderCircle } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import AppSidebar from '@/components/AppSidebar.vue'
import ConfirmDialog from '@/components/dialogs/ConfirmDialog.vue'
import DirtyFormDialog from '@/components/dialogs/DirtyFormDialog.vue'
import GuestDataDialog from '@/components/dialogs/GuestDataDialog.vue'
import ImportDialog from '@/components/dialogs/ImportDialog.vue'
import TransferDialog from '@/components/dialogs/TransferDialog.vue'
import VersionUpdateDialog from '@/components/dialogs/VersionUpdateDialog.vue'
import MobileBottomTabs from '@/components/MobileBottomTabs.vue'
import LottieLoadingOverlay from '@/components/ui/loading-overlay/LottieLoadingOverlay.vue'
import SyncProgress from '@/components/ui/sync-progress/SyncProgress.vue'
import Toast from '@/components/ui/toast/Toast.vue'
import { LAST_APP_VERSION_STORAGE_KEY, PENDING_UPDATE_VERSION_STORAGE_KEY, useAppUpdate } from '@/lib/useAppUpdate'
import { useCloudSyncStore } from '@/stores/cloudSync'
import { useSessionStore } from '@/stores/session'
import { useUIStore } from '@/stores/ui'

const uiStore = useUIStore()
const sessionStore = useSessionStore()
const cloudStore = useCloudSyncStore()
const route = useRoute()
const { t } = useI18n()
const { sidebarExpanded, hasDirtyForms, pageLoading, appStarting } = storeToRefs(uiStore)
const { operationBlocked, progress, pendingWrites, isOnline } = storeToRefs(cloudStore)

const { canAutoReloadCurrentVersion, reloadApp, reloading, updateAvailable } = useAppUpdate()

const isSessionRoute = computed(() => ['quiz', 'fillBlank', 'reading', 'review', 'result'].includes(String(route.name)))
const showInlineSync = computed(() => !appStarting.value && (operationBlocked.value || ['preparing', 'downloading', 'reconciling', 'uploading', 'retrying', 'verifying', 'offline', 'error'].includes(progress.value.phase)))

const shouldShowUpdateDialog = computed(() => {
  if (!updateAvailable.value)
    return false
  if (appStarting.value)
    return false
  if (reloading.value)
    return false
  if (canAutoReloadCurrentVersion() && !hasDirtyForms.value)
    return false
  return true
})

watch(
  [updateAvailable, appStarting, hasDirtyForms],
  ([hasUpdate, starting, dirty]) => {
    if (hasUpdate && !starting && !dirty && canAutoReloadCurrentVersion()) {
      void reloadApp({ automatic: true, reason: 'update' })
    }
  },
  { immediate: true },
)

watch(
  appStarting,
  (starting) => {
    if (!starting && typeof window !== 'undefined') {
      try {
        const lastVersion = localStorage.getItem(LAST_APP_VERSION_STORAGE_KEY)
        const pendingUpdateVersion = localStorage.getItem(PENDING_UPDATE_VERSION_STORAGE_KEY)
        const isNewVersion = Boolean(lastVersion && lastVersion !== __APP_VERSION__)
        const completedPendingUpdate = Boolean(
          pendingUpdateVersion
          && pendingUpdateVersion === __APP_VERSION__
          && isNewVersion,
        )

        if (completedPendingUpdate || (isNewVersion && !pendingUpdateVersion)) {
          uiStore.showToast(t('version.updated'))
        }
        if (completedPendingUpdate) {
          localStorage.removeItem(PENDING_UPDATE_VERSION_STORAGE_KEY)
        }
        localStorage.setItem(LAST_APP_VERSION_STORAGE_KEY, __APP_VERSION__)
      }
      catch {
        // Ignore storage errors
      }
    }
  },
  { immediate: true },
)

function handleVisibilityChange() {
  document.documentElement.classList.toggle('motion-paused', document.hidden)
  if (document.hidden) {
    sessionStore.saveState(true)
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
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('beforeunload', handleBeforeUnload)
})
</script>

<template>
  <LottieLoadingOverlay
    :open="appStarting"
    fullscreen
    :show-message="false"
    :show-progress="false"
    :reveal-delay="0"
    :minimum-visible="2000"
  />
  <div v-show="!appStarting" class="app-root min-h-screen text-ink-950 dark:text-ink-50 transition-colors duration-250 relative overflow-x-hidden" :class="[isSessionRoute ? 'app-root--session' : 'app-root--workspace', sidebarExpanded ? 'app-root--sidebar-expanded' : '']" :aria-busy="pageLoading || appStarting">
    <AppSidebar v-if="!isSessionRoute" />
    <MobileBottomTabs v-if="!isSessionRoute" />
    <AppHeader v-if="isSessionRoute" />

    <main class="app-main-content viewport-frame">
      <div class="route-page-frame">
        <router-view v-slot="{ Component }">
          <component :is="Component" />
        </router-view>
      </div>

      <LottieLoadingOverlay
        :open="pageLoading"
        :fullscreen="false"
        :show-message="false"
        :show-progress="false"
        :reveal-delay="180"
        :minimum-visible="300"
      />
    </main>

    <ImportDialog />
    <TransferDialog />
    <ConfirmDialog />
    <DirtyFormDialog />
    <GuestDataDialog />
    <VersionUpdateDialog :open="shouldShowUpdateDialog" />

    <Toast :message="uiStore.toastMessage" :visible="uiStore.toastVisible" :action-label="uiStore.toastActionLabel" @action="uiStore.triggerToastAction" />
    <SyncProgress v-if="showInlineSync" :state="progress" allow-cancel @retry="cloudStore.retryConnection" @cancel="cloudStore.continueOffline" />

    <div v-if="pendingWrites > 0 && !isOnline" class="fixed right-4 top-4 z-[80] rounded-full border border-amber-300/70 bg-amber-50/95 px-3 py-2 text-xs font-black text-amber-800 shadow-soft backdrop-blur dark:border-amber-700/60 dark:bg-amber-950/90 dark:text-amber-100" role="status">
      {{ $t('sync.pending', { count: pendingWrites }) }}
    </div>

    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="reloading"
          class="fixed inset-0 z-[999] flex items-center justify-center bg-ink-950/70 text-white backdrop-blur-md"
          role="status"
          aria-live="assertive"
        >
          <div class="flex flex-col items-center gap-3">
            <LoaderCircle class="h-8 w-8 animate-spin text-white" />
            <p class="text-sm font-semibold">
              {{ $t('version.updating') }}
            </p>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

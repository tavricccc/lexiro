<script setup lang="ts">
import { RefreshCw } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { useUIStore } from '@/stores/ui'
import Button from '../ui/button/Button.vue'
import Dialog from '../ui/dialog/Dialog.vue'

const uiStore = useUIStore()
const { versionUpdateAvailable, versionUpdateReady, versionUpdateLoading } = storeToRefs(uiStore)
const { setVersionUpdateAvailable, setVersionUpdateLoading } = uiStore

function handleReload() {
  if (versionUpdateReady.value) {
    window.location.reload()
  }
  else {
    setVersionUpdateLoading(true)
  }
}

function handleClose() {
  setVersionUpdateAvailable(false)
  setVersionUpdateLoading(false)
}
</script>

<template>
  <Dialog
    :open="versionUpdateAvailable"
    :title="$t('version.title')"
    :description="$t('version.description')"
    :show-close="true"
    width-class="max-w-md"
    @close="handleClose"
  >
    <div class="flex flex-col items-center justify-center py-6 px-2 text-center">
      <div class="relative mb-6">
        <div class="absolute inset-0 rounded-full bg-emerald-500/20 dark:bg-emerald-500/30 blur-lg animate-pulse" />
        <div class="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-200/50 dark:border-emerald-800/30 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 shadow-inner">
          <RefreshCw class="h-8 w-8 animate-spin-slow" />
        </div>
      </div>

      <div class="flex w-full flex-col sm:flex-row justify-end gap-2.5 mt-4 pt-4 border-t border-ink-100 dark:border-ink-800/60">
        <Button variant="outline" class="w-full sm:w-auto" @click="handleClose">
          {{ $t('version.laterBtn') }}
        </Button>
        <Button variant="default" class="w-full sm:w-auto gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-md shadow-emerald-500/10 dark:shadow-emerald-950/20" :disabled="versionUpdateLoading" @click="handleReload">
          <RefreshCw v-if="versionUpdateLoading" class="h-4 w-4 animate-spin" />
          <RefreshCw v-else class="h-4 w-4" />
          {{ $t('version.updateBtn') }}
        </Button>
      </div>
    </div>
  </Dialog>
</template>

<style scoped>
.animate-spin-slow {
  animation: spin 8s linear infinite;
}
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>

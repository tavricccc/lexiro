<script setup lang="ts">
import { RefreshCw } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUIStore } from '@/stores/ui'
import Button from '../ui/button/Button.vue'
import Dialog from '../ui/dialog/Dialog.vue'
import DialogFooter from '../ui/dialog/DialogFooter.vue'
import StatusMessage from '../ui/status-message/StatusMessage.vue'

const uiStore = useUIStore()
const { versionUpdateAvailable, versionUpdateReady, versionUpdateLoading, versionUpdateError, hasDirtyForms } = storeToRefs(uiStore)
const { discardDirtyForms, saveDirtyForms, setVersionUpdateError, setVersionUpdateLoading } = uiStore
const { t } = useI18n()
let retryTimer: ReturnType<typeof setTimeout> | null = null

type UpdateIntent = 'direct' | 'save' | 'discard'

async function handleReload(intent: UpdateIntent = 'direct') {
  setVersionUpdateError('')
  if (intent === 'save') {
    setVersionUpdateLoading(true)
    if (!await saveDirtyForms()) {
      setVersionUpdateLoading(false)
      setVersionUpdateError(t('version.saveDirtyError'))
      return
    }
  }
  else if (intent === 'discard') {
    discardDirtyForms()
  }

  if (versionUpdateReady.value) {
    window.location.reload()
    return
  }

  setVersionUpdateLoading(true)
  if (retryTimer)
    clearTimeout(retryTimer)
  retryTimer = setTimeout(() => {
    if (versionUpdateLoading.value) {
      setVersionUpdateLoading(false)
      setVersionUpdateError(t('version.updateError'))
    }
  }, 15000)
}

onUnmounted(() => {
  if (retryTimer)
    clearTimeout(retryTimer)
})
</script>

<template>
  <Dialog
    :open="versionUpdateAvailable"
    :title="$t('version.title')"
    :description="$t('version.description')"
    :show-close="false"
    close-policy="blocked"
    presentation="responsive-sheet"
    size="sm"
    tone="mandatory"
    :busy="versionUpdateLoading"
    width-class="max-w-md"
  >
    <div class="flex flex-col items-center justify-center px-2 py-6 text-center">
      <div class="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-ink-200/70 bg-ink-50 text-ink-600 dark:border-ink-200/20 dark:bg-ink-900 dark:text-ink-300">
        <RefreshCw class="h-7 w-7" />
      </div>
      <StatusMessage v-if="versionUpdateError" class="w-full" tone="error">
        {{ versionUpdateError }}
      </StatusMessage>
      <p v-if="hasDirtyForms" class="mt-4 w-full rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-left text-xs font-semibold leading-relaxed text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/20 dark:text-amber-200">
        {{ $t('version.unsavedDescription') }}
      </p>
    </div>

    <template #footer>
      <DialogFooter>
        <template v-if="hasDirtyForms">
          <Button variant="outline" class="w-full sm:w-auto" :disabled="versionUpdateLoading" @click="handleReload('discard')">
            {{ $t('version.discardAndUpdate') }}
          </Button>
          <Button variant="default" class="w-full gap-2 sm:w-auto" :loading="versionUpdateLoading" @click="handleReload('save')">
            <RefreshCw v-if="!versionUpdateLoading" class="h-4 w-4" />
            {{ $t('version.saveAndUpdate') }}
          </Button>
        </template>
        <Button v-else variant="default" class="w-full gap-2 sm:w-auto" :loading="versionUpdateLoading" @click="handleReload">
          <RefreshCw v-if="!versionUpdateLoading" class="h-4 w-4" />
          {{ $t('version.updateBtn') }}
        </Button>
      </DialogFooter>
    </template>
  </Dialog>
</template>

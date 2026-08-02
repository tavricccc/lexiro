<script setup lang="ts">
import { Download, LogIn } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { ref } from 'vue'
import { useBackupStore } from '@/stores/backup'
import { useUIStore } from '@/stores/ui'
import Button from '../ui/button/Button.vue'
import Dialog from '../ui/dialog/Dialog.vue'

const uiStore = useUIStore()
const backupStore = useBackupStore()
const { guestDataWarningOpen } = storeToRefs(uiStore)
const { resolveGuestDataWarning } = uiStore
const { exportFullBackup } = backupStore
const exporting = ref(false)

async function exportGuestData() {
  if (exporting.value)
    return
  exporting.value = true
  try {
    await exportFullBackup()
    resolveGuestDataWarning('export')
  }
  finally {
    exporting.value = false
  }
}
</script>

<template>
  <Dialog
    :open="guestDataWarningOpen"
    :title="$t('sync.guestDataWarningTitle')"
    :description="$t('sync.guestDataWarningMessage')"
    width-class="max-w-lg"
    @close="resolveGuestDataWarning('cancel')"
  >
    <div class="flex flex-wrap justify-end gap-2 pt-2">
      <Button variant="ghost" @click="resolveGuestDataWarning('cancel')">
        {{ $t('sync.guestDataCancel') }}
      </Button>
      <Button variant="outline" class="gap-2" :disabled="exporting" @click="exportGuestData">
        <Download class="h-4 w-4" />
        {{ $t('sync.guestDataExport') }}
      </Button>
      <Button variant="default" class="gap-2" @click="resolveGuestDataWarning('continue')">
        <LogIn class="h-4 w-4" />
        {{ $t('sync.guestDataContinue') }}
      </Button>
    </div>
  </Dialog>
</template>

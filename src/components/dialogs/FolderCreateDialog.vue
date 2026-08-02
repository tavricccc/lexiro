<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ALL_FOLDER_ID, folderParentIdFromSelection } from '@/lib/folders'
import { useFolderCreation } from '@/lib/use-folder-creation'
import { useLibraryStore } from '@/stores/library'
import FolderTree from '../FolderTree.vue'
import Button from '../ui/button/Button.vue'
import DialogFooter from '../ui/dialog-footer/DialogFooter.vue'
import Dialog from '../ui/dialog/Dialog.vue'
import Input from '../ui/input/Input.vue'
import StatusMessage from '../ui/status-message/StatusMessage.vue'

const props = defineProps<{
  open: boolean
  parentId: string
}>()

const emit = defineEmits<{
  close: []
  created: [id: string]
}>()

const { t } = useI18n()
const libraryStore = useLibraryStore()
const selectedParentId = ref(ALL_FOLDER_ID)
const folderCreation = useFolderCreation(
  name => libraryStore.addFolder(name, folderParentIdFromSelection(selectedParentId.value)),
  () => t('library.folderNameRequired'),
)
const { name, error, reset: resetCreation } = folderCreation

function reset() {
  resetCreation()
  selectedParentId.value = props.parentId && props.parentId !== ALL_FOLDER_ID ? props.parentId : ALL_FOLDER_ID
}

function createFolder() {
  const folder = folderCreation.submit()
  if (!folder)
    return
  emit('created', folder.id)
  emit('close')
}

watch(() => props.open, (open) => {
  if (open)
    reset()
})
</script>

<template>
  <Dialog :open="open" :title="$t('library.folderCreateTitle')" :description="$t('library.folderCreateDescription')" width-class="max-w-md" @close="emit('close')">
    <div class="space-y-4">
      <div class="space-y-1.5 text-left">
        <label class="text-xs font-semibold text-ink-500 dark:text-ink-400">{{ $t('library.newFolderPlaceholder') }}</label>
        <Input v-model="name" autofocus :placeholder="$t('library.newFolderPlaceholder')" @keydown.enter.prevent="createFolder" />
      </div>

      <div class="space-y-2 text-left">
        <p class="text-xs font-semibold text-ink-500 dark:text-ink-400">
          {{ $t('library.folderParentLabel') }}
        </p>
        <div class="rounded-2xl border border-ink-200/70 bg-ink-50/60 p-2 dark:border-ink-200/15 dark:bg-ink-950/40">
          <FolderTree v-model="selectedParentId" :folders="libraryStore.folders" :include-root="true" :show-actions="false" />
        </div>
      </div>

      <StatusMessage v-if="error" tone="error">
        {{ error }}
      </StatusMessage>

      <DialogFooter>
        <Button variant="outline" @click="emit('close')">
          {{ $t('editor.cancel') }}
        </Button>
        <Button variant="default" @click="createFolder">
          {{ $t('library.folderCreateConfirm') }}
        </Button>
      </DialogFooter>
    </div>
  </Dialog>
</template>

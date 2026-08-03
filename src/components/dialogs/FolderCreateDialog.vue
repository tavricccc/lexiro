<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { syncAfterLocalCommit } from '@/lib/commit-sync'
import { useDirtyForm } from '@/lib/dirty-form'
import { ALL_FOLDER_ID, folderParentIdFromSelection, UNCATEGORIZED_FOLDER_ID } from '@/lib/folders'
import { useFolderCreation } from '@/lib/use-folder-creation'
import { useLibraryStore } from '@/stores/library'
import Button from '../ui/button/Button.vue'
import Dialog from '../ui/dialog/Dialog.vue'
import DialogFooter from '../ui/dialog/DialogFooter.vue'
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
const initialDraftSnapshot = ref('')
const pendingFolderId = ref<string | null>(null)

function draftSnapshot(): string {
  return JSON.stringify({ name: name.value, parentId: selectedParentId.value })
}

const draftDirty = computed(() => props.open && (pendingFolderId.value !== null || initialDraftSnapshot.value !== draftSnapshot()))

function reset() {
  resetCreation()
  pendingFolderId.value = null
  selectedParentId.value = props.parentId && props.parentId !== ALL_FOLDER_ID && props.parentId !== UNCATEGORIZED_FOLDER_ID
    ? props.parentId
    : ALL_FOLDER_ID
  initialDraftSnapshot.value = draftSnapshot()
}

async function createFolder(): Promise<boolean> {
  if (pendingFolderId.value) {
    const synced = await syncAfterLocalCommit()
    if (!synced)
      return false
    const createdId = pendingFolderId.value
    pendingFolderId.value = null
    emit('created', createdId)
    emit('close')
    return true
  }
  const folder = folderCreation.submit()
  if (!folder)
    return false
  pendingFolderId.value = folder.id
  const synced = await syncAfterLocalCommit()
  initialDraftSnapshot.value = draftSnapshot()
  if (!synced)
    return false
  pendingFolderId.value = null
  emit('created', folder.id)
  emit('close')
  return true
}

const dirtyForm = useDirtyForm({
  id: 'folder-create',
  isDirty: () => draftDirty.value,
  save: async () => await createFolder(),
  discard: () => emit('close'),
})

function close() {
  void dirtyForm.requestClose()
}

watch(() => props.open, (open) => {
  if (open)
    reset()
})
</script>

<template>
  <Dialog :open="open" :title="$t('library.folderCreateTitle')" :description="$t('library.folderCreateDescription')" width-class="max-w-md" @close="close">
    <fieldset :disabled="pendingFolderId !== null" class="contents">
      <div class="space-y-4">
        <div class="space-y-1.5 text-left">
          <label class="text-xs font-semibold text-ink-500 dark:text-ink-400">{{ $t('library.newFolderPlaceholder') }}</label>
          <Input v-model="name" autofocus :placeholder="$t('library.newFolderPlaceholder')" @keydown.enter.prevent="createFolder" />
        </div>

        <StatusMessage v-if="error" tone="error">
          {{ error }}
        </StatusMessage>
      </div>
    </fieldset>
    <template #footer>
      <DialogFooter>
        <Button variant="outline" @click="close">
          {{ $t('editor.cancel') }}
        </Button>
        <Button variant="default" @click="createFolder">
          {{ $t('library.folderCreateConfirm') }}
        </Button>
      </DialogFooter>
    </template>
  </Dialog>
</template>

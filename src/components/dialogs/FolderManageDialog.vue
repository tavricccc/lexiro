<script setup lang="ts">
import type { VocabFolder } from '@/types'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { syncAfterLocalCommit } from '@/lib/commit-sync'
import { useDirtyForm } from '@/lib/dirty-form'
import { confirmAndRemoveFolder } from '@/lib/folder-deletion'
import { ALL_FOLDER_ID } from '@/lib/folders'
import { useLibraryStore } from '@/stores/library'
import FolderTree from '../FolderTree.vue'
import Button from '../ui/button/Button.vue'
import Dialog from '../ui/dialog/Dialog.vue'
import DialogFooter from '../ui/dialog/DialogFooter.vue'
import Input from '../ui/input/Input.vue'
import StatusMessage from '../ui/status-message/StatusMessage.vue'

const props = defineProps<{
  open: boolean
  folder: VocabFolder | null
}>()

const emit = defineEmits<{
  close: []
  updated: []
  deleted: []
}>()

const { t } = useI18n()
const libraryStore = useLibraryStore()
const { folders } = storeToRefs(libraryStore)
const name = ref('')
const parentId = ref(ALL_FOLDER_ID)
const error = ref('')
const initialDraftSnapshot = ref('')
const pendingLocalCommit = ref(false)
const pendingDelete = ref(false)

watch(() => [props.open, props.folder] as const, ([open, folder]) => {
  if (!open || !folder)
    return
  name.value = folder.name
  parentId.value = folder.parentId ?? ALL_FOLDER_ID
  error.value = ''
  pendingLocalCommit.value = false
  pendingDelete.value = false
  initialDraftSnapshot.value = draftSnapshot()
}, { immediate: true })

function draftSnapshot(): string {
  return JSON.stringify({ name: name.value, parentId: parentId.value })
}

const draftDirty = computed(() => props.open && Boolean(props.folder) && (pendingLocalCommit.value || pendingDelete.value || initialDraftSnapshot.value !== draftSnapshot()))

async function close() {
  await dirtyForm.requestClose()
}

function discard() {
  error.value = ''
  emit('close')
}

async function save(): Promise<boolean> {
  if (pendingDelete.value) {
    const synced = await syncAfterLocalCommit()
    if (!synced)
      return false
    pendingDelete.value = false
    emit('deleted')
    emit('close')
    return true
  }
  if (pendingLocalCommit.value) {
    const synced = await syncAfterLocalCommit()
    if (!synced)
      return false
    pendingLocalCommit.value = false
    initialDraftSnapshot.value = draftSnapshot()
    emit('updated')
    close()
    return true
  }
  if (!props.folder || !name.value.trim()) {
    error.value = t('library.folderNameRequired')
    return false
  }
  if (!libraryStore.updateFolder(props.folder.id, { name: name.value, parentId: parentId.value })) {
    error.value = t('library.folderUpdateFailed')
    return false
  }
  pendingLocalCommit.value = true
  const synced = await syncAfterLocalCommit()
  if (!synced)
    return false
  pendingLocalCommit.value = false
  initialDraftSnapshot.value = draftSnapshot()
  emit('updated')
  close()
  return true
}

async function remove() {
  if (!props.folder)
    return
  if (pendingDelete.value) {
    await save()
    return
  }
  if (await confirmAndRemoveFolder(props.folder)) {
    pendingDelete.value = true
    const synced = await syncAfterLocalCommit()
    if (!synced)
      return
    pendingDelete.value = false
    emit('deleted')
    emit('close')
  }
}

const dirtyForm = useDirtyForm({
  id: 'folder-manage',
  isDirty: () => draftDirty.value,
  save,
  discard,
})
</script>

<template>
  <Dialog :open="open" :title="$t('library.folderEditTitle')" :description="$t('library.folderEditDescription')" width-class="max-w-md" @close="close">
    <fieldset v-if="folder" :disabled="pendingLocalCommit || pendingDelete" class="contents">
      <div class="space-y-4">
        <div class="space-y-1.5 text-left">
          <label class="text-xs font-semibold text-ink-500 dark:text-ink-400">{{ $t('library.folderNameLabel') }}</label>
          <Input v-model="name" autofocus :placeholder="$t('library.newFolderPlaceholder')" />
        </div>
        <div class="space-y-2 text-left">
          <p class="text-xs font-semibold text-ink-500 dark:text-ink-400">
            {{ $t('library.folderParentLabel') }}
          </p>
          <div class="rounded-2xl border border-ink-200/70 bg-ink-50/60 p-2 dark:border-ink-200/15 dark:bg-ink-950/40">
            <FolderTree v-model="parentId" :folders="folders" :include-root="true" :show-actions="false" :allow-uncategorized="false" />
          </div>
        </div>
        <StatusMessage v-if="error" tone="error">
          {{ error }}
        </StatusMessage>
      </div>
    </fieldset>
    <template #footer>
      <DialogFooter>
        <Button variant="ghost" class="mr-auto text-red-500" :disabled="pendingLocalCommit" @click="remove">
          {{ $t('library.folderDelete') }}
        </Button>
        <Button variant="outline" @click="close">
          {{ $t('editor.cancel') }}
        </Button>
        <Button @click="save">
          {{ $t('editor.save') }}
        </Button>
      </DialogFooter>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import type { VocabFolder } from '@/types'
import { storeToRefs } from 'pinia'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
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
  deleted: []
}>()

const { t } = useI18n()
const libraryStore = useLibraryStore()
const { folders } = storeToRefs(libraryStore)
const name = ref('')
const parentId = ref(ALL_FOLDER_ID)
const error = ref('')

watch(() => [props.open, props.folder] as const, ([open, folder]) => {
  if (!open || !folder)
    return
  name.value = folder.name
  parentId.value = folder.parentId ?? ALL_FOLDER_ID
  error.value = ''
}, { immediate: true })

function close() {
  error.value = ''
  emit('close')
}

function save() {
  if (!props.folder || !name.value.trim()) {
    error.value = t('library.folderNameRequired')
    return
  }
  if (!libraryStore.updateFolder(props.folder.id, { name: name.value, parentId: parentId.value })) {
    error.value = t('library.folderUpdateFailed')
    return
  }
  close()
}

async function remove() {
  if (!props.folder)
    return
  if (await confirmAndRemoveFolder(props.folder)) {
    emit('deleted')
    close()
  }
}
</script>

<template>
  <Dialog :open="open" :title="$t('library.folderEditTitle')" :description="$t('library.folderEditDescription')" width-class="max-w-md" @close="close">
    <div v-if="folder" class="space-y-4">
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
    <template #footer>
      <DialogFooter>
        <Button variant="ghost" class="mr-auto text-red-500" @click="remove">
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

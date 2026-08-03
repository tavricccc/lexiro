<script setup lang="ts">
import { ChevronRight, Folder } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { syncAfterLocalCommit } from '@/lib/commit-sync'
import { ALL_FOLDER_ID, folderParentIdFromSelection, UNCATEGORIZED_FOLDER_ID } from '@/lib/folders'
import { useFolderCreation } from '@/lib/use-folder-creation'
import { useLibraryStore } from '@/stores/library'
import FolderTree from '../FolderTree.vue'
import Button from '../ui/button/Button.vue'
import Dialog from '../ui/dialog/Dialog.vue'
import DialogFooter from '../ui/dialog/DialogFooter.vue'
import Input from '../ui/input/Input.vue'
import StatusMessage from '../ui/status-message/StatusMessage.vue'

const props = withDefaults(defineProps<{
  modelValue: string
  title?: string
  disabled?: boolean
}>(), {
  title: '',
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const { t } = useI18n()
const libraryStore = useLibraryStore()
const dialogOpen = ref(false)
const draftFolderId = ref(ALL_FOLDER_ID)
const pendingFolderId = ref<string | null>(null)
const folderCreation = useFolderCreation(
  name => libraryStore.addFolder(name, folderParentIdFromSelection(draftFolderId.value)),
  () => t('library.folderNameRequired'),
)
const { name: newFolderName, error: folderError, reset: resetFolderCreation } = folderCreation

const selectedFolderName = computed(() => {
  const value = props.modelValue
  if (!value || value === ALL_FOLDER_ID || value === UNCATEGORIZED_FOLDER_ID)
    return t('library.rootFolder')
  return libraryStore.folders.find(folder => folder.id === value)?.name ?? t('library.rootFolder')
})

function openDialog() {
  if (props.disabled)
    return
  draftFolderId.value = props.modelValue || ALL_FOLDER_ID
  pendingFolderId.value = null
  resetFolderCreation()
  dialogOpen.value = true
}

function closeDialog() {
  if (pendingFolderId.value)
    return
  dialogOpen.value = false
}

function confirmFolder() {
  if (pendingFolderId.value)
    return
  emit('update:modelValue', draftFolderId.value)
  closeDialog()
}

async function createFolder() {
  if (pendingFolderId.value) {
    const { localPersisted } = await syncAfterLocalCommit()
    if (localPersisted) {
      draftFolderId.value = pendingFolderId.value
      pendingFolderId.value = null
    }
    return
  }
  const folder = folderCreation.submit()
  if (!folder)
    return
  pendingFolderId.value = folder.id
  draftFolderId.value = folder.id
  const { localPersisted } = await syncAfterLocalCommit()
  if (localPersisted) {
    draftFolderId.value = folder.id
    pendingFolderId.value = null
  }
}

watch(() => props.modelValue, (value) => {
  if (!dialogOpen.value)
    draftFolderId.value = value || ALL_FOLDER_ID
})
</script>

<template>
  <div class="space-y-2 text-left">
    <label class="text-xs font-semibold text-ink-500 dark:text-ink-400">{{ title || $t('editor.folder') }}</label>
    <button type="button" :disabled="disabled" class="flex min-h-11 w-full items-center gap-3 rounded-xl border border-ink-200/80 bg-white px-3 py-2 text-left transition-colors hover:border-accent-primary/50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-ink-200/20 dark:bg-ink-900" @click="openDialog">
      <Folder class="h-4 w-4 shrink-0 text-accent-primary" />
      <span class="min-w-0 flex-1 truncate text-sm font-semibold text-ink-800 dark:text-ink-100">{{ selectedFolderName }}</span>
      <ChevronRight class="h-4 w-4 shrink-0 text-ink-400" />
    </button>

    <Dialog :open="dialogOpen" :title="$t('library.folderSelectTitle')" :description="$t('library.folderSelectDescription')" width-class="max-w-md" @close="closeDialog">
      <div class="space-y-4">
        <div class="rounded-2xl border border-ink-200/70 bg-ink-50/60 p-2 dark:border-ink-200/15 dark:bg-ink-950/40">
          <fieldset :disabled="Boolean(pendingFolderId)" class="contents">
            <FolderTree v-model="draftFolderId" :folders="libraryStore.folders" :include-root="true" :root-label="$t('library.rootFolder')" :show-actions="false" />
          </fieldset>
        </div>

        <div class="rounded-2xl bg-ink-50/70 p-3 dark:bg-ink-900/60">
          <p class="mb-2 text-xs font-semibold text-ink-500 dark:text-ink-400">
            {{ $t('library.newFolder') }}
          </p>
          <form class="flex min-w-0 gap-2" @submit.prevent="createFolder">
            <fieldset :disabled="Boolean(pendingFolderId)" class="contents">
              <Input v-model="newFolderName" class="min-w-0 flex-1 rounded-xl" :placeholder="$t('library.newFolderPlaceholder')" />
            </fieldset>
            <Button type="submit" size="sm" variant="outline" :loading="Boolean(pendingFolderId)">
              {{ $t('library.newFolderShort') }}
            </Button>
          </form>
          <StatusMessage v-if="folderError" class="mt-2" tone="error">
            {{ folderError }}
          </StatusMessage>
          <StatusMessage v-if="pendingFolderId" class="mt-2" tone="info">
            {{ $t('sync.savedLocally') }}
          </StatusMessage>
          <p class="mt-2 text-[11px] leading-relaxed text-ink-400">
            {{ $t('library.folderCreateHint') }}
          </p>
        </div>
      </div>
      <template #footer>
        <DialogFooter>
          <Button variant="outline" :disabled="Boolean(pendingFolderId)" @click="closeDialog">
            {{ $t('editor.cancel') }}
          </Button>
          <Button variant="default" :disabled="Boolean(pendingFolderId)" @click="confirmFolder">
            {{ $t('library.folderSelectConfirm') }}
          </Button>
        </DialogFooter>
      </template>
    </Dialog>
  </div>
</template>

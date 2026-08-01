<script setup lang="ts">
import { ref } from 'vue'
import { folderIdFromSelection } from '@/lib/folders'
import { useLibraryStore } from '@/stores/library'
import FolderTree from '../FolderTree.vue'
import Button from '../ui/button/Button.vue'
import Input from '../ui/input/Input.vue'

const props = withDefaults(defineProps<{
  modelValue: string
  title?: string
}>(), {
  title: '',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const libraryStore = useLibraryStore()
const newFolderName = ref('')

function update(value: string) {
  emit('update:modelValue', value)
}

function createFolder() {
  const name = newFolderName.value.trim()
  if (!name)
    return
  const folder = libraryStore.addFolder(name, folderIdFromSelection(props.modelValue))
  emit('update:modelValue', folder.id)
  newFolderName.value = ''
}
</script>

<template>
  <div class="space-y-2 text-left">
    <label class="text-xs font-semibold text-ink-500 dark:text-ink-400">{{ title || $t('editor.folder') }}</label>
    <FolderTree
      :model-value="modelValue"
      :folders="libraryStore.folders"
      @update:model-value="update"
    />
    <div class="rounded-xl bg-ink-50/70 p-2.5 dark:bg-ink-900/60">
      <p class="mb-2 text-[11px] font-semibold text-ink-500 dark:text-ink-400">
        {{ $t('library.newFolder') }}
      </p>
      <form class="flex min-w-0 gap-2" @submit.prevent="createFolder">
        <Input v-model="newFolderName" class="min-w-0 flex-1 rounded-xl" :placeholder="$t('library.newFolderPlaceholder')" />
        <Button type="submit" size="sm" variant="outline" :aria-label="$t('library.newFolder')">
          {{ $t('library.newFolderShort') }}
        </Button>
      </form>
    </div>
    <p class="text-[11px] leading-relaxed text-ink-400 dark:text-ink-500">
      {{ $t('library.folderCreateHint') }}
    </p>
  </div>
</template>

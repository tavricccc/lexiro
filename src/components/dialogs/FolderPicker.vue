<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { buildFolderOptions, folderIdFromSelection, UNCATEGORIZED_FOLDER_ID } from '@/lib/folders'
import { useLibraryStore } from '@/stores/library'
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

const { t } = useI18n()
const libraryStore = useLibraryStore()
const newFolderName = ref('')
const folderOptions = computed(() => buildFolderOptions(libraryStore.folders, t('library.rootFolder')))

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
  <div class="space-y-1.5 text-left">
    <label class="text-xs font-semibold text-ink-500 dark:text-ink-400">{{ title || $t('editor.folder') }}</label>
    <div class="flex flex-col gap-2 sm:flex-row">
      <select
        :value="modelValue || UNCATEGORIZED_FOLDER_ID"
        class="min-h-10 min-w-0 flex-1 rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-sm font-medium text-ink-800 outline-none transition focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/15 dark:border-ink-200/20 dark:bg-ink-900 dark:text-ink-100"
        @change="update(($event.target as HTMLSelectElement).value)"
      >
        <option v-for="option in folderOptions" :key="option.id" :value="option.id">
          {{ option.label }}
        </option>
      </select>
      <form class="flex min-w-0 gap-2 sm:w-56" @submit.prevent="createFolder">
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

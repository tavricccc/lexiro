<script setup lang="ts">
import type { VocabFolder } from '@/types'
import { Folder, FolderOpen, Layers3 } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ALL_FOLDER_ID, buildFolderOptions, UNCATEGORIZED_FOLDER_ID } from '@/lib/folders'

const props = withDefaults(defineProps<{
  modelValue: string
  folders: VocabFolder[]
  includeAll?: boolean
  allLabel?: string
  rootLabel?: string
}>(), {
  includeAll: false,
  allLabel: '',
  rootLabel: '',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const { t } = useI18n()
const rootLabel = computed(() => props.rootLabel || t('library.rootFolder'))
const allLabel = computed(() => props.allLabel || t('library.allFolders'))
const folderOptions = computed(() => buildFolderOptions(props.folders, rootLabel.value))
const selectedId = computed(() => props.modelValue || UNCATEGORIZED_FOLDER_ID)

function selectFolder(id: string) {
  emit('update:modelValue', id)
}
</script>

<template>
  <div
    class="rounded-xl border border-ink-200/80 bg-ink-50/60 p-1.5 dark:border-ink-700/80 dark:bg-ink-950/40"
    role="listbox"
    :aria-label="$t('library.folderTitle')"
  >
    <button
      v-if="includeAll"
      type="button"
      class="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-ink-600 transition-colors hover:bg-white hover:text-ink-950 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-ink-50"
      :class="selectedId === ALL_FOLDER_ID ? 'bg-white text-ink-950 shadow-sm dark:bg-ink-800 dark:text-ink-50' : ''"
      role="option"
      :aria-selected="selectedId === ALL_FOLDER_ID"
      @click="selectFolder(ALL_FOLDER_ID)"
    >
      <Layers3 class="h-4 w-4 shrink-0 text-ink-400" />
      <span>{{ allLabel }}</span>
    </button>

    <div v-if="includeAll" class="mx-3 my-1 border-t border-ink-200/70 dark:border-ink-700/70" />

    <button
      v-for="option in folderOptions"
      :key="option.id"
      type="button"
      class="relative flex min-h-10 w-full items-center gap-2 rounded-lg py-2 pr-3 text-left text-sm font-medium text-ink-600 transition-colors hover:bg-white hover:text-ink-950 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-ink-50"
      :class="selectedId === option.id ? 'bg-white text-ink-950 shadow-sm dark:bg-ink-800 dark:text-ink-50' : ''"
      :style="{ paddingLeft: `${0.75 + option.depth * 1.1}rem` }"
      role="option"
      :aria-selected="selectedId === option.id"
      @click="selectFolder(option.id)"
    >
      <span
        v-if="option.depth > 0"
        class="pointer-events-none absolute inset-y-0 border-l border-ink-200/70 dark:border-ink-700/70"
        :style="{ left: `${1.1 + (option.depth - 1) * 1.1}rem` }"
      />
      <FolderOpen v-if="selectedId === option.id" class="h-4 w-4 shrink-0 text-accent-primary" />
      <Folder v-else class="h-4 w-4 shrink-0 text-ink-400" />
      <span class="truncate">{{ option.name }}</span>
    </button>
  </div>
</template>

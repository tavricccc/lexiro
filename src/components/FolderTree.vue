<script setup lang="ts">
import type { VocabFolder } from '@/types'
import { Folder, FolderOpen, Layers3 } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ALL_FOLDER_ID, getFolderChildren, UNCATEGORIZED_FOLDER_ID } from '@/lib/folders'
import FolderTreeNode from './FolderTreeNode.vue'

const props = withDefaults(defineProps<{
  modelValue: string
  folders: VocabFolder[]
  includeAll?: boolean
  includeRoot?: boolean
  allLabel?: string
  rootLabel?: string
  showActions?: boolean
  allowUncategorized?: boolean
}>(), {
  includeAll: false,
  includeRoot: false,
  allLabel: '',
  rootLabel: '',
  showActions: true,
  allowUncategorized: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'edit': [folderId: string]
  'delete': [folderId: string]
}>()

const { t } = useI18n()
const selectedId = computed(() => props.modelValue || (props.includeRoot ? ALL_FOLDER_ID : UNCATEGORIZED_FOLDER_ID))
const allLabel = computed(() => props.allLabel || t('library.allFolders'))
const rootLabel = computed(() => props.rootLabel || t('library.rootFolder'))
const rootFolders = computed(() => getFolderChildren(props.folders).filter(folder => folder.id !== UNCATEGORIZED_FOLDER_ID))
const expandedIds = ref(new Set(rootFolders.value.map(folder => folder.id)))

function ensureSelectedAncestors() {
  const byId = new Map(props.folders.map(folder => [folder.id, folder]))
  const next = new Set(expandedIds.value)
  let current = byId.get(selectedId.value)
  while (current?.parentId) {
    next.add(current.parentId)
    current = byId.get(current.parentId)
  }
  expandedIds.value = next
}

function selectFolder(id: string) {
  emit('update:modelValue', id)
}

function toggleFolder(id: string) {
  const next = new Set(expandedIds.value)
  if (next.has(id))
    next.delete(id)
  else
    next.add(id)
  expandedIds.value = next
}

watch(() => props.folders, () => {
  const next = new Set(expandedIds.value)
  for (const folder of rootFolders.value)
    next.add(folder.id)
  expandedIds.value = next
  ensureSelectedAncestors()
}, { deep: true })
watch(() => props.modelValue, ensureSelectedAncestors, { immediate: true })
</script>

<template>
  <div class="space-y-0.5" role="listbox" :aria-label="$t('library.folderTitle')">
    <button
      v-if="includeAll"
      type="button"
      class="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors"
      :class="selectedId === ALL_FOLDER_ID ? 'bg-ink-100 text-ink-950 dark:bg-ink-800 dark:text-ink-50' : 'text-ink-600 hover:bg-ink-100/80 dark:text-ink-300 dark:hover:bg-ink-800/80'"
      role="option"
      :aria-selected="selectedId === ALL_FOLDER_ID"
      @click="selectFolder(ALL_FOLDER_ID)"
    >
      <Layers3 class="h-4 w-4 shrink-0 text-ink-400" />
      <span>{{ allLabel }}</span>
    </button>

    <div v-if="includeAll" class="mx-3 my-1 border-t border-ink-200/70 dark:border-ink-700/70" />

    <button
      v-if="includeRoot"
      type="button"
      class="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors"
      :class="selectedId === ALL_FOLDER_ID ? 'bg-accent-primary/10 text-accent-primary' : 'text-ink-700 hover:bg-ink-100/80 dark:text-ink-200 dark:hover:bg-ink-800/80'"
      role="option"
      :aria-selected="selectedId === ALL_FOLDER_ID"
      @click="selectFolder(ALL_FOLDER_ID)"
    >
      <FolderOpen v-if="selectedId === ALL_FOLDER_ID" class="h-4 w-4 shrink-0 text-accent-primary" />
      <Folder v-else class="h-4 w-4 shrink-0 text-ink-400" />
      <span>{{ rootLabel }}</span>
    </button>

    <FolderTreeNode
      v-for="folder in rootFolders"
      :key="folder.id"
      :folder="folder"
      :folders="folders"
      :selected-id="selectedId"
      :expanded-ids="expandedIds"
      :show-actions="showActions"
      :selectable="allowUncategorized || folder.id !== UNCATEGORIZED_FOLDER_ID"
      @select="selectFolder"
      @toggle="toggleFolder"
      @edit="emit('edit', $event)"
      @delete="emit('delete', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import type { VocabFolder } from '@/types'
import { ChevronDown, ChevronRight, Folder, FolderOpen, Pencil, Trash2 } from 'lucide-vue-next'
import { computed } from 'vue'
import { getFolderChildren, UNCATEGORIZED_FOLDER_ID } from '@/lib/folders'

const props = withDefaults(defineProps<{
  folder: VocabFolder
  folders: VocabFolder[]
  selectedId: string
  expandedIds: Set<string>
  showActions?: boolean
  depth?: number
}>(), {
  depth: 0,
  showActions: true,
})

const emit = defineEmits<{
  select: [id: string]
  toggle: [id: string]
  edit: [id: string]
  delete: [id: string]
}>()

const children = computed(() => getFolderChildren(props.folders, props.folder.id))
const expanded = computed(() => props.expandedIds.has(props.folder.id))
const selected = computed(() => props.selectedId === props.folder.id)
</script>

<template>
  <div>
    <div
      class="group flex min-h-9 items-center gap-1 rounded-lg pr-1 transition-colors"
      :class="selected ? 'bg-accent-primary/10 text-accent-primary' : 'text-ink-700 hover:bg-ink-100/80 dark:text-ink-200 dark:hover:bg-ink-800/80'"
      :style="{ paddingLeft: `${0.35 + depth * 1.15}rem` }"
    >
      <button
        v-if="children.length"
        type="button"
        class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-400 hover:bg-white/80 dark:hover:bg-ink-700"
        :aria-label="expanded ? $t('library.folderCollapse') : $t('library.folderExpand')"
        :title="expanded ? $t('library.folderCollapse') : $t('library.folderExpand')"
        @click.stop="emit('toggle', folder.id)"
      >
        <ChevronDown v-if="expanded" class="h-3.5 w-3.5" />
        <ChevronRight v-else class="h-3.5 w-3.5" />
      </button>
      <span v-else class="h-7 w-7 shrink-0" aria-hidden="true" />
      <button type="button" class="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left text-sm font-medium" @click="emit('select', folder.id)">
        <FolderOpen v-if="expanded || selected" class="h-4 w-4 shrink-0 text-accent-primary" />
        <Folder v-else class="h-4 w-4 shrink-0 text-ink-400" />
        <span class="truncate">{{ folder.name }}</span>
      </button>
      <div v-if="showActions && folder.id !== UNCATEGORIZED_FOLDER_ID" class="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <button type="button" class="flex h-7 w-7 items-center justify-center rounded-md text-ink-400 hover:bg-white/80 hover:text-accent-primary dark:hover:bg-ink-700" :aria-label="$t('library.folderEdit')" :title="$t('library.folderEdit')" @click.stop="emit('edit', folder.id)">
          <Pencil class="h-3.5 w-3.5" />
        </button>
        <button type="button" class="flex h-7 w-7 items-center justify-center rounded-md text-ink-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/20" :aria-label="$t('library.folderDelete')" :title="$t('library.folderDelete')" @click.stop="emit('delete', folder.id)">
          <Trash2 class="h-3.5 w-3.5" />
        </button>
      </div>
    </div>

    <div v-if="expanded" class="relative">
      <FolderTreeNode
        v-for="child in children"
        :key="child.id"
        :folder="child"
        :folders="folders"
        :selected-id="selectedId"
        :expanded-ids="expandedIds"
        :show-actions="showActions"
        :depth="depth + 1"
        @select="emit('select', $event)"
        @toggle="emit('toggle', $event)"
        @edit="emit('edit', $event)"
        @delete="emit('delete', $event)"
      />
    </div>
  </div>
</template>

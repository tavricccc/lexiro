<script setup lang="ts">
import type { LibrarySetSummary, VocabFolder } from '@/types'
import { FileQuestion, Folder, LoaderCircle } from 'lucide-vue-next'
import { onMounted, onUnmounted, ref } from 'vue'
import { ALL_FOLDER_ID } from '@/lib/folders'
import FolderCard from '../FolderCard.vue'
import SetCard from '../SetCard.vue'
import EmptyState from '../ui/empty-state/EmptyState.vue'

defineProps<{
  selectedFolderId: string
  hasLibrarySets: boolean
  visibleFolders: VocabFolder[]
  visibleSets: LibrarySetSummary[]
  totalSets: number
  loading: boolean
  searching: boolean
  metrics: Map<string, { wordCount: number, dueCount: number, learnedCount: number, weakCount: number }>
  folders: VocabFolder[]
  activeSetIds: string[]
}>()

const emit = defineEmits<{
  openFolder: [folderId: string]
  editFolder: [folderId: string]
  study: [setId: string]
  move: [setId: string, folderId: string]
  delete: [setId: string]
  edit: [setId: string]
  loadMore: []
}>()
const loadMoreTarget = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

function forwardMove(setId: string, folderId: string) {
  emit('move', setId, folderId)
}

onMounted(() => {
  if (typeof IntersectionObserver === 'undefined')
    return
  observer = new IntersectionObserver((entries) => {
    if (entries.some(entry => entry.isIntersecting))
      emit('loadMore')
  }, { rootMargin: '360px 0px' })
  if (loadMoreTarget.value)
    observer.observe(loadMoreTarget.value)
})
onUnmounted(() => observer?.disconnect())
</script>

<template>
  <EmptyState v-if="selectedFolderId === ALL_FOLDER_ID && !hasLibrarySets && !visibleFolders.length && totalSets === 0 && !loading && !searching" :title="$t('library.emptyTitle')">
    <template #icon>
      <FileQuestion class="h-7 w-7" />
    </template>
  </EmptyState>
  <template v-else>
    <div v-if="!searching && visibleFolders.length" class="space-y-3">
      <h3 class="text-xs font-extrabold uppercase tracking-widest text-ink-400">
        {{ $t('library.folderSectionTitle') }} ({{ visibleFolders.length }})
      </h3>
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <FolderCard v-for="folder in visibleFolders" :key="folder.id" :folder="folder" @open="emit('openFolder', $event)" @edit="emit('editFolder', $event)" />
      </div>
    </div>
    <div v-if="visibleSets.length" class="space-y-3">
      <h3 v-if="!searching && visibleFolders.length" class="text-xs font-extrabold uppercase tracking-widest text-ink-400">
        {{ $t('library.setsSectionTitle') }} ({{ totalSets }})
      </h3>
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div v-for="set in visibleSets" :key="set.id" class="set-card-enter">
          <SetCard :set="set" :summary="set" :metrics="metrics.get(set.id)" :folders="folders" :active="activeSetIds.includes(set.id)" @study="emit('study', $event)" @move="forwardMove" @delete="emit('delete', $event)" @edit="emit('edit', $event)" />
        </div>
      </div>
    </div>
    <div v-else-if="!loading && !visibleFolders.length" class="rounded-2xl border border-dashed border-ink-200/80 py-16 text-center text-sm font-semibold text-ink-400 dark:border-ink-200/15">
      <Folder class="mx-auto mb-3 h-7 w-7" />{{ searching ? $t('home.noSearchResults') : $t('library.folderEmpty') }}
    </div>
    <div ref="loadMoreTarget" class="flex min-h-12 items-center justify-center">
      <LoaderCircle v-if="loading" class="h-5 w-5 animate-spin text-accent-primary" />
    </div>
  </template>
</template>

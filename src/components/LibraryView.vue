<script setup lang="ts">
import type { LibrarySetSummary, VocabFolder } from '@/types'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { syncAfterLocalCommit } from '@/lib/commit-sync'
import { ALL_FOLDER_ID } from '@/lib/folders'
import { isDue } from '@/lib/fsrs'
import { getLibraryRepository, LIBRARY_PAGE_SIZE } from '@/lib/library-repository'
import { useLearningStore } from '@/stores/learning'
import { useLibraryStore } from '@/stores/library'
import { useSetsStore } from '@/stores/sets'
import { useUIStore } from '@/stores/ui'
import FolderCreateDialog from './dialogs/FolderCreateDialog.vue'
import FolderManageDialog from './dialogs/FolderManageDialog.vue'
import LibraryResults from './library/LibraryResults.vue'
import LibraryToolbar from './library/LibraryToolbar.vue'

const setsStore = useSetsStore()
const libraryStore = useLibraryStore()
const uiStore = useUIStore()
const router = useRouter()
const route = useRoute()
const repository = getLibraryRepository()
const learningStore = useLearningStore()
const { requestDelete, openSetEditor } = setsStore

const query = ref('')
const folders = ref<VocabFolder[]>([])
const visibleFolders = ref<VocabFolder[]>([])
const visibleSets = ref<LibrarySetSummary[]>([])
const page = ref(0)
const hasMore = ref(false)
const totalSets = ref(0)
const loading = ref(false)
const searchLoading = ref(false)
const folderCreateOpen = ref(false)
const folderManageOpen = ref(false)
const managedFolder = ref<VocabFolder | null>(null)
let searchTimer: ReturnType<typeof setTimeout> | null = null
let requestVersion = 0
let payloadController: AbortController | null = null
let pageHydrationController: AbortController | null = null

const selectedFolderId = computed(() => {
  const value = typeof route.query.folder === 'string' ? route.query.folder : ALL_FOLDER_ID
  return value === ALL_FOLDER_ID || folders.value.some(folder => folder.id === value) ? value : ALL_FOLDER_ID
})
const currentFolder = computed(() => folders.value.find(folder => folder.id === selectedFolderId.value) ?? null)
const currentFolderPath = computed(() => {
  const byId = new Map(folders.value.map(folder => [folder.id, folder]))
  const path: VocabFolder[] = []
  let folder = currentFolder.value
  while (folder) {
    path.unshift(folder)
    folder = folder.parentId ? byId.get(folder.parentId) ?? null : null
  }
  return path
})
const isSearching = computed(() => Boolean(query.value.trim()))
const hasLibrarySets = computed(() => setsStore.sets.length > 0 || totalSets.value > 0)
const librarySetSignature = computed(() => libraryStore.sets.map(set => `${set.id}:${set.updatedAt}:${set.folderId}`).join('|'))
const activeSetIds = computed(() => visibleSets.value.filter(set => setsStore.isSetInProgress(set.id)).map(set => set.id))
const visibleSetMetrics = computed(() => {
  const metrics = new Map<string, { wordCount: number, dueCount: number, learnedCount: number, weakCount: number }>()
  for (const set of visibleSets.value) {
    let dueCount = 0
    let learnedCount = 0
    let weakCount = 0
    for (const item of libraryStore.getSetStudyWords(set.id)) {
      const card = learningStore.getCardProgress(item.id)
      if (!card)
        continue
      if (isDue(card))
        dueCount += 1
      if (card.reviewCount > 0)
        learnedCount += 1
      if (card.reviewCount >= 2 && card.correctCount / card.reviewCount < 0.6)
        weakCount += 1
    }
    metrics.set(set.id, { wordCount: set.senseCount, dueCount, learnedCount, weakCount })
  }
  return metrics
})

function openFolder(folderId: string) {
  void router.push(folderId === ALL_FOLDER_ID ? { name: 'library' } : { name: 'library', query: { folder: folderId } })
}
function goBack() {
  openFolder(currentFolder.value?.parentId ?? ALL_FOLDER_ID)
}
function hydrateAndRun(setId: string, action: () => void) {
  payloadController?.abort()
  payloadController = new AbortController()
  void libraryStore.hydrateSet(setId, payloadController.signal).then(action).catch(() => undefined)
}
function handleStudy(setId: string) {
  hydrateAndRun(setId, () => void router.push({ name: 'set-overview', params: { setId } }))
}
function handleEdit(setId: string) {
  hydrateAndRun(setId, () => openSetEditor('edit', setsStore.sets.find(set => set.id === setId)))
}
async function handleDelete(setId: string) {
  await requestDelete(setId)
  await loadCurrentPage()
}
async function moveSet(setId: string, folderId: string) {
  setsStore.moveSetToFolder(setId, folderId || undefined)
  await libraryStore.waitForPersistence()
  await syncAfterLocalCommit()
  await loadCurrentPage()
}
function openFolderManage(folderId: string) {
  managedFolder.value = folders.value.find(folder => folder.id === folderId) ?? null
  folderManageOpen.value = Boolean(managedFolder.value)
}
function closeFolderManage() {
  folderManageOpen.value = false
  managedFolder.value = null
}
function handleFolderDeleted() {
  closeFolderManage()
  selectedFolderId.value === ALL_FOLDER_ID ? void loadCurrentPage() : openFolder(ALL_FOLDER_ID)
}

async function loadCurrentPage(append = false) {
  const currentRequest = ++requestVersion
  if (!append) {
    pageHydrationController?.abort()
    page.value = 0
    visibleSets.value = []
  }
  loading.value = true
  searchLoading.value = isSearching.value
  try {
    const index = await repository.loadIndex()
    folders.value = index.folders
    const result = isSearching.value
      ? await repository.searchSets(query.value, append ? page.value : 0, LIBRARY_PAGE_SIZE)
      : await repository.listFolderPage(selectedFolderId.value, append ? page.value : 0, LIBRARY_PAGE_SIZE)
    if (currentRequest !== requestVersion)
      return
    const nextSets = 'sets' in result ? result.sets : result.items
    visibleFolders.value = 'folders' in result ? result.folders : []
    visibleSets.value = append ? [...visibleSets.value, ...nextSets] : nextSets
    page.value = result.page + 1
    hasMore.value = result.hasMore
    totalSets.value = 'totalSets' in result ? result.totalSets : result.total
    if (!isSearching.value && nextSets.length) {
      if (!pageHydrationController || pageHydrationController.signal.aborted)
        pageHydrationController = new AbortController()
      void libraryStore.hydrateSets(nextSets.map(set => set.id), pageHydrationController.signal).catch(() => undefined)
    }
  }
  finally {
    if (currentRequest === requestVersion) {
      loading.value = false
      searchLoading.value = false
      await nextTick()
    }
  }
}

function scheduleSearch() {
  if (searchTimer)
    clearTimeout(searchTimer)
  if (!query.value.trim()) {
    searchTimer = null
    void loadCurrentPage()
    return
  }
  searchTimer = setTimeout(() => void loadCurrentPage(), 150)
}
function loadMore() {
  if (!loading.value && hasMore.value)
    void loadCurrentPage(true)
}

watch(selectedFolderId, (folderId, previousFolderId) => {
  if (folderId !== previousFolderId)
    void loadCurrentPage()
})
watch(query, scheduleSearch)
watch(librarySetSignature, () => {
  if (!isSearching.value)
    void loadCurrentPage()
})
onMounted(() => void loadCurrentPage())
onUnmounted(() => {
  payloadController?.abort()
  pageHydrationController?.abort()
  if (searchTimer)
    clearTimeout(searchTimer)
})
</script>

<template>
  <section class="space-y-5 text-left">
    <LibraryToolbar v-model:query="query" :selected-folder-id="selectedFolderId" :folder-path="currentFolderPath" :total-sets="totalSets" :searching="isSearching" :search-loading="searchLoading" @back="goBack" @open-folder="openFolder" @create-folder="folderCreateOpen = true" @import="uiStore.openTransfer(selectedFolderId === ALL_FOLDER_ID ? undefined : selectedFolderId)" @add-set="router.push({ name: 'set-create' })" />
    <LibraryResults :selected-folder-id="selectedFolderId" :has-library-sets="hasLibrarySets" :visible-folders="visibleFolders" :visible-sets="visibleSets" :total-sets="totalSets" :loading="loading" :searching="isSearching" :metrics="visibleSetMetrics" :folders="libraryStore.folders" :active-set-ids="activeSetIds" @open-folder="openFolder" @edit-folder="openFolderManage" @study="handleStudy" @move="moveSet" @delete="handleDelete" @edit="handleEdit" @load-more="loadMore" />
    <FolderCreateDialog :open="folderCreateOpen" :parent-id="selectedFolderId" @close="folderCreateOpen = false" @created="openFolder" />
    <FolderManageDialog :open="folderManageOpen" :folder="managedFolder" @close="closeFolderManage" @updated="closeFolderManage(); loadCurrentPage()" @deleted="handleFolderDeleted" />
  </section>
</template>

<script setup lang="ts">
import type { LibrarySetSummary, VocabFolder } from '@/types'
import { ArrowLeft, ChevronRight, ClipboardPaste, FileQuestion, Folder, FolderPlus, LoaderCircle, Plus, Search, Upload } from 'lucide-vue-next'
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
import FolderCard from './FolderCard.vue'
import SetCard from './SetCard.vue'
import Button from './ui/button/Button.vue'
import Card from './ui/card/Card.vue'
import EmptyState from './ui/empty-state/EmptyState.vue'
import Input from './ui/input/Input.vue'

const setsStore = useSetsStore()
const libraryStore = useLibraryStore()
const uiStore = useUIStore()
const router = useRouter()
const route = useRoute()
const repository = getLibraryRepository()
const learningStore = useLearningStore()
const { isSetInProgress, requestDelete, openSetEditor } = setsStore
const { openTransfer } = uiStore

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
const loadMoreTarget = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null
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

function openAddSet() {
  void router.push({ name: 'set-create' })
}

function openBackupImport() {
  openTransfer(selectedFolderId.value === ALL_FOLDER_ID ? undefined : selectedFolderId.value)
}

function openFolder(folderId: string) {
  void router.push(folderId === ALL_FOLDER_ID ? { name: 'library' } : { name: 'library', query: { folder: folderId } })
}

function goBack() {
  if (currentFolder.value?.parentId)
    openFolder(currentFolder.value.parentId)
  else
    openFolder(ALL_FOLDER_ID)
}

function handleStudy(setId: string) {
  payloadController?.abort()
  payloadController = new AbortController()
  void libraryStore.hydrateSet(setId, payloadController.signal).then(() => router.push({ name: 'set-overview', params: { setId } })).catch(() => undefined)
}

function handleEdit(setId: string) {
  payloadController?.abort()
  payloadController = new AbortController()
  void libraryStore.hydrateSet(setId, payloadController.signal).then(() => openSetEditor('edit', setsStore.sets.find(set => set.id === setId))).catch(() => undefined)
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
  if (selectedFolderId.value === ALL_FOLDER_ID)
    void loadCurrentPage()
  else
    openFolder(ALL_FOLDER_ID)
}

function handleFolderUpdated() {
  closeFolderManage()
  void loadCurrentPage()
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
watch(loadMoreTarget, (target, previous) => {
  if (!observer)
    return
  if (previous)
    observer.unobserve(previous)
  if (target)
    observer.observe(target)
})

onMounted(() => {
  void loadCurrentPage()
  if (typeof IntersectionObserver === 'undefined')
    return
  observer = new IntersectionObserver((entries) => {
    if (entries.some(entry => entry.isIntersecting))
      loadMore()
  }, { rootMargin: '360px 0px' })
  if (loadMoreTarget.value)
    observer.observe(loadMoreTarget.value)
})

onUnmounted(() => {
  payloadController?.abort()
  pageHydrationController?.abort()
  observer?.disconnect()
  if (searchTimer)
    clearTimeout(searchTimer)
})
</script>

<template>
  <section class="space-y-6 text-left">
    <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div>
        <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink-950 dark:text-ink-50">
          {{ $t('library.title') }}
        </h1>
        <p class="mt-1 text-sm font-semibold text-ink-500">
          {{ $t('library.fileExplorerHint') }}
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button variant="outline" class="gap-2" @click="folderCreateOpen = true">
          <FolderPlus class="h-4 w-4 text-accent-primary" />
          <span>{{ $t('library.newFolder') }}</span>
        </Button>
        <Button variant="outline" class="gap-2" @click="openBackupImport">
          <Upload class="h-4 w-4" />
          <span>{{ $t('home.backupAndImport') }}</span>
        </Button>
        <Button variant="default" class="gap-2" @click="openAddSet">
          <Plus class="h-4 w-4" />
          <span>{{ $t('home.addSet') }}</span>
        </Button>
      </div>
    </div>

    <EmptyState v-if="selectedFolderId === ALL_FOLDER_ID && !hasLibrarySets && !visibleFolders.length && totalSets === 0 && !loading && !isSearching" :title="$t('home.title')">
      <template #icon>
        <FileQuestion class="h-7 w-7" />
      </template>
      <template #actions>
        <Button variant="default" size="lg" class="gap-2" @click="openAddSet">
          <Plus class="h-4 w-4" />{{ $t('home.addSet') }}
        </Button>
        <Button variant="outline" size="lg" class="gap-2" @click="openBackupImport">
          <Upload class="h-4 w-4" />{{ $t('home.backupAndImport') }}
        </Button>
      </template>
      <div class="flex items-center gap-3 rounded-2xl bg-ink-100/70 p-4 text-left dark:bg-ink-900/70">
        <ClipboardPaste class="h-5 w-5 text-ink-500" />
        <p class="text-sm font-bold text-ink-600 dark:text-ink-300">
          {{ $t('library.emptyHint') }}
        </p>
      </div>
    </EmptyState>

    <template v-else>
      <Card class="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-1.5 text-sm font-bold">
            <Button v-if="selectedFolderId !== ALL_FOLDER_ID" variant="ghost" size="sm" class="-ml-2 gap-1.5 text-ink-600 dark:text-ink-300 hover:text-accent-primary" :aria-label="$t('library.back')" @click="goBack">
              <ArrowLeft class="h-4 w-4" /><span>{{ $t('library.back') }}</span>
            </Button>
            <ChevronRight v-if="selectedFolderId !== ALL_FOLDER_ID" class="h-3.5 w-3.5 text-ink-400" />
            <button type="button" class="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors" :class="selectedFolderId === ALL_FOLDER_ID ? 'text-accent-primary font-black' : 'text-ink-600 dark:text-ink-300'" @click="openFolder(ALL_FOLDER_ID)">
              <Folder class="h-4 w-4" /><span>{{ $t('library.collection') }}</span>
            </button>

            <template v-for="(folder, idx) in currentFolderPath" :key="folder.id">
              <ChevronRight class="h-3.5 w-3.5 text-ink-400" />
              <button
                type="button"
                class="px-2 py-1 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors"
                :class="idx === currentFolderPath.length - 1 ? 'text-accent-primary font-black' : 'text-ink-600 dark:text-ink-300'"
                @click="openFolder(folder.id)"
              >
                {{ folder.name }}
              </button>
            </template>
          </div>
          <p class="mt-1 text-xs font-semibold text-ink-500">
            {{ isSearching ? $t('library.searchResultCount', { count: totalSets }) : $t('library.folderResultCount', { count: totalSets }) }}
          </p>
        </div>
        <div class="relative w-full sm:max-w-sm">
          <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <Input v-model="query" :placeholder="$t('home.searchPlaceholder')" class="rounded-xl pl-9" />
          <LoaderCircle v-if="searchLoading" class="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-accent-primary" />
        </div>
      </Card>

      <!-- Folder Section with Cards matching SetCard dimensions -->
      <div v-if="!isSearching && visibleFolders.length" class="space-y-3">
        <h3 class="text-xs font-extrabold uppercase tracking-widest text-ink-400">
          {{ $t('library.folderSectionTitle') || '資料夾' }} ({{ visibleFolders.length }})
        </h3>
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FolderCard
            v-for="folder in visibleFolders"
            :key="folder.id"
            :folder="folder"
            @open="openFolder"
            @edit="openFolderManage"
          />
        </div>
      </div>

      <!-- Sets Section -->
      <div v-if="visibleSets.length" class="space-y-3">
        <h3 v-if="!isSearching && visibleFolders.length" class="text-xs font-extrabold uppercase tracking-widest text-ink-400">
          {{ $t('library.setsSectionTitle') || '單字集' }} ({{ totalSets }})
        </h3>
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div
            v-for="(set, index) in visibleSets"
            :key="set.id"
            class="set-card-enter"
            :style="{ animationDelay: `${Math.min(index, 10) * 40}ms` }"
          >
            <SetCard
              :set="set"
              :summary="set"
              :metrics="visibleSetMetrics.get(set.id)"
              :folders="libraryStore.folders"
              :active="isSetInProgress(set.id)"
              @study="handleStudy"
              @move="moveSet"
              @delete="handleDelete"
              @edit="handleEdit"
            />
          </div>
        </div>
      </div>

      <div v-else-if="!loading && !visibleFolders.length" class="rounded-2xl border border-dashed border-ink-200/80 py-16 text-center text-sm font-semibold text-ink-400 dark:border-ink-200/15">
        <Folder class="mx-auto mb-3 h-7 w-7" />{{ isSearching ? $t('home.noSearchResults') : $t('library.folderEmpty') }}
      </div>

      <div ref="loadMoreTarget" class="flex min-h-12 items-center justify-center">
        <LoaderCircle v-if="loading" class="h-5 w-5 animate-spin text-accent-primary" />
      </div>
    </template>

    <FolderCreateDialog :open="folderCreateOpen" :parent-id="selectedFolderId" @close="folderCreateOpen = false" @created="openFolder" />
    <FolderManageDialog :open="folderManageOpen" :folder="managedFolder" @close="closeFolderManage" @updated="handleFolderUpdated" @deleted="handleFolderDeleted" />
  </section>
</template>

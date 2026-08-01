<script setup lang="ts">
import { ClipboardPaste, FileQuestion, FolderOpen, Plus, Search, Upload } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ALL_FOLDER_ID, UNCATEGORIZED_FOLDER_ID } from '@/lib/folders'
import { useLibraryStore } from '@/stores/library'
import { useSetsStore } from '@/stores/sets'
import { useUIStore } from '@/stores/ui'
import FolderTree from './FolderTree.vue'
import SetCard from './SetCard.vue'
import Button from './ui/button/Button.vue'
import Card from './ui/card/Card.vue'
import EmptyState from './ui/empty-state/EmptyState.vue'
import Input from './ui/input/Input.vue'

const setsStore = useSetsStore()
const libraryStore = useLibraryStore()
const uiStore = useUIStore()
const router = useRouter()
const { hasSets, sets } = storeToRefs(setsStore)
const { isSetInProgress, requestDelete, openSetEditor, openImport } = setsStore
const { openTransfer } = uiStore

const query = ref('')
const selectedFolderId = ref(ALL_FOLDER_ID)
const newFolderName = ref('')

const filteredSets = computed(() => {
  const q = query.value.trim().toLowerCase()
  return sets.value.filter((set) => {
    const inFolder = selectedFolderId.value === ALL_FOLDER_ID
      || (selectedFolderId.value === UNCATEGORIZED_FOLDER_ID ? !set.folderId : set.folderId === selectedFolderId.value)
    return inFolder && (!q || set.setName.toLowerCase().includes(q) || set.items.some(item => [item.word, item.meaning, item.definition ?? '', ...(item.tags ?? [])].some(value => value.toLowerCase().includes(q))))
  })
})

function createFolder() {
  const name = newFolderName.value.trim()
  if (!name)
    return
  const parentId = selectedFolderId.value === ALL_FOLDER_ID || selectedFolderId.value === UNCATEGORIZED_FOLDER_ID ? undefined : selectedFolderId.value
  const folder = libraryStore.addFolder(name, parentId)
  selectedFolderId.value = folder.id
  newFolderName.value = ''
}

function openAddSet() {
  openImport(selectedFolderId.value === ALL_FOLDER_ID ? undefined : selectedFolderId.value)
}

function openBackupImport() {
  openTransfer(selectedFolderId.value === ALL_FOLDER_ID ? undefined : selectedFolderId.value)
}

function handleStudy(setId: string) {
  void router.push({ name: 'set-study', params: { setId } })
}

function moveSet(setId: string, folderId: string) {
  setsStore.moveSetToFolder(setId, folderId || undefined)
}
</script>

<template>
  <section class="space-y-6 text-left">
    <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">
          {{ $t('library.title') }}
        </h1>
      </div>
      <div class="flex gap-2">
        <Button variant="outline" class="gap-2" @click="openBackupImport">
          <Upload class="h-4 w-4" />{{ $t('home.backupAndImport') }}
        </Button><Button variant="default" class="gap-2" @click="openAddSet">
          <Plus class="h-4 w-4" />{{ $t('home.addSet') }}
        </Button>
      </div>
    </div>

    <EmptyState v-if="!hasSets" :title="$t('home.title')">
      <template #icon>
        <FileQuestion class="h-7 w-7" />
      </template>
      <template #actions>
        <Button variant="default" size="lg" class="gap-2" @click="openAddSet">
          <Plus class="h-4 w-4" />{{ $t('home.addSet') }}
        </Button><Button variant="outline" size="lg" class="gap-2" @click="openBackupImport">
          <Upload class="h-4 w-4" />{{ $t('home.backupAndImport') }}
        </Button>
      </template>
      <div class="flex items-center gap-3 rounded-2xl bg-ink-100/70 p-4 text-left dark:bg-ink-900/70">
        <ClipboardPaste class="h-5 w-5 text-ink-500" /><p class="text-sm font-bold text-ink-600 dark:text-ink-300">
          {{ $t('library.emptyHint') }}
        </p>
      </div>
    </EmptyState>

    <template v-else>
      <Card class="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-sm font-black">
            {{ $t('library.collection') }}
          </p><p class="mt-1 text-xs font-semibold text-ink-500">
            {{ sets.length }} {{ $t('library.setUnit') }} · {{ sets.reduce((sum, set) => sum + set.items.length, 0) }} {{ $t('home.wordUnit') }}
          </p>
        </div>
        <div class="relative w-full sm:max-w-sm">
          <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" /><Input v-model="query" :placeholder="$t('home.searchPlaceholder')" class="rounded-xl pl-9" />
        </div>
      </Card>

      <Card class="space-y-3 p-3 sm:p-4">
        <div class="flex items-start gap-2">
          <FolderOpen class="mt-0.5 h-4 w-4 shrink-0 text-ink-500" />
          <div>
            <p class="text-sm font-semibold text-ink-800 dark:text-ink-100">
              {{ $t('library.folderTitle') }}
            </p>
            <p class="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
              {{ $t('library.folderDescription') }}
            </p>
          </div>
        </div>
        <FolderTree
          v-model="selectedFolderId"
          :folders="libraryStore.folders"
          :include-all="true"
          :all-label="$t('library.allFolders')"
          :root-label="$t('library.rootFolder')"
        />
        <form class="flex flex-col gap-2 sm:flex-row sm:items-center" @submit.prevent="createFolder">
          <Input v-model="newFolderName" :placeholder="$t('library.newFolderPlaceholder')" class="min-w-0 flex-1 rounded-xl" />
          <Button type="submit" size="sm" variant="outline">
            {{ $t('library.newFolder') }}
          </Button>
        </form>
      </Card>

      <div v-if="filteredSets.length" class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div v-for="(set, i) in filteredSets" :key="set.id" class="set-card-enter" :style="{ animationDelay: `${Math.min(i, 10) * 40}ms` }">
          <SetCard
            :set="set"
            :folders="libraryStore.folders"
            :active="isSetInProgress(set.id)"
            @study="handleStudy"
            @move="moveSet"
            @delete="requestDelete"
            @edit="openSetEditor('edit', sets.find(item => item.id === $event))"
          />
        </div>
      </div>
      <div v-else class="py-16 text-center text-sm font-semibold text-ink-400">
        {{ $t('home.noSearchResults') }}
      </div>
    </template>
  </section>
</template>

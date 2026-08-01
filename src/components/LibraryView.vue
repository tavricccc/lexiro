<script setup lang="ts">
import { ClipboardPaste, FileQuestion, Plus, Search, Upload } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ALL_FOLDER_ID, buildFolderOptions, UNCATEGORIZED_FOLDER_ID } from '@/lib/folders'
import { useLibraryStore } from '@/stores/library'
import { useSetsStore } from '@/stores/sets'
import { useUIStore } from '@/stores/ui'
import SetCard from './SetCard.vue'
import Button from './ui/button/Button.vue'
import Card from './ui/card/Card.vue'
import EmptyState from './ui/empty-state/EmptyState.vue'
import Input from './ui/input/Input.vue'

const setsStore = useSetsStore()
const libraryStore = useLibraryStore()
const uiStore = useUIStore()
const router = useRouter()
const { t } = useI18n()
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

const folderOptions = computed(() => buildFolderOptions(libraryStore.folders, t('library.rootFolder')))

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

      <Card class="p-3 sm:p-4">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            <button type="button" class="rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-500 transition hover:bg-ink-100 hover:text-ink-900 dark:hover:bg-ink-800 dark:hover:text-ink-50" :class="selectedFolderId === ALL_FOLDER_ID ? 'bg-ink-100 text-ink-900 dark:bg-ink-800 dark:text-ink-50' : ''" @click="selectedFolderId = ALL_FOLDER_ID">
              {{ $t('library.allFolders') }}
            </button>
            <button v-for="folder in folderOptions" :key="folder.id" type="button" class="min-w-0 rounded-lg py-1.5 pr-2.5 text-left text-xs font-medium text-ink-500 transition hover:bg-ink-100 hover:text-ink-900 dark:hover:bg-ink-800 dark:hover:text-ink-50" :class="selectedFolderId === folder.id ? 'bg-ink-100 text-ink-900 dark:bg-ink-800 dark:text-ink-50' : ''" :style="{ paddingLeft: `${0.625 + folder.depth * 0.75}rem` }" @click="selectedFolderId = folder.id">
              {{ folder.label }}
            </button>
          </div>
          <form class="flex gap-2" @submit.prevent="createFolder">
            <Input v-model="newFolderName" :placeholder="$t('library.newFolderPlaceholder')" class="h-9 w-36 rounded-xl" />
            <Button type="submit" size="sm" variant="outline">
              {{ $t('library.newFolder') }}
            </Button>
          </form>
        </div>
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

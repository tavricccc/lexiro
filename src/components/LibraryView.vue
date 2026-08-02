<script setup lang="ts">
import type { VocabFolder } from '@/types'
import { ClipboardPaste, FileQuestion, FolderOpen, Plus, Search, Upload } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ALL_FOLDER_ID } from '@/lib/folders'
import { useLibraryStore } from '@/stores/library'
import { useSetsStore } from '@/stores/sets'
import { useUIStore } from '@/stores/ui'
import FolderCreateDialog from './dialogs/FolderCreateDialog.vue'
import FolderManageDialog from './dialogs/FolderManageDialog.vue'
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
const { hasSets, sets, totalWordCount } = storeToRefs(setsStore)
const { isSetInProgress, requestDelete, openSetEditor } = setsStore
const { openTransfer } = uiStore

const query = ref('')
const selectedFolderId = ref(ALL_FOLDER_ID)
const folderCreateOpen = ref(false)
const folderManageOpen = ref(false)
const managedFolder = ref<VocabFolder | null>(null)

const filteredSets = computed(() => {
  const q = query.value.trim().toLowerCase()
  return sets.value.filter((set) => {
    const inFolder = selectedFolderId.value === ALL_FOLDER_ID
      || set.folderId === selectedFolderId.value
    const words = libraryStore.getSetWords(set.id)
    return inFolder && (!q || set.setName.toLowerCase().includes(q) || words.some(word => word.word.toLowerCase().includes(q) || word.senses.some(sense => sense.meaningZh.toLowerCase().includes(q))))
  })
})

function openAddSet() {
  void router.push({ name: 'set-create' })
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

function openFolderManage(folderId: string) {
  managedFolder.value = libraryStore.folders.find(folder => folder.id === folderId) ?? null
  folderManageOpen.value = Boolean(managedFolder.value)
}

function closeFolderManage() {
  folderManageOpen.value = false
  managedFolder.value = null
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
      <div class="grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside class="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <div class="flex items-center justify-between gap-3 px-1">
            <div class="flex items-center gap-2">
              <FolderOpen class="h-4 w-4 text-ink-500" />
              <p class="text-sm font-semibold text-ink-800 dark:text-ink-100">
                {{ $t('library.folderTitle') }}
              </p>
            </div>
            <Button variant="ghost" size="icon" class="h-8 w-8" :aria-label="$t('library.newFolder')" @click="folderCreateOpen = true">
              <Plus class="h-4 w-4" />
            </Button>
          </div>
          <p class="mt-1 px-1 text-xs text-ink-500 dark:text-ink-400">
            {{ $t('library.folderDescription') }}
          </p>
          <div class="mt-3 rounded-2xl border border-ink-200/70 bg-white/70 p-2 dark:border-ink-200/15 dark:bg-ink-900/40">
            <FolderTree
              v-model="selectedFolderId"
              :folders="libraryStore.folders"
              :include-all="true"
              :all-label="$t('library.allFolders')"
              :root-label="$t('library.rootFolder')"
              @edit="openFolderManage"
              @delete="openFolderManage"
            />
          </div>
          <Button variant="outline" class="mt-3 w-full justify-center gap-2" @click="folderCreateOpen = true">
            <Plus class="h-4 w-4" />{{ $t('library.newFolder') }}
          </Button>
        </aside>

        <div class="min-w-0">
          <Card class="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p class="text-sm font-black">
                {{ $t('library.collection') }}
              </p><p class="mt-1 text-xs font-semibold text-ink-500">
                {{ sets.length }} {{ $t('library.setUnit') }} · {{ totalWordCount }} {{ $t('home.wordUnit') }}
              </p>
            </div>
            <div class="relative w-full sm:max-w-sm">
              <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" /><Input v-model="query" :placeholder="$t('home.searchPlaceholder')" class="rounded-xl pl-9" />
            </div>
          </Card>

          <div v-if="filteredSets.length" class="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
        </div>
      </div>
      <FolderCreateDialog :open="folderCreateOpen" :parent-id="selectedFolderId" @close="folderCreateOpen = false" @created="selectedFolderId = $event" />
      <FolderManageDialog :open="folderManageOpen" :folder="managedFolder" @close="closeFolderManage" @deleted="selectedFolderId = ALL_FOLDER_ID" />
    </template>
  </section>
</template>

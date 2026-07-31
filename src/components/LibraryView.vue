<script setup lang="ts">
import type { VocabSet } from '@/types'
import { ClipboardPaste, FileQuestion, Plus, Search, Upload } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useLibraryStore } from '@/stores/library'
import { useSetsStore } from '@/stores/sets'
import { useUIStore } from '@/stores/ui'
import SetStudyModal from './dialogs/SetStudyModal.vue'
import QuestionGenerationPanel from './QuestionGenerationPanel.vue'
import SetCard from './SetCard.vue'
import Button from './ui/button/Button.vue'
import Card from './ui/card/Card.vue'
import EmptyState from './ui/empty-state/EmptyState.vue'
import Input from './ui/input/Input.vue'

const setsStore = useSetsStore()
const libraryStore = useLibraryStore()
const uiStore = useUIStore()
const { hasSets, sets } = storeToRefs(setsStore)
const { isSetInProgress, requestDelete, openSetEditor, openImport } = setsStore
const { openTransfer } = uiStore

const query = ref('')
const selectedFolderId = ref<string | null>(null)
const newFolderName = ref('')
const studyModalOpen = ref(false)
const studyModalSet = ref<VocabSet | null>(null)

const filteredSets = computed(() => {
  const q = query.value.trim().toLowerCase()
  return sets.value.filter(set => (!selectedFolderId.value || set.folderId === selectedFolderId.value) && (!q || set.setName.toLowerCase().includes(q) || set.items.some(item => [item.word, item.meaning, item.definition ?? '', ...(item.tags ?? [])].some(value => value.toLowerCase().includes(q)))))
})

const sortedFolders = computed(() => [...libraryStore.folders].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)))

function createFolder() {
  const name = newFolderName.value.trim()
  if (!name)
    return
  const folder = libraryStore.addFolder(name, selectedFolderId.value ?? undefined)
  selectedFolderId.value = folder.id
  newFolderName.value = ''
}

function handleStudy(setId: string) {
  const found = sets.value.find(s => s.id === setId)
  if (found) {
    studyModalSet.value = found
    studyModalOpen.value = true
  }
}
</script>

<template>
  <section class="space-y-6 text-left">
    <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <h1 class="text-3xl font-black tracking-tight">
          {{ $t('library.title') }}
        </h1>
      </div>
      <div class="flex gap-2">
        <Button variant="outline" class="gap-2" @click="openTransfer">
          <Upload class="h-4 w-4" />{{ $t('home.backupAndImport') }}
        </Button><Button variant="default" class="gap-2" @click="openImport">
          <Plus class="h-4 w-4" />{{ $t('home.addSet') }}
        </Button>
      </div>
    </div>

    <EmptyState v-if="!hasSets" :title="$t('home.title')">
      <template #icon>
        <FileQuestion class="h-7 w-7" />
      </template>
      <template #actions>
        <Button variant="default" size="lg" class="gap-2" @click="openImport">
          <Plus class="h-4 w-4" />{{ $t('home.addSet') }}
        </Button><Button variant="outline" size="lg" class="gap-2" @click="openTransfer">
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

      <Card class="p-4">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex flex-wrap items-center gap-2">
            <Button size="sm" :variant="selectedFolderId === null ? 'default' : 'outline'" @click="selectedFolderId = null">
              {{ $t('library.allFolders') }}
            </Button>
            <Button v-for="folder in sortedFolders" :key="folder.id" size="sm" :variant="selectedFolderId === folder.id ? 'default' : 'outline'" @click="selectedFolderId = folder.id">
              {{ folder.name }}
            </Button>
          </div>
          <form class="flex gap-2" @submit.prevent="createFolder">
            <Input v-model="newFolderName" :placeholder="$t('library.newFolderPlaceholder')" class="h-9 w-44 rounded-xl" />
            <Button type="submit" size="sm" variant="outline">
              {{ $t('library.newFolder') }}
            </Button>
          </form>
        </div>
      </Card>

      <QuestionGenerationPanel />

      <div v-if="filteredSets.length" class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div v-for="(set, i) in filteredSets" :key="set.id" class="set-card-enter" :style="{ animationDelay: `${Math.min(i, 10) * 40}ms` }">
          <SetCard
            :set="set"
            :active="isSetInProgress(set.id)"
            @study="handleStudy"
            @delete="requestDelete"
            @edit="openSetEditor('edit', sets.find(item => item.id === $event))"
          />
        </div>
      </div>
      <div v-else class="py-16 text-center text-sm font-semibold text-ink-400">
        {{ $t('home.noSearchResults') }}
      </div>
    </template>

    <SetStudyModal
      :open="studyModalOpen"
      :set="studyModalSet"
      @close="studyModalOpen = false"
    />
  </section>
</template>

<script setup lang="ts">
import type { VocabFolder } from '@/types'
import { ArrowLeft, ChevronRight, FolderPlus, LoaderCircle, Plus, Search, Upload } from 'lucide-vue-next'
import { ALL_FOLDER_ID } from '@/lib/folders'
import Button from '../ui/button/Button.vue'
import Input from '../ui/input/Input.vue'

defineProps<{
  selectedFolderId: string
  folderPath: VocabFolder[]
  totalSets: number
  searching: boolean
  searchLoading: boolean
}>()

const emit = defineEmits<{
  back: []
  openFolder: [folderId: string]
  createFolder: []
  import: []
  addSet: []
}>()
const query = defineModel<string>('query', { required: true })
</script>

<template>
  <div class="flex flex-col gap-3 border-b border-ink-200/70 pb-4 dark:border-ink-200/15 sm:gap-4 sm:pb-5 lg:flex-row lg:items-center lg:justify-between">
    <div class="min-w-0">
      <h1 class="text-2xl font-extrabold tracking-tight text-ink-950 dark:text-ink-50">
        {{ $t('library.title') }}
      </h1>
      <div class="mt-1 min-w-0">
        <div v-if="selectedFolderId !== ALL_FOLDER_ID" class="flex min-w-0 flex-wrap items-center gap-1.5 text-sm font-bold">
          <Button variant="ghost" size="sm" class="-ml-2 gap-1.5 text-ink-600 hover:text-accent-primary dark:text-ink-300" :aria-label="$t('library.back')" @click="emit('back')">
            <ArrowLeft class="h-4 w-4" /><span>{{ $t('library.back') }}</span>
          </Button>
          <template v-for="(folder, index) in folderPath" :key="folder.id">
            <ChevronRight class="h-3.5 w-3.5 text-ink-400" />
            <button type="button" class="rounded-lg px-2 py-1 transition-colors hover:bg-ink-100 dark:hover:bg-ink-800" :class="index === folderPath.length - 1 ? 'font-black text-accent-primary' : 'text-ink-600 dark:text-ink-300'" @click="emit('openFolder', folder.id)">
              {{ folder.name }}
            </button>
          </template>
        </div>
        <p class="mt-1 text-xs font-semibold text-ink-500 dark:text-ink-400">
          {{ searching ? $t('library.searchResultCount', { count: totalSets }) : $t('library.folderResultCount', { count: totalSets }) }}
        </p>
      </div>
    </div>

    <div class="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
      <div class="relative min-w-0 w-full sm:w-72 lg:w-80">
        <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <Input v-model="query" :placeholder="$t('home.searchPlaceholder')" class="rounded-xl pl-9" />
        <LoaderCircle v-if="searchLoading" class="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-accent-primary" />
      </div>
      <div class="flex shrink-0 items-center gap-1 self-end rounded-2xl bg-ink-100/70 p-1 dark:bg-ink-900/70 sm:self-auto" role="toolbar" :aria-label="$t('library.actions')">
        <Button variant="ghost" size="icon" class="h-10 w-10" :aria-label="$t('library.newFolder')" @click="emit('createFolder')">
          <FolderPlus class="h-4.5 w-4.5 text-accent-primary" />
        </Button>
        <Button variant="ghost" size="icon" class="h-10 w-10" :aria-label="$t('home.backupAndImport')" @click="emit('import')">
          <Upload class="h-4.5 w-4.5" />
        </Button>
        <Button variant="default" size="icon" class="h-10 w-10" :aria-label="$t('home.addSet')" @click="emit('addSet')">
          <Plus class="h-4.5 w-4.5" />
        </Button>
      </div>
    </div>
  </div>
</template>

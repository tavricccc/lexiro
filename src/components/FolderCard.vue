<script setup lang="ts">
import type { VocabFolder } from '@/types'
import { FolderOpen, Pencil } from 'lucide-vue-next'
import Button from './ui/button/Button.vue'
import Card from './ui/card/Card.vue'

defineProps<{
  folder: VocabFolder
}>()

const emit = defineEmits<{
  open: [folderId: string]
  edit: [folderId: string]
}>()
</script>

<template>
  <Card
    role="button"
    tabindex="0"
    :aria-label="$t('library.openFolder', { folder: folder.name })"
    class="group relative cursor-pointer overflow-visible p-4 text-left transition-[border-color] duration-200 sm:p-5"
    @click="emit('open', folder.id)"
    @keydown.enter="emit('open', folder.id)"
    @keydown.space.prevent="emit('open', folder.id)"
  >
    <div class="flex items-start justify-between gap-4">
      <div class="flex items-center gap-3.5 min-w-0">
        <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-accent-primary/15 bg-accent-primary/10 text-accent-primary transition-colors duration-200">
          <FolderOpen class="h-6 w-6" />
        </span>
        <div class="min-w-0">
          <h4 class="truncate text-base font-extrabold tracking-tight text-ink-950 dark:text-ink-50 group-hover:text-accent-primary transition-colors">
            {{ folder.name }}
          </h4>
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon"
        class="shrink-0 text-ink-500 hover:text-accent-primary"
        :aria-label="$t('library.folderEdit')"
        @click.stop="emit('edit', folder.id)"
      >
        <Pencil class="h-4 w-4" />
      </Button>
    </div>
  </Card>
</template>

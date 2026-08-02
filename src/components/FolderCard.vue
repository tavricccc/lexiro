<script setup lang="ts">
import type { VocabFolder } from '@/types'
import { FolderOpen } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import Button from './ui/button/Button.vue'
import Card from './ui/card/Card.vue'

defineProps<{
  folder: VocabFolder
}>()

const emit = defineEmits<{
  open: [folderId: string]
  edit: [folderId: string]
}>()

const { t } = useI18n()
</script>

<template>
  <Card
    class="group relative overflow-visible p-5 sm:p-6 text-left transition-all duration-250 hover:-translate-y-1 hover:shadow-floating cursor-pointer"
    @click="emit('open', folder.id)"
  >
    <div class="flex items-start justify-between gap-4">
      <div class="flex items-center gap-3.5 min-w-0">
        <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-primary/10 text-accent-primary border border-accent-primary/15 transition-transform duration-300 group-hover:scale-105">
          <FolderOpen class="h-6 w-6" />
        </span>
        <div class="min-w-0 space-y-0.5">
          <h4 class="truncate text-base font-extrabold tracking-tight text-ink-950 dark:text-ink-50 group-hover:text-accent-primary transition-colors">
            {{ folder.name }}
          </h4>
          <p class="text-xs font-semibold text-ink-500 dark:text-ink-400">
            {{ t('library.clickToExplore') }}
          </p>
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        class="h-9 px-2.5 text-xs text-ink-500 hover:text-accent-primary shrink-0"
        @click.stop="emit('edit', folder.id)"
      >
        {{ t('library.folderEdit') }}
      </Button>
    </div>
  </Card>
</template>

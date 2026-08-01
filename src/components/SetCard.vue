<script setup lang="ts">
import type { VocabFolder, VocabItem } from '@/types'
import { onClickOutside } from '@vueuse/core'
import { ArrowRight, Ellipsis, Flame, Folder, FolderOpen, PencilLine, Trash2 } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { buildFolderOptions, UNCATEGORIZED_FOLDER_ID } from '@/lib/folders'
import { useLearningStore } from '@/stores/learning'
import Badge from './ui/badge/Badge.vue'
import Button from './ui/button/Button.vue'
import Card from './ui/card/Card.vue'
import MetricPill from './ui/metric-pill/MetricPill.vue'

const props = defineProps<{
  set: { id: string, setName: string, difficulty: number, items: VocabItem[], folderId?: string }
  active?: boolean
  folders?: VocabFolder[]
}>()

const emit = defineEmits<{
  study: [setId: string]
  delete: [setId: string]
  edit: [setId: string]
  move: [setId: string, folderId: string]
}>()

const { t } = useI18n()
const learningStore = useLearningStore()
const menuOpen = ref(false)
const menuRef = ref<HTMLElement | null>(null)

onClickOutside(menuRef, () => {
  menuOpen.value = false
})

const dueCount = computed(() => learningStore.getDueCount(props.set))
const learnedCount = computed(() => learningStore.getLearnedCount(props.set))
const favoriteCount = computed(() => props.set.items.filter(item => item.favorite).length)
const weakCount = computed(() => props.set.items.filter((item) => {
  const card = learningStore.peekSetProgress(props.set.id)?.cards[item.id]
  return Boolean(card && card.reviewCount >= 2 && card.correctCount / card.reviewCount < 0.6)
}).length)
const folderOptions = computed(() => buildFolderOptions(props.folders ?? [], t('study.folderNone')).filter(folder => folder.id !== UNCATEGORIZED_FOLDER_ID))

function editSet() {
  menuOpen.value = false
  emit('edit', props.set.id)
}

function deleteSet() {
  menuOpen.value = false
  emit('delete', props.set.id)
}

function moveSet(folderId = '') {
  menuOpen.value = false
  emit('move', props.set.id, folderId)
}
</script>

<template>
  <Card
    class="relative overflow-visible p-5 text-left sm:p-6"
    :class="active ? 'ring-2 ring-accent-primary/25 border-accent-primary/30' : ''"
  >
    <div class="flex items-start justify-between gap-4">
      <div class="space-y-1 text-left min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <h3 class="truncate text-base font-semibold tracking-tight text-ink-950 dark:text-ink-50">
            {{ set.setName }}
          </h3>
          <Badge
            v-if="active"
            variant="default"
            class="rounded-lg px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider"
          >
            {{ $t('home.inProgress') }}
          </Badge>
          <Badge
            v-if="dueCount > 0"
            variant="secondary"
            class="rounded-lg px-2 py-0.5 text-[10px] font-extrabold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
          >
            <Flame class="mr-1 inline h-3 w-3" />
            {{ dueCount }} {{ $t('learning.due') }}
          </Badge>
        </div>
        <p class="text-xs font-semibold text-ink-500 dark:text-ink-400">
          {{ $t('home.wordsCount', { count: set.items.length }) }}
        </p>
      </div>

      <div ref="menuRef" class="relative z-30 shrink-0" @click.stop>
        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8"
          :aria-label="t('setCard.actions')"
          aria-haspopup="menu"
          :aria-expanded="menuOpen"
          @click="menuOpen = !menuOpen"
        >
          <Ellipsis class="h-4 w-4" />
        </Button>

        <div
          v-if="menuOpen"
          class="absolute right-0 top-full z-50 mt-2 max-h-72 w-64 overflow-y-auto rounded-2xl border border-ink-200/80 bg-white/95 p-1.5 text-left shadow-floating backdrop-blur-xl dark:border-ink-700/80 dark:bg-ink-950/95"
          role="menu"
        >
          <button type="button" class="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold text-ink-800 transition-colors hover:bg-ink-100/80 dark:text-ink-200 dark:hover:bg-ink-800/80" role="menuitem" @click="editSet">
            <PencilLine class="h-4 w-4 text-ink-500" />
            {{ t('setCard.edit') }}
          </button>

          <div class="my-1 border-t border-ink-200/70 dark:border-ink-700/70" />
          <p class="px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-ink-400 dark:text-ink-500">
            {{ t('setCard.moveFolder') }}
          </p>
          <button type="button" class="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-medium transition-colors hover:bg-ink-100/80 disabled:cursor-default disabled:opacity-60 dark:hover:bg-ink-800/80" :class="!set.folderId ? 'text-accent-primary' : 'text-ink-700 dark:text-ink-300'" role="menuitem" :disabled="!set.folderId" @click="moveSet()">
            <Folder class="h-4 w-4" />
            {{ $t('study.folderNone') }}
          </button>
          <button v-for="folder in folderOptions" :key="folder.id" type="button" class="flex w-full items-center gap-2 rounded-xl py-2.5 pr-3 text-xs font-medium transition-colors hover:bg-ink-100/80 disabled:cursor-default disabled:opacity-60 dark:hover:bg-ink-800/80" :class="set.folderId === folder.id ? 'text-accent-primary' : 'text-ink-700 dark:text-ink-300'" :style="{ paddingLeft: `${0.75 + folder.depth * 0.75}rem` }" role="menuitem" :disabled="set.folderId === folder.id" @click="moveSet(folder.id)">
            <FolderOpen v-if="set.folderId === folder.id" class="h-4 w-4" />
            <Folder v-else class="h-4 w-4" />
            <span class="truncate">{{ folder.name }}</span>
          </button>

          <div class="my-1 border-t border-ink-200/70 dark:border-ink-700/70" />
          <button type="button" class="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20" role="menuitem" @click="deleteSet">
            <Trash2 class="h-4 w-4" />
            {{ t('setCard.delete') }}
          </button>
        </div>
      </div>
    </div>

    <div class="mt-4 flex flex-wrap gap-2">
      <MetricPill :label="$t('setCard.difficulty')" :value="set.difficulty" />
      <MetricPill v-if="learnedCount" :label="$t('learning.learned')" :value="`${learnedCount}/${set.items.length}`" />
      <MetricPill v-if="favoriteCount" :label="$t('learning.favorites')" :value="favoriteCount" />
      <MetricPill v-if="weakCount" :label="$t('learning.weak')" :value="weakCount" />
    </div>

    <div class="mt-5">
      <Button
        variant="default"
        class="w-full justify-center gap-2 font-black"
        @click.stop="$emit('study', set.id)"
      >
        <span>{{ $t('setCard.enter') }}</span>
        <ArrowRight class="h-4 w-4" />
      </Button>
    </div>
  </Card>
</template>

<script setup lang="ts">
import type { PracticeMode } from '@/types'
import { ClipboardPaste, FileQuestion, Plus, Search, Sparkles, Upload } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useSetsStore } from '@/stores/sets'
import { useUIStore } from '@/stores/ui'
import HomeOverview from './HomeOverview.vue'
import SetCard from './SetCard.vue'
import Button from './ui/button/Button.vue'
import EmptyState from './ui/empty-state/EmptyState.vue'
import Input from './ui/input/Input.vue'

const setsStore = useSetsStore()
const sessionStore = useSessionStore()
const uiStore = useUIStore()
const { hasSets, sets } = storeToRefs(setsStore)
const { isSetInProgress, requestDelete, openSetEditor, openImport } = setsStore
const { startFlashcards } = sessionStore
const { openTransfer } = uiStore

const query = ref('')

const filteredSets = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q)
    return sets.value
  return sets.value.filter(set => set.setName.toLowerCase().includes(q)
    || set.items.some(item => [item.word, item.meaning, ...(item.tags ?? [])].some(value => value.toLowerCase().includes(q))))
})

function startPractice(mode: PracticeMode, setId: string) {
  if (sessionStore.getInProgressModes(setId).includes(mode)) {
    sessionStore.startRound(mode, setId)
    return
  }
  sessionStore.openPracticeDialog(mode, setId)
}
</script>

<template>
  <section class="space-y-6">
    <div v-if="!hasSets" class="py-8">
      <EmptyState :title="$t('home.title')" :description="$t('home.description')">
        <template #icon>
          <FileQuestion class="h-7 w-7" />
        </template>
        <template #actions>
          <Button variant="default" size="lg" class="w-full gap-2 sm:w-auto" @click="openImport">
            <Plus class="h-4 w-4" />
            <span>{{ $t('home.addSet') }}</span>
          </Button>
          <Button variant="outline" size="lg" class="w-full gap-2 sm:w-auto" @click="openTransfer">
            <Upload class="h-4 w-4 text-accent-primary" />
            <span>{{ $t('home.backupAndImport') }}</span>
          </Button>
        </template>
        <div class="grid gap-2 rounded-2xl border border-ink-200/60 bg-white/70 p-3 dark:border-ink-200/15 dark:bg-ink-900/70">
          <div class="flex items-center gap-3 rounded-xl p-2">
            <Plus class="h-4 w-4 shrink-0 text-accent-primary" />
            <p class="text-xs font-semibold text-ink-600 dark:text-ink-400">
              {{ $t('home.emptyStepWords') }}
            </p>
          </div>
          <div class="flex items-center gap-3 rounded-xl p-2">
            <Sparkles class="h-4 w-4 shrink-0 text-accent-primary" />
            <p class="text-xs font-semibold text-ink-600 dark:text-ink-400">
              {{ $t('home.emptyStepAi') }}
            </p>
          </div>
          <div class="flex items-center gap-3 rounded-xl p-2">
            <ClipboardPaste class="h-4 w-4 shrink-0 text-accent-primary" />
            <p class="text-xs font-semibold text-ink-600 dark:text-ink-400">
              {{ $t('home.emptyStepPaste') }}
            </p>
          </div>
        </div>
      </EmptyState>
    </div>

    <template v-else>
      <HomeOverview />

      <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div class="text-left space-y-1">
          <p class="text-xs font-extrabold uppercase tracking-widest text-ink-400 dark:text-ink-500">
            {{ $t('home.library') }}
          </p>
          <h2 class="text-xl sm:text-2xl font-extrabold tracking-tight text-ink-950 dark:text-ink-50">
            {{ $t('home.readyTitle') }}
          </h2>
        </div>
        <div class="relative w-full sm:max-w-xs">
          <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <Input
            v-model="query"
            :placeholder="$t('home.searchPlaceholder')"
            class="pl-9 rounded-xl"
          />
        </div>
      </div>

      <div v-if="filteredSets.length === 0" class="py-12 text-center text-sm font-semibold text-ink-400">
        {{ $t('home.noSearchResults') }}
      </div>

      <div v-else class="grid gap-4 md:grid-cols-2">
        <div
          v-for="(set, i) in filteredSets"
          :key="set.id"
          class="set-card-enter"
          :style="{ animationDelay: `${Math.min(i, 10) * 40}ms` }"
        >
          <SetCard
            :set="set"
            :active="isSetInProgress(set.id)"
            @flashcards="startFlashcards"
            @quiz="startPractice('quiz', $event)"
            @spelling="startPractice('spelling', $event)"
            @delete="requestDelete"
            @edit="openSetEditor('edit', sets.find((item) => item.id === $event))"
          />
        </div>
      </div>
    </template>
  </section>
</template>

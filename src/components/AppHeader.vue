<script setup lang="ts">
import { ArrowLeft, Moon, PencilLine, Plus, Sun, Trash2, Upload } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { useSetsStore } from '@/stores/sets'
import { useUIStore } from '@/stores/ui'
import Badge from './ui/badge/Badge.vue'
import Button from './ui/button/Button.vue'
import Progress from './ui/progress/Progress.vue'

const sessionStore = useSessionStore()
const setsStore = useSetsStore()
const uiStore = useUIStore()
const route = useRoute()
const { t } = useI18n()
const { exitCurrentView } = sessionStore
const { currentSession, currentIndex, totalItems, progressPercent, flashcardIndex } = storeToRefs(sessionStore)
const { hasSets, sets, totalWordCount, activeSet } = storeToRefs(setsStore)
const { editActiveSet, deleteActiveSet, openImport } = setsStore
const { theme } = storeToRefs(uiStore)
const { openTransfer, toggleTheme } = uiStore

const isHome = computed(() => route.name === 'home')
const isPractice = computed(() => route.name === 'quiz' || route.name === 'spelling')
const isFlashcard = computed(() => route.name === 'flashcard')
const showSessionProgress = computed(() => (isPractice.value || isFlashcard.value) && !!currentSession.value)

const practiceLabel = computed(() => {
  if (route.name === 'quiz')
    return t('practice.quiz')
  if (route.name === 'spelling')
    return t('practice.spelling')
  if (route.name === 'flashcard')
    return t('flashcard.title')
  return ''
})

const progressIndex = computed(() => {
  if (isFlashcard.value)
    return flashcardIndex.value
  return currentIndex.value
})
</script>

<template>
  <header
    class="fixed inset-x-0 top-0 z-40 border-b border-ink-200/70 bg-white/80 backdrop-blur-xl transition-all duration-200 dark:border-ink-200/15 dark:bg-ink-950/80"
  >
    <div class="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
      <div class="flex items-center gap-3 min-w-0">
        <Button
          v-if="!isHome"
          variant="ghost"
          size="icon"
          class="h-9 w-9 shrink-0"
          :aria-label="t('appHeader.back')"
          @click="exitCurrentView"
        >
          <ArrowLeft class="h-4.5 w-4.5 text-accent-primary" />
        </Button>
        <div class="text-left min-w-0">
          <h1 class="text-xl sm:text-2xl font-extrabold tracking-tight text-ink-950 dark:text-ink-50">
            {{ t('app.name') }}
          </h1>
          <p v-if="isHome" class="text-xs text-ink-500 dark:text-ink-400 mt-0.5 font-semibold">
            <span v-if="hasSets">
              {{ $t('appHeader.stats', { setCount: sets.length, wordCount: totalWordCount }) }}
            </span>
            <span v-else>
              {{ $t('appHeader.emptyHint') }}
            </span>
          </p>
          <p v-else-if="activeSet" class="text-xs text-ink-500 dark:text-ink-400 mt-0.5 truncate font-semibold">
            {{ activeSet.setName }}<span v-if="isPractice || isFlashcard">{{ $t('appHeader.practiceStats', { label: practiceLabel, count: totalItems }) }}</span>
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <template v-if="showSessionProgress">
          <Progress :model-value="progressPercent" class="hidden h-1.5 w-16 sm:block sm:w-24" />
          <span class="text-xs sm:text-sm font-bold tabular-nums text-ink-950 dark:text-ink-50">
            {{ progressIndex + 1 }}<span class="text-[10px] sm:text-xs text-ink-400">/{{ totalItems }}</span>
          </span>
        </template>

        <template v-else-if="isHome && hasSets">
          <Button
            variant="outline"
            size="icon"
            class="h-9 w-9"
            :title="t('home.backupAndImport')"
            :aria-label="t('home.backupAndImport')"
            @click="openTransfer"
          >
            <Upload class="h-4.5 w-4.5" />
          </Button>
          <Button
            variant="default"
            size="icon"
            class="h-9 w-9"
            :title="t('home.addSet')"
            :aria-label="t('home.addSet')"
            @click="openImport"
          >
            <Plus class="h-4.5 w-4.5" />
          </Button>
        </template>

        <template v-else-if="!isHome && activeSet && !showSessionProgress">
          <Badge variant="secondary" class="hidden sm:inline-flex rounded-xl px-3 py-1.5 text-xs font-semibold bg-ink-200 dark:bg-ink-200/40 border-none">
            {{ activeSet.setName }}
          </Badge>
          <Button
            variant="outline"
            size="icon"
            class="h-9 w-9 text-ink-600 dark:text-ink-400 hover:text-accent-primary dark:hover:text-accent-primary"
            :aria-label="t('appHeader.editSet')"
            @click="editActiveSet"
          >
            <PencilLine class="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            class="h-9 w-9 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/15"
            :aria-label="t('appHeader.deleteSet')"
            @click="deleteActiveSet"
          >
            <Trash2 class="h-4 w-4" />
          </Button>
        </template>

        <span class="w-px h-5 bg-ink-200/60 dark:bg-ink-200/10 mx-1 hidden sm:inline-block" />

        <Button
          variant="ghost"
          size="icon"
          class="h-9 w-9 relative overflow-hidden"
          :title="t('appHeader.toggleTheme')"
          :aria-label="t('appHeader.toggleTheme')"
          @click="toggleTheme"
        >
          <Transition name="theme-icon" mode="out-in">
            <Sun v-if="theme === 'dark'" key="sun" class="h-4.5 w-4.5 text-accent-primary" />
            <Moon v-else key="moon" class="h-4.5 w-4.5 text-accent-primary" />
          </Transition>
        </Button>
      </div>
    </div>
    <div v-if="showSessionProgress" class="sm:hidden px-4 pb-2">
      <Progress :model-value="progressPercent" class="h-1 w-full" />
    </div>
  </header>
</template>

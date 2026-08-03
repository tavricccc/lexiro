<script setup lang="ts">
import type { PracticeMode } from '@/types'
import { ArrowLeft } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { LAYERS } from '@/constants/layers'
import { createSessionHeaderModel } from '@/lib/session-header'
import { useLearningStore } from '@/stores/learning'
import { useSessionStore } from '@/stores/session'
import { useSetsStore } from '@/stores/sets'
import Button from './ui/button/Button.vue'
import Progress from './ui/progress/Progress.vue'

const sessionStore = useSessionStore()
const setsStore = useSetsStore()
const learningStore = useLearningStore()
const route = useRoute()
const { t } = useI18n()
const { currentSession, currentIndex, totalItems } = storeToRefs(sessionStore)
const { reviewContext, reviewSetId, reviewIndex, reviewTotal } = storeToRefs(learningStore)

const isReview = computed(() => route.name === 'review')
const isResult = computed(() => route.name === 'result')
const sourceSetId = computed(() => isReview.value ? reviewSetId.value : currentSession.value?.sourceSetId ?? '')
const isDaily = computed(() => isReview.value ? reviewContext.value === 'daily' : sourceSetId.value === 'daily')
const setName = computed(() => setsStore.sets.find(set => set.id === sourceSetId.value)?.setName ?? '')
const mode = computed<PracticeMode | 'review'>(() => isReview.value ? 'review' : currentSession.value?.mode ?? 'quiz')
const header = computed(() => createSessionHeaderModel({
  daily: isDaily.value,
  setName: setName.value,
  mode: mode.value,
  current: isReview.value ? reviewIndex.value : currentIndex.value,
  total: isReview.value ? reviewTotal.value : totalItems.value,
  result: isResult.value,
  translate: key => t(key),
}))
</script>

<template>
  <header class="app-header fixed inset-x-0 top-0 backdrop-blur-xl transition-colors duration-200" :style="{ zIndex: LAYERS.navigation }">
    <div class="app-header__inner route-page-frame viewport-frame flex items-center justify-between gap-3">
      <div class="flex min-w-0 items-center gap-3">
        <Button variant="ghost" size="icon" class="h-11 w-11 shrink-0" :aria-label="t('appHeader.back')" @click="sessionStore.exitCurrentView">
          <ArrowLeft class="h-4.5 w-4.5 text-accent-primary" />
        </Button>
        <div class="min-w-0 text-left">
          <h1 class="truncate text-base font-semibold text-ink-950 dark:text-ink-50 sm:text-lg">
            {{ header.title }}
          </h1>
          <p class="mt-0.5 truncate text-xs font-semibold text-ink-500 dark:text-ink-400">
            {{ header.subtitle }}
          </p>
        </div>
      </div>

      <span class="min-w-12 shrink-0 text-right text-sm font-bold tabular-nums text-ink-950 dark:text-ink-50" :class="{ invisible: !header.showProgress }">
        {{ header.current + 1 }}<span class="text-xs text-ink-400">/{{ header.total }}</span>
      </span>
    </div>
    <div class="app-header__progress route-page-frame viewport-frame flex h-3 items-start" :aria-hidden="!header.showProgress">
      <Progress :model-value="header.progress" :class="header.showProgress ? 'h-1 w-full' : 'invisible h-1 w-full'" />
    </div>
  </header>
</template>

<script setup lang="ts">
import { BookOpenCheck, Cloud, Layers3, PlayCircle } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useSetsStore } from '@/stores/sets'
import { useUIStore } from '@/stores/ui'
import SyncProgressPanel from './SyncProgressPanel.vue'
import Button from './ui/button/Button.vue'
import Card from './ui/card/Card.vue'

const setsStore = useSetsStore()
const sessionStore = useSessionStore()
const uiStore = useUIStore()
const { sets, totalWordCount } = storeToRefs(setsStore)

const inProgressCount = computed(() => sets.value.filter(set => sessionStore.isSetInProgress(set.id)).length)
</script>

<template>
  <Card class="overflow-hidden p-0 text-left">
    <div class="grid lg:grid-cols-[1fr_280px]">
      <div class="p-5 sm:p-6">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="text-xs font-extrabold uppercase tracking-widest text-ink-400 dark:text-ink-500">
              {{ $t('home.overviewEyebrow') }}
            </p>
            <h2 class="mt-1 text-xl font-extrabold tracking-tight text-ink-950 dark:text-ink-50">
              {{ $t('home.overviewTitle') }}
            </h2>
          </div>
          <Button variant="outline" size="sm" class="gap-2 self-start" @click="uiStore.openTransfer">
            <Cloud class="h-3.5 w-3.5" />
            {{ $t('home.manageBackup') }}
          </Button>
        </div>

        <dl class="mt-5 grid grid-cols-3 gap-2">
          <div class="rounded-2xl bg-ink-100/80 p-3 dark:bg-ink-900">
            <Layers3 class="h-4 w-4 text-ink-400" />
            <dd class="mt-2 text-xl font-extrabold tabular-nums">
              {{ sets.length }}
            </dd>
            <dt class="text-[11px] font-semibold text-ink-400">
              {{ $t('home.metricSets') }}
            </dt>
          </div>
          <div class="rounded-2xl bg-ink-100/80 p-3 dark:bg-ink-900">
            <BookOpenCheck class="h-4 w-4 text-ink-400" />
            <dd class="mt-2 text-xl font-extrabold tabular-nums">
              {{ totalWordCount }}
            </dd>
            <dt class="text-[11px] font-semibold text-ink-400">
              {{ $t('home.metricWords') }}
            </dt>
          </div>
          <div class="rounded-2xl bg-ink-100/80 p-3 dark:bg-ink-900">
            <PlayCircle class="h-4 w-4 text-ink-400" />
            <dd class="mt-2 text-xl font-extrabold tabular-nums">
              {{ inProgressCount }}
            </dd>
            <dt class="text-[11px] font-semibold text-ink-400">
              {{ $t('home.metricProgress') }}
            </dt>
          </div>
        </dl>
      </div>

      <div class="border-t border-ink-200/60 bg-ink-100/40 p-5 dark:border-ink-200/10 dark:bg-ink-900/50 lg:border-l lg:border-t-0">
        <p class="mb-3 text-xs font-extrabold uppercase tracking-widest text-ink-400 dark:text-ink-500">
          {{ $t('home.dataSafety') }}
        </p>
        <SyncProgressPanel compact />
        <p class="mt-3 text-[11px] font-semibold leading-relaxed text-ink-400">
          {{ $t('home.localSaveHint') }}
        </p>
      </div>
    </div>
  </Card>
</template>

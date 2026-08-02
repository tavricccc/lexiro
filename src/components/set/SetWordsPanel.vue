<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useLibraryStore } from '@/stores/library'
import Card from '../ui/card/Card.vue'
import SetWordList from './SetWordList.vue'

const props = defineProps<{
  setId: string
}>()

const route = useRoute()
const libraryStore = useLibraryStore()
const search = defineModel<string>('search', { default: '' })
const words = computed(() => libraryStore.getSetWords(props.setId).slice().sort((a, b) => a.word.localeCompare(b.word)))
const isDetail = computed(() => route.name === 'set-word' || typeof route.params.wordKey === 'string')
</script>

<template>
  <section class="space-y-4 text-left">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 class="text-xl font-black tracking-tight">
          {{ $t('set.wordsTab') }}
        </h2>
        <p class="mt-1 text-sm font-semibold text-ink-500">
          {{ $t('set.wordCount', { count: words.length }) }}
        </p>
      </div>
    </div>

    <Card v-if="words.length" class="p-4 sm:p-5">
      <div class="grid gap-6 lg:grid-cols-[minmax(13rem,18rem)_minmax(0,1fr)]">
        <aside :class="isDetail ? 'hidden lg:block' : 'block'" class="min-w-0 lg:border-r lg:border-ink-200/60 lg:pr-5 lg:dark:border-ink-200/10">
          <SetWordList :set-id="setId" :words="words" :search="search" @update:search="search = $event" />
        </aside>

        <section :class="isDetail ? 'block' : 'hidden lg:block'" class="min-w-0">
          <router-view v-slot="{ Component }">
            <component :is="Component" :set-id="setId" :word-key="String(route.params.wordKey ?? '')" />
          </router-view>
          <div v-if="!isDetail" class="flex min-h-72 items-center justify-center rounded-2xl border border-dashed border-ink-200/70 px-6 text-center text-sm font-semibold text-ink-400 dark:border-ink-200/20">
            {{ $t('set.chooseWord') }}
          </div>
        </section>
      </div>
    </Card>
    <Card v-else class="p-8 text-center text-sm font-semibold text-ink-400">
      {{ $t('study.noWords') }}
    </Card>
  </section>
</template>

<script setup lang="ts">
import type { WordEntry } from '@/types'
import { Search } from 'lucide-vue-next'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useLibraryStore } from '@/stores/library'
import Input from '../ui/input/Input.vue'

const props = defineProps<{
  setId: string
  words: WordEntry[]
  search: string
}>()

const emit = defineEmits<{
  'update:search': [value: string]
}>()

const route = useRoute()
const libraryStore = useLibraryStore()
const filteredWords = computed(() => {
  const query = props.search.trim().toLocaleLowerCase()
  if (!query)
    return props.words
  return props.words.filter((word) => {
    const searchable = [word.word, ...word.senses.flatMap(sense => [sense.pos, sense.meaningZh, ...sense.examples])]
    return searchable.some(value => value.toLocaleLowerCase().includes(query))
  })
})

function senseCount(word: WordEntry): number {
  const allowed = new Set(libraryStore.getMembership(props.setId, word.wordKey)?.senseIds ?? [])
  return word.senses.filter(sense => allowed.has(sense.id)).length
}
</script>

<template>
  <div class="space-y-3">
    <label class="relative block">
      <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
      <Input :model-value="search" :placeholder="$t('set.searchWords')" class="pl-9" :aria-label="$t('set.searchWords')" @update:model-value="emit('update:search', $event)" />
    </label>

    <div v-if="filteredWords.length" class="space-y-1 lg:max-h-[calc(100dvh-22rem)] lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
      <RouterLink
        v-for="word in filteredWords"
        :key="word.wordKey"
        :to="{ name: 'set-word', params: { setId, wordKey: word.wordKey } }"
        class="flex min-h-11 items-center justify-between gap-3 rounded-2xl px-3 py-2 text-left transition-colors"
        :class="route.params.wordKey === word.wordKey ? 'bg-accent-primary/10 text-accent-primary' : 'text-ink-700 hover:bg-ink-100 dark:text-ink-200 dark:hover:bg-ink-800'"
      >
        <span class="min-w-0 truncate text-sm font-bold">{{ word.word }}</span>
        <span class="shrink-0 text-xs font-semibold text-ink-400">{{ senseCount(word) }}</span>
      </RouterLink>
    </div>
    <p v-else class="rounded-2xl border border-dashed border-ink-200/70 px-4 py-8 text-center text-sm font-semibold text-ink-400 dark:border-ink-200/20">
      {{ $t('set.noMatchingWords') }}
    </p>
  </div>
</template>

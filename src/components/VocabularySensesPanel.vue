<script setup lang="ts">
import type { WordSense } from '@/types'
import { ChevronDown, ChevronRight } from 'lucide-vue-next'
import Card from './ui/card/Card.vue'
import SenseCard from './word/SenseCard.vue'

defineProps<{
  currentSenses: WordSense[]
  otherSenses: WordSense[]
  otherExpanded: boolean
  otherSenseSetNames: (senseId: string) => string
}>()

const emit = defineEmits<{
  'update:otherExpanded': [value: boolean]
  'edit-sense': [sense: WordSense]
  'edit-example': [sense: WordSense, index: number]
  'add-example': [sense: WordSense]
  'delete-example': [sense: WordSense, index: number]
  'delete-sense': [sense: WordSense]
}>()
</script>

<template>
  <Card class="p-4 sm:p-5 space-y-6">
    <div>
      <h2 class="text-lg font-black">
        {{ $t('vocabulary.currentSenses') }}
      </h2>
      <div v-if="currentSenses.length" class="mt-4 space-y-4">
        <SenseCard
          v-for="sense in currentSenses"
          :key="sense.id"
          :sense="sense"
          :editable="true"
          @edit="emit('edit-sense', $event)"
          @edit-example="(sense, index) => emit('edit-example', sense, index)"
          @add-example="emit('add-example', $event)"
          @delete-example="(sense, index) => emit('delete-example', sense, index)"
          @delete="emit('delete-sense', $event)"
        />
      </div>
      <p v-else class="mt-4 text-sm font-semibold text-ink-400">
        {{ $t('vocabulary.noCurrentSenses') }}
      </p>
    </div>

    <div v-if="otherSenses.length" class="border-t border-ink-200/60 pt-5 dark:border-ink-800">
      <button type="button" class="flex min-h-11 w-full items-center justify-between text-left text-base font-black" :aria-expanded="otherExpanded" @click="emit('update:otherExpanded', !otherExpanded)">
        <span>{{ $t('vocabulary.otherSenses') }}</span>
        <ChevronDown v-if="otherExpanded" class="h-5 w-5 text-ink-400" />
        <ChevronRight v-else class="h-5 w-5 text-ink-400" />
      </button>
      <div v-if="otherExpanded" class="mt-4 space-y-3">
        <div v-for="sense in otherSenses" :key="sense.id" class="opacity-80">
          <SenseCard :sense="sense" :set-names="otherSenseSetNames(sense.id)" />
        </div>
      </div>
    </div>
  </Card>
</template>

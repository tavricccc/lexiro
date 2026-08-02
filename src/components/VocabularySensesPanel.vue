<script setup lang="ts">
import type { WordSense } from '@/types'
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-vue-next'
import Badge from './ui/badge/Badge.vue'
import Button from './ui/button/Button.vue'
import Card from './ui/card/Card.vue'

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
  <Card class="p-5">
    <h2 class="text-lg font-black">
      {{ $t('vocabulary.currentSenses') }}
    </h2>
    <div v-if="currentSenses.length" class="mt-4 space-y-4">
      <article v-for="sense in currentSenses" :key="sense.id" class="rounded-2xl border border-ink-200/60 p-4 dark:border-ink-200/15">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                {{ sense.pos }}
              </Badge><h3 class="font-black">
                {{ sense.meaningZh }}
              </h3>
            </div>
            <ul v-if="sense.examples.length" class="mt-3 space-y-2 text-sm text-ink-600 dark:text-ink-300">
              <li v-for="(example, index) in sense.examples" :key="`${sense.id}-${index}`" class="flex items-start gap-2">
                <span class="min-w-0 flex-1">{{ example }}</span><Button variant="ghost" size="icon" class="h-7 w-7" :aria-label="$t('vocabulary.editExample')" @click="emit('edit-example', sense, index)">
                  <Pencil class="h-3.5 w-3.5" />
                </Button><Button variant="ghost" size="icon" class="h-7 w-7 text-red-500" :aria-label="$t('vocabulary.deleteExample')" @click="emit('delete-example', sense, index)">
                  <Trash2 class="h-3.5 w-3.5" />
                </Button>
              </li>
            </ul>
            <Button variant="ghost" size="sm" class="mt-2 gap-1" @click="emit('add-example', sense)">
              <Plus class="h-3.5 w-3.5" />{{ $t('vocabulary.addExample') }}
            </Button>
          </div>
          <div class="flex shrink-0 gap-1">
            <Button variant="ghost" size="icon" class="h-8 w-8" :aria-label="$t('vocabulary.editSense')" @click="emit('edit-sense', sense)">
              <Pencil class="h-4 w-4" />
            </Button><Button variant="ghost" size="icon" class="h-8 w-8 text-red-500" :aria-label="$t('vocabulary.deleteSense')" @click="emit('delete-sense', sense)">
              <Trash2 class="h-4 w-4" />
            </Button>
          </div>
        </div>
      </article>
    </div>
    <p v-else class="mt-4 text-sm font-semibold text-ink-400">
      {{ $t('vocabulary.noCurrentSenses') }}
    </p>
  </Card>

  <Card v-if="otherSenses.length" class="p-5">
    <button type="button" class="flex w-full items-center justify-between text-left text-lg font-black" :aria-expanded="otherExpanded" @click="emit('update:otherExpanded', !otherExpanded)">
      <span>{{ $t('vocabulary.otherSenses') }}</span><ChevronDown v-if="otherExpanded" class="h-5 w-5 text-ink-400" /><ChevronRight v-else class="h-5 w-5 text-ink-400" />
    </button>
    <div v-if="otherExpanded" class="mt-4 space-y-3">
      <article v-for="sense in otherSenses" :key="sense.id" class="rounded-2xl border border-ink-200/50 p-4 opacity-80 dark:border-ink-200/15">
        <div class="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {{ sense.pos }}
          </Badge><span class="font-bold">{{ sense.meaningZh }}</span>
        </div><p class="mt-2 text-xs font-semibold text-ink-500">
          {{ otherSenseSetNames(sense.id) }} · {{ $t('vocabulary.readOnly') }}
        </p>
      </article>
    </div>
  </Card>
</template>

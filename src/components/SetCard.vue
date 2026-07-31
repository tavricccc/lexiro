<script setup lang="ts">
import type { VocabItem } from '@/types'
import { ArrowRight, Flame, PencilLine, Play, RotateCcw, Trash2 } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLearningStore } from '@/stores/learning'
import { useSessionStore } from '@/stores/session'
import Badge from './ui/badge/Badge.vue'
import Button from './ui/button/Button.vue'
import Card from './ui/card/Card.vue'
import MetricPill from './ui/metric-pill/MetricPill.vue'

const props = defineProps<{
  set: { id: string, setName: string, difficulty: number, items: VocabItem[] }
  active?: boolean
}>()

defineEmits<{
  study: [setId: string]
  delete: [setId: string]
  edit: [setId: string]
}>()

const { t } = useI18n()
const sessionStore = useSessionStore()
const learningStore = useLearningStore()

const progressLabel = computed(() => sessionStore.getInProgressModesLabel(props.set.id))
const dueCount = computed(() => learningStore.getDueCount(props.set))
const mastery = computed(() => learningStore.getMasteryPercent(props.set))
const favoriteCount = computed(() => props.set.items.filter(item => item.favorite).length)
const weakCount = computed(() => props.set.items.filter((item) => {
  const card = learningStore.getSetProgress(props.set.id).cards[item.id]
  return Boolean(card && card.reviewCount >= 2 && card.correctCount / card.reviewCount < 0.6)
}).length)
</script>

<template>
  <Card
    class="surface-card--interactive p-5 sm:p-6 text-left cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft"
    :class="active ? 'ring-2 ring-accent-primary/25 border-accent-primary/30' : ''"
    @click="$emit('study', set.id)"
  >
    <div class="flex items-start justify-between gap-4">
      <div class="space-y-1 text-left min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <h3 class="text-lg font-extrabold tracking-tight text-ink-950 dark:text-ink-50 truncate">
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
        <p v-if="progressLabel" class="text-[11px] font-semibold text-accent-primary">
          {{ $t('home.inProgressModes', { modes: progressLabel }) }}
        </p>
      </div>

      <div class="flex shrink-0 items-center gap-1.5" @click.stop>
        <Button variant="ghost" size="icon" class="h-8 w-8" :aria-label="t('setCard.edit')" @click="$emit('edit', set.id)">
          <PencilLine class="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/15"
          :aria-label="t('setCard.delete')"
          @click="$emit('delete', set.id)"
        >
          <Trash2 class="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>

    <div class="mt-4 flex flex-wrap gap-2">
      <MetricPill :label="$t('setCard.difficulty')" :value="set.difficulty" />
      <MetricPill :value="$t('practice.questions', { count: set.items.length })" />
      <MetricPill v-if="favoriteCount" :label="$t('learning.favorites')" :value="favoriteCount" />
      <MetricPill v-if="weakCount" :label="$t('learning.weak')" :value="weakCount" />
    </div>

    <div class="mt-4">
      <div class="mb-1.5 flex items-center justify-between text-[11px] font-bold text-ink-400">
        <span>{{ $t('learning.mastery') }}</span>
        <span>{{ mastery }}%</span>
      </div>
      <div class="h-1.5 overflow-hidden rounded-full bg-ink-200 dark:bg-ink-800">
        <div class="h-full rounded-full bg-accent-primary transition-all duration-500" :style="{ width: `${mastery}%` }" />
      </div>
    </div>

    <div class="mt-5">
      <Button
        variant="default"
        class="w-full justify-center gap-2 font-black"
        @click.stop="$emit('study', set.id)"
      >
        <RotateCcw v-if="dueCount > 0" class="h-4 w-4" />
        <Play v-else class="h-4 w-4" />
        <span>{{ dueCount > 0 ? $t('study.review') : (active ? $t('home.continue') : $t('study.startStudy')) }}</span>
        <ArrowRight class="h-4 w-4" />
      </Button>
    </div>
  </Card>
</template>

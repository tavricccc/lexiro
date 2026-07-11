<script setup lang="ts">
import type { VocabItem } from '@/types'
import { BookOpenText, PencilLine, Play, SpellCheck2, Trash2 } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
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
  flashcards: [setId: string]
  quiz: [setId: string]
  spelling: [setId: string]
  delete: [setId: string]
  edit: [setId: string]
}>()

const { t } = useI18n()
const sessionStore = useSessionStore()

const progressLabel = computed(() => sessionStore.getInProgressModesLabel(props.set.id))
const inProgressModes = computed(() => sessionStore.getInProgressModes(props.set.id))

function modeActive(mode: 'flashcard' | 'quiz' | 'spelling') {
  return inProgressModes.value.includes(mode)
}
</script>

<template>
  <Card
    class="p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg sm:p-6"
    :class="active ? 'ring-2 ring-accent-primary/25 border-accent-primary/30' : ''"
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
        </div>
        <p class="text-xs font-semibold text-ink-500 dark:text-ink-400">
          {{ $t('home.wordsCount', { count: set.items.length }) }}
        </p>
        <p v-if="progressLabel" class="text-[11px] font-semibold text-accent-primary">
          {{ $t('home.inProgressModes', { modes: progressLabel }) }}
        </p>
      </div>

      <div class="flex shrink-0 items-center gap-1.5">
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

    <div class="mt-5 flex flex-wrap gap-2">
      <MetricPill :label="$t('setCard.difficulty')" :value="set.difficulty" />
      <MetricPill :value="$t('practice.questions', { count: set.items.length })" />
    </div>

    <div class="mt-5 grid gap-2.5">
      <Button
        variant="default"
        class="w-full justify-center gap-2"
        :class="modeActive('flashcard') ? 'ring-2 ring-accent-primary/30' : ''"
        @click="$emit('flashcards', set.id)"
      >
        <BookOpenText class="h-4 w-4" />
        <span>{{ modeActive('flashcard') ? $t('setCard.flashcardsResume') : $t('setCard.flashcards') }}</span>
      </Button>
      <div class="grid grid-cols-2 gap-2.5">
        <Button
          variant="secondary"
          class="w-full justify-center gap-2"
          :class="modeActive('quiz') ? 'ring-2 ring-accent-primary/30' : ''"
          @click="$emit('quiz', set.id)"
        >
          <Play class="h-4 w-4" />
          <span>{{ modeActive('quiz') ? $t('setCard.quizResume') : $t('setCard.quiz') }}</span>
        </Button>
        <Button
          variant="secondary"
          class="w-full justify-center gap-2"
          :class="modeActive('spelling') ? 'ring-2 ring-accent-primary/30' : ''"
          @click="$emit('spelling', set.id)"
        >
          <SpellCheck2 class="h-4 w-4" />
          <span>{{ modeActive('spelling') ? $t('setCard.spellingResume') : $t('setCard.spelling') }}</span>
        </Button>
      </div>
    </div>
  </Card>
</template>

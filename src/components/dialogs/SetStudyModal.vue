<script setup lang="ts">
import type { VocabSet } from '@/types'
import { ArrowRight, BookOpenText, Brain, Check, Flame, RotateCcw, SpellCheck2 } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useLearningStore } from '@/stores/learning'
import { useSessionStore } from '@/stores/session'
import Badge from '../ui/badge/Badge.vue'
import Button from '../ui/button/Button.vue'
import Dialog from '../ui/dialog/Dialog.vue'

const props = defineProps<{
  open: boolean
  set: VocabSet | null
}>()

const emit = defineEmits<{
  close: []
}>()

const router = useRouter()
const sessionStore = useSessionStore()
const learningStore = useLearningStore()

type StudyMode = 'review' | 'flashcard' | 'quiz' | 'spelling'
const selectedMode = ref<StudyMode>('flashcard')
const selectedCount = ref<number>(10)

const dueCount = computed(() => props.set ? learningStore.getDueCount(props.set) : 0)
const totalItems = computed(() => props.set?.items.length ?? 0)
const mastery = computed(() => props.set ? learningStore.getMasteryPercent(props.set) : 0)
const inProgressModes = computed(() => props.set ? sessionStore.getInProgressModes(props.set.id) : [])

watch(() => props.open, (isOpen) => {
  if (isOpen && props.set) {
    if (dueCount.value > 0)
      selectedMode.value = 'review'
    else if (inProgressModes.value.includes('quiz'))
      selectedMode.value = 'quiz'
    else if (inProgressModes.value.includes('spelling'))
      selectedMode.value = 'spelling'
    else
      selectedMode.value = 'flashcard'

    selectedCount.value = sessionStore.getPracticeCount(props.set.id, totalItems.value)
  }
})

const countPresetOptions = computed(() => {
  const total = totalItems.value
  const presets = [5, 10, 20, 50].filter(n => n < total)
  return [...presets, total]
})

function startStudy() {
  if (!props.set)
    return
  const setId = props.set.id
  emit('close')

  if (selectedMode.value === 'review') {
    if (learningStore.startReview(setId))
      router.push({ name: 'review', params: { setId } })
    return
  }

  if (selectedMode.value === 'flashcard') {
    sessionStore.startFlashcards(setId)
    return
  }

  // Quiz or Spelling mode
  sessionStore.handlePracticeCountChange(setId, selectedCount.value, totalItems.value)
  sessionStore.startRound(selectedMode.value, setId)
}
</script>

<template>
  <Dialog
    :open="open"
    :title="set?.setName ?? $t('study.title')"
    :description="$t('study.modalSubtitle', { count: totalItems })"
    @close="emit('close')"
  >
    <div v-if="set" class="space-y-5 text-left">
      <!-- Top Mastery & Due Info Banner -->
      <div class="flex items-center justify-between rounded-2xl bg-ink-100/70 p-4 dark:bg-ink-900/70">
        <div class="space-y-1">
          <p class="text-xs font-black uppercase tracking-wider text-ink-400">
            {{ $t('learning.mastery') }}
          </p>
          <p class="text-xl font-black text-ink-950 dark:text-ink-50">
            {{ mastery }}%
          </p>
        </div>
        <div v-if="dueCount > 0" class="text-right">
          <Badge variant="default" class="bg-amber-500 text-white rounded-lg px-2.5 py-1 text-xs font-black">
            <Flame class="mr-1 inline h-3.5 w-3.5" />
            {{ $t('home.dueHint', { count: dueCount }) }}
          </Badge>
        </div>
      </div>

      <!-- SRS Review Option (Highlighted if due cards exist) -->
      <div
        v-if="dueCount > 0"
        class="relative cursor-pointer overflow-hidden rounded-2xl border-2 p-4 transition-all duration-200"
        :class="selectedMode === 'review' ? 'border-amber-500 bg-amber-500/10 shadow-soft' : 'border-ink-200/60 dark:border-ink-800 hover:border-amber-500/50'"
        @click="selectedMode = 'review'"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white">
              <RotateCcw class="h-5 w-5" />
            </div>
            <div>
              <p class="text-sm font-black text-ink-950 dark:text-ink-50">
                {{ $t('study.srsReviewTitle') }}
              </p>
              <p class="text-xs font-semibold text-ink-500 dark:text-ink-400">
                {{ $t('study.srsReviewDesc', { count: dueCount }) }}
              </p>
            </div>
          </div>
          <Check v-if="selectedMode === 'review'" class="h-5 w-5 text-amber-500 shrink-0" />
        </div>
      </div>

      <!-- Stepped Learning Modes -->
      <div>
        <p class="mb-3 text-xs font-black uppercase tracking-wider text-ink-400">
          {{ $t('study.chooseStepTitle') }}
        </p>
        <div class="grid gap-3">
          <!-- Step 1: Flashcards -->
          <div
            class="flex cursor-pointer items-center justify-between rounded-2xl border p-4 transition-all duration-200"
            :class="selectedMode === 'flashcard' ? 'border-accent-primary bg-accent-primary/10 shadow-soft' : 'border-ink-200/60 dark:border-ink-800 hover:border-accent-primary/40'"
            @click="selectedMode = 'flashcard'"
          >
            <div class="flex items-center gap-3 min-w-0">
              <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink-200 dark:bg-ink-800 text-ink-950 dark:text-white font-black text-xs">
                1
              </div>
              <div class="min-w-0">
                <p class="text-sm font-black text-ink-950 dark:text-ink-50 flex items-center gap-2">
                  <BookOpenText class="h-4 w-4 text-accent-primary" />
                  {{ $t('setCard.flashcards') }}
                  <Badge v-if="inProgressModes.includes('flashcard')" variant="outline" class="text-[10px]">
                    {{ $t('home.inProgress') }}
                  </Badge>
                </p>
                <p class="text-xs font-medium text-ink-500 dark:text-ink-400 truncate">
                  {{ $t('study.step1Desc') }}
                </p>
              </div>
            </div>
            <Check v-if="selectedMode === 'flashcard'" class="h-5 w-5 text-accent-primary shrink-0" />
          </div>

          <!-- Step 2: Quiz -->
          <div
            class="flex cursor-pointer items-center justify-between rounded-2xl border p-4 transition-all duration-200"
            :class="selectedMode === 'quiz' ? 'border-accent-primary bg-accent-primary/10 shadow-soft' : 'border-ink-200/60 dark:border-ink-800 hover:border-accent-primary/40'"
            @click="selectedMode = 'quiz'"
          >
            <div class="flex items-center gap-3 min-w-0">
              <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink-200 dark:bg-ink-800 text-ink-950 dark:text-white font-black text-xs">
                2
              </div>
              <div class="min-w-0">
                <p class="text-sm font-black text-ink-950 dark:text-ink-50 flex items-center gap-2">
                  <Brain class="h-4 w-4 text-accent-primary" />
                  {{ $t('setCard.quiz') }}
                  <Badge v-if="inProgressModes.includes('quiz')" variant="outline" class="text-[10px]">
                    {{ $t('home.inProgress') }}
                  </Badge>
                </p>
                <p class="text-xs font-medium text-ink-500 dark:text-ink-400 truncate">
                  {{ $t('study.step2Desc') }}
                </p>
              </div>
            </div>
            <Check v-if="selectedMode === 'quiz'" class="h-5 w-5 text-accent-primary shrink-0" />
          </div>

          <!-- Step 3: Spelling -->
          <div
            class="flex cursor-pointer items-center justify-between rounded-2xl border p-4 transition-all duration-200"
            :class="selectedMode === 'spelling' ? 'border-accent-primary bg-accent-primary/10 shadow-soft' : 'border-ink-200/60 dark:border-ink-800 hover:border-accent-primary/40'"
            @click="selectedMode = 'spelling'"
          >
            <div class="flex items-center gap-3 min-w-0">
              <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink-200 dark:bg-ink-800 text-ink-950 dark:text-white font-black text-xs">
                3
              </div>
              <div class="min-w-0">
                <p class="text-sm font-black text-ink-950 dark:text-ink-50 flex items-center gap-2">
                  <SpellCheck2 class="h-4 w-4 text-accent-primary" />
                  {{ $t('setCard.spelling') }}
                  <Badge v-if="inProgressModes.includes('spelling')" variant="outline" class="text-[10px]">
                    {{ $t('home.inProgress') }}
                  </Badge>
                </p>
                <p class="text-xs font-medium text-ink-500 dark:text-ink-400 truncate">
                  {{ $t('study.step3Desc') }}
                </p>
              </div>
            </div>
            <Check v-if="selectedMode === 'spelling'" class="h-5 w-5 text-accent-primary shrink-0" />
          </div>
        </div>
      </div>

      <!-- Question Count Picker (for Quiz & Spelling) -->
      <div v-if="selectedMode === 'quiz' || selectedMode === 'spelling'" class="space-y-2">
        <label class="text-xs font-black uppercase tracking-wider text-ink-400">
          {{ $t('practice.countLabel') }}
        </label>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="countOption in countPresetOptions"
            :key="countOption"
            type="button"
            class="rounded-xl px-3 py-1.5 text-xs font-bold transition-all duration-150 border"
            :class="selectedCount === countOption ? 'bg-accent-primary text-white border-accent-primary' : 'border-ink-200 dark:border-ink-700 hover:bg-ink-100 dark:hover:bg-ink-900 text-ink-800 dark:text-ink-200'"
            @click="selectedCount = countOption"
          >
            {{ countOption === totalItems ? $t('study.allCount', { count: totalItems }) : `${countOption} ${$t('home.wordUnit')}` }}
          </button>
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="flex justify-end gap-2 pt-4 border-t border-ink-200/40 dark:border-ink-200/10">
        <Button variant="outline" @click="emit('close')">
          {{ $t('editor.cancel') }}
        </Button>
        <Button variant="default" class="gap-2" @click="startStudy">
          <span>{{ $t('study.startNow') }}</span>
          <ArrowRight class="h-4 w-4" />
        </Button>
      </div>
    </div>
  </Dialog>
</template>

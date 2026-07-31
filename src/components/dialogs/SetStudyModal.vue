<script setup lang="ts">
import type { VocabSet } from '@/types'
import { ArrowRight, BookOpenText, Brain, Check, Flame, RotateCcw, SpellCheck2 } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
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
const { t } = useI18n()
const sessionStore = useSessionStore()
const learningStore = useLearningStore()

type StudyMode = 'review' | 'flashcard' | 'quiz' | 'spelling'
const selectedMode = ref<StudyMode>('flashcard')
const selectedCount = ref<number>(10)

const dueCount = computed(() => props.set ? learningStore.getDueCount(props.set) : 0)
const totalItems = computed(() => props.set?.items.length ?? 0)
const learnedCount = computed(() => props.set ? learningStore.getLearnedCount(props.set) : 0)
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

    const savedCount = sessionStore.getPracticeCount(props.set.id, totalItems.value)
    selectedCount.value = countOptions.value.find(option => option >= savedCount) ?? countOptions.value[countOptions.value.length - 1] ?? 1
  }
})

const countOptions = computed(() => {
  const total = totalItems.value
  if (total <= 5)
    return [Math.max(total, 1)]

  const options = Array.from({ length: Math.floor(total / 5) }, (_, index) => (index + 1) * 5)
  if (options[options.length - 1] !== total)
    options.push(total)
  return options
})

const selectedCountIndex = computed(() => {
  const index = countOptions.value.indexOf(selectedCount.value)
  return index >= 0 ? index : 0
})

const selectedCountLabel = computed(() => selectedCount.value === totalItems.value
  ? t('study.allCount', { count: totalItems.value })
  : `${selectedCount.value} ${t('home.wordUnit')}`)

function updateSelectedCount(event: Event) {
  const index = Number((event.target as HTMLInputElement).value)
  selectedCount.value = countOptions.value[index] ?? countOptions.value[0] ?? 1
}

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
      <div class="flex items-center justify-between rounded-2xl bg-ink-100/70 p-4 dark:bg-ink-900/70">
        <div class="space-y-1">
          <p class="text-xs font-black uppercase tracking-wider text-ink-400">
            {{ $t('learning.learned') }}
          </p>
          <p class="text-xl font-black text-ink-950 dark:text-ink-50">
            {{ learnedCount }}/{{ totalItems }}
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

      <div>
        <p class="mb-3 text-xs font-black uppercase tracking-wider text-ink-400">
          {{ $t('study.chooseStepTitle') }}
        </p>
        <div class="grid gap-3">
          <div
            class="flex cursor-pointer items-center justify-between rounded-2xl border p-4 transition-all duration-200"
            :class="selectedMode === 'flashcard' ? 'border-accent-primary bg-accent-primary/10 shadow-soft' : 'border-ink-200/60 dark:border-ink-800 hover:border-accent-primary/40'"
            @click="selectedMode = 'flashcard'"
          >
            <div class="flex items-center gap-3 min-w-0">
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

          <div
            class="flex cursor-pointer items-center justify-between rounded-2xl border p-4 transition-all duration-200"
            :class="selectedMode === 'quiz' ? 'border-accent-primary bg-accent-primary/10 shadow-soft' : 'border-ink-200/60 dark:border-ink-800 hover:border-accent-primary/40'"
            @click="selectedMode = 'quiz'"
          >
            <div class="flex items-center gap-3 min-w-0">
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

          <div
            class="flex cursor-pointer items-center justify-between rounded-2xl border p-4 transition-all duration-200"
            :class="selectedMode === 'spelling' ? 'border-accent-primary bg-accent-primary/10 shadow-soft' : 'border-ink-200/60 dark:border-ink-800 hover:border-accent-primary/40'"
            @click="selectedMode = 'spelling'"
          >
            <div class="flex items-center gap-3 min-w-0">
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
        <label class="flex items-center justify-between text-xs font-black uppercase tracking-wider text-ink-400">
          <span>{{ $t('practice.countLabel') }}</span>
          <span class="text-ink-950 dark:text-ink-50">{{ selectedCountLabel }}</span>
        </label>
        <input
          type="range"
          :min="0"
          :max="Math.max(0, countOptions.length - 1)"
          :step="1"
          :value="selectedCountIndex"
          class="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-ink-200 accent-accent-primary dark:bg-ink-800"
          :aria-label="$t('practice.countLabel')"
          @input="updateSelectedCount"
        >
        <div class="flex justify-between text-[11px] font-semibold text-ink-400">
          <span>{{ countOptions[0] }} {{ $t('home.wordUnit') }}</span>
          <span>{{ selectedCountLabel }}</span>
          <span>{{ countOptions[countOptions.length - 1] }} {{ $t('home.wordUnit') }}</span>
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

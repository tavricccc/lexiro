<script setup lang="ts">
import type { PracticeDifficulty, PracticeMode } from '@/types'
import { BookOpenText, CheckCircle2, FileText } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { createPracticeDifficultyOptions } from '@/lib/question-options'
import { useSessionStore } from '@/stores/session'
import Button from '../ui/button/Button.vue'
import Dialog from '../ui/dialog/Dialog.vue'
import DialogFooter from '../ui/dialog/DialogFooter.vue'
import Select from '../ui/select/Select.vue'

const props = defineProps<{
  open: boolean
  setId: string
  initialMode?: PracticeMode
  initialDifficulty?: PracticeDifficulty
}>()

const emit = defineEmits<{
  close: []
}>()

const router = useRouter()
const sessionStore = useSessionStore()
const { t } = useI18n()
const selectedMode = ref<PracticeMode>(props.initialMode ?? 'quiz')
const selectedDifficulty = ref<PracticeDifficulty>(props.initialDifficulty ?? 'all')
const selectedCount = ref(0)
const difficultyOptions = computed(() => createPracticeDifficultyOptions(t))
const difficultyModel = computed({
  get: () => String(selectedDifficulty.value),
  set: (value: string) => {
    selectedDifficulty.value = value === 'all' ? 'all' : Number(value) as 1 | 2 | 3
  },
})
const modeOptions = [
  { value: 'quiz' as const, label: 'practice.quiz', icon: CheckCircle2 },
  { value: 'fillBlank' as const, label: 'practice.fillBlank', icon: FileText },
  { value: 'reading' as const, label: 'practice.reading', icon: BookOpenText },
]
const availableCount = computed(() => sessionStore.getAvailablePracticeCount(props.setId, selectedMode.value, selectedDifficulty.value))
const countOptions = computed(() => {
  const total = availableCount.value
  if (total <= 5)
    return [Math.max(0, total)]
  const options = Array.from({ length: Math.floor(total / 5) }, (_, index) => (index + 1) * 5)
  if (options.at(-1) !== total)
    options.push(total)
  return options
})
const selectedCountIndex = computed(() => Math.max(0, countOptions.value.indexOf(Math.min(selectedCount.value, countOptions.value.at(-1) ?? 0))))

function syncCount() {
  if (props.initialMode)
    selectedMode.value = props.initialMode
  if (props.initialDifficulty)
    selectedDifficulty.value = props.initialDifficulty
  selectedCount.value = sessionStore.getPracticeCount(availableCount.value)
}

watch([() => props.open, () => props.setId, selectedMode, selectedDifficulty], ([open]) => {
  if (open)
    syncCount()
}, { immediate: true })

function updateSelectedCount(event: Event) {
  selectedCount.value = countOptions.value[Number((event.target as HTMLInputElement).value)] ?? 0
}

function startPractice() {
  if (!availableCount.value || !selectedCount.value)
    return
  sessionStore.handlePracticeCountChange(selectedCount.value, availableCount.value)
  emit('close')
  void sessionStore.startRound(selectedMode.value, props.setId, null, selectedDifficulty.value)
}

function openQuestions() {
  emit('close')
  void router.push({ name: 'set-questions', params: { setId: props.setId } })
}
</script>

<template>
  <Dialog
    :open="open"
    :title="$t('practice.startTitle')"
    :description="$t('set.practiceDescription')"
    size="md"
    presentation="responsive-sheet"
    @close="emit('close')"
  >
    <div class="space-y-5 py-2">
      <fieldset class="space-y-2">
        <legend class="text-xs font-black uppercase tracking-wider text-ink-400">
          {{ $t('set.practiceType') }}
        </legend>
        <div class="grid gap-2 sm:grid-cols-3">
          <button
            v-for="option in modeOptions"
            :key="option.value"
            type="button"
            class="flex min-h-11 items-center gap-2 rounded-2xl border px-3 py-2.5 text-left text-sm font-bold transition-colors"
            :class="selectedMode === option.value ? 'border-accent-primary bg-accent-primary/10 text-accent-primary' : 'border-ink-200/70 hover:border-accent-primary/40 dark:border-ink-200/20'"
            @click="selectedMode = option.value"
          >
            <component :is="option.icon" class="h-4 w-4 shrink-0" />
            <span class="truncate">{{ $t(option.label) }}</span>
          </button>
        </div>
      </fieldset>

      <div class="space-y-2">
        <label for="practice-difficulty" class="text-xs font-black uppercase tracking-wider text-ink-400">
          {{ $t('set.practiceDifficulty') }}
        </label>
        <Select id="practice-difficulty" v-model="difficultyModel" :options="difficultyOptions" />
      </div>

      <div class="space-y-2">
        <label for="practice-count" class="flex items-center justify-between text-xs font-black uppercase tracking-wider text-ink-400">
          <span>{{ $t('set.practiceCount') }}</span>
          <span class="text-ink-950 dark:text-ink-50">{{ $t('set.selectedPracticeCount', { count: selectedCount }) }}</span>
        </label>
        <input id="practice-count" type="range" :min="0" :max="Math.max(countOptions.length - 1, 0)" :value="selectedCountIndex" class="h-2 w-full cursor-pointer appearance-none rounded-full bg-ink-200 accent-accent-primary dark:bg-ink-800" :disabled="!availableCount" @input="updateSelectedCount">
        <div class="flex justify-between text-[11px] font-semibold text-ink-400">
          <span>{{ countOptions[0] ?? 0 }}</span>
          <span>{{ countOptions.at(-1) ?? 0 }}</span>
        </div>
      </div>

      <div v-if="!availableCount" class="rounded-2xl border border-dashed border-ink-200/80 px-4 py-5 text-center text-sm font-semibold text-ink-500 dark:border-ink-200/20">
        <p>{{ $t('set.noPracticeQuestions') }}</p>
        <Button variant="ghost" class="mt-2" @click="openQuestions">
          {{ $t('set.openQuestions') }}
        </Button>
      </div>
    </div>

    <template #footer>
      <DialogFooter>
        <Button variant="outline" class="w-full sm:w-auto" @click="emit('close')">
          {{ $t('editor.cancel') }}
        </Button>
        <Button class="w-full sm:w-auto" :disabled="!availableCount || !selectedCount" @click="startPractice">
          {{ $t('practice.confirmStart') }}
        </Button>
      </DialogFooter>
    </template>
  </Dialog>
</template>

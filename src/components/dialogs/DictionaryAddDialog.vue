<script setup lang="ts">
import type { DictionaryEntry, WordEntry } from '@/types'
import { Plus, Trash2 } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { dictionaryDefinitions } from '@/lib/dictionary'
import { useDirtyForm } from '@/lib/dirty-form'
import { buildSenseId, mergeUniqueStrings, normalizePartOfSpeech, normalizeWordKey } from '@/lib/library'
import { useLibraryStore } from '@/stores/library'
import { useSetsStore } from '@/stores/sets'
import Button from '../ui/button/Button.vue'
import Dialog from '../ui/dialog/Dialog.vue'
import DialogFooter from '../ui/dialog/DialogFooter.vue'
import Input from '../ui/input/Input.vue'
import Select from '../ui/select/Select.vue'
import StatusMessage from '../ui/status-message/StatusMessage.vue'
import Textarea from '../ui/textarea/Textarea.vue'

type Step = 1 | 2 | 3 | 4
type TargetSense = string | 'new'
type ApiDefinition = ReturnType<typeof dictionaryDefinitions>[number]

interface ExampleDraft {
  id: string
  text: string
  selected: boolean
  targetSenseId: TargetSense
}

interface SenseDraft {
  id: string
  pos: string
  meaningZh: string
  selected: boolean
  examples: ExampleDraft[]
}

interface PreviewSense {
  id: string
  pos: string
  meaningZh: string
  examples: string[]
  existing: boolean
}

const props = defineProps<{
  open: boolean
  word: string
  entries: DictionaryEntry[]
  existingWord: WordEntry | null
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const { t } = useI18n()
const libraryStore = useLibraryStore()
const setsStore = useSetsStore()
const { sets } = storeToRefs(setsStore)
const step = ref<Step>(1)
const targetSetIds = ref<string[]>([])
const drafts = ref<SenseDraft[]>([])
const error = ref('')
const initialDraftSnapshot = ref('')
const dirtyFormId = `dictionary-add-${useId().replace(/:/g, '-')}`

const selectedDrafts = computed(() => drafts.value.filter(draft => draft.selected))
const existingSenses = computed(() => props.existingWord?.senses ?? [])
const senseOptions = computed(() => [
  { value: 'new', label: t('dictionary.newSense') },
  ...existingSenses.value.map(sense => ({ value: sense.id, label: `${sense.pos}｜${sense.meaningZh}` })),
])
const previewSenses = computed<PreviewSense[]>(() => {
  const grouped = new Map<string, PreviewSense>()
  for (const draft of selectedDrafts.value) {
    const selectedExamples = draft.examples.filter(example => example.selected && example.text.trim())
    const targets = selectedExamples.length ? selectedExamples : [{ targetSenseId: 'new' as const, text: '' }]
    for (const example of targets) {
      const targetId = example.targetSenseId
      const existing = targetId !== 'new' ? existingSenses.value.find(sense => sense.id === targetId) : undefined
      const id = existing?.id ?? buildSenseId(props.word, draft.pos, draft.meaningZh)
      const current = grouped.get(id)
      const nextExamples = mergeUniqueStrings(current?.examples ?? [], example.text ? [example.text] : [])
      grouped.set(id, {
        id,
        pos: existing?.pos ?? normalizePartOfSpeech(draft.pos),
        meaningZh: existing?.meaningZh ?? draft.meaningZh.trim(),
        examples: nextExamples,
        existing: Boolean(existing),
      })
    }
  }
  return Array.from(grouped.values())
})

const setOptions = computed(() => sets.value.map(set => ({ value: set.id, label: set.setName })))

watch(() => props.open, (open) => {
  if (open)
    reset()
})

function draftFromDefinition(definition: ApiDefinition, index: number): SenseDraft {
  return {
    id: `dictionary-sense-${crypto.randomUUID()}`,
    pos: definition.partOfSpeech,
    meaningZh: '',
    selected: true,
    examples: definition.example
      ? [{ id: `dictionary-example-${index}-${crypto.randomUUID()}`, text: definition.example, selected: true, targetSenseId: 'new' }]
      : [],
  }
}

function reset() {
  step.value = 1
  targetSetIds.value = []
  error.value = ''
  const definitions = props.entries.flatMap(entry => dictionaryDefinitions(entry))
  drafts.value = definitions.map((definition, index) => draftFromDefinition(definition, index))
  initialDraftSnapshot.value = draftSnapshot()
}

function close() {
  error.value = ''
  emit('close')
}

function toggleSet(setId: string) {
  targetSetIds.value = targetSetIds.value.includes(setId)
    ? targetSetIds.value.filter(id => id !== setId)
    : [...targetSetIds.value, setId]
}

function addExample(draft: SenseDraft) {
  draft.examples.push({ id: `dictionary-example-${crypto.randomUUID()}`, text: '', selected: true, targetSenseId: 'new' })
}

function removeExample(draft: SenseDraft, index: number) {
  draft.examples.splice(index, 1)
}

function next() {
  error.value = ''
  if (step.value === 1 && !targetSetIds.value.length) {
    error.value = t('dictionary.selectAtLeastOneSet')
    return
  }
  if (step.value === 2) {
    if (!selectedDrafts.value.length) {
      error.value = t('dictionary.selectAtLeastOneSource')
      return
    }
    if (selectedDrafts.value.some(draft => !normalizePartOfSpeech(draft.pos))) {
      error.value = t('dictionary.invalidPartOfSpeech')
      return
    }
  }
  if (step.value === 3 && previewSenses.value.some(sense => !sense.existing && (!sense.pos || !sense.meaningZh))) {
    error.value = t('dictionary.senseFieldsRequired')
    return
  }
  if (step.value < 4)
    step.value = (step.value + 1) as Step
}

function back() {
  error.value = ''
  if (step.value > 1)
    step.value = (step.value - 1) as Step
}

function draftSnapshot(): string {
  return JSON.stringify({ step: step.value, targetSetIds: targetSetIds.value, drafts: drafts.value })
}

const draftDirty = computed(() => props.open && initialDraftSnapshot.value !== draftSnapshot())

function save(): boolean {
  if (!previewSenses.value.length) {
    error.value = t('dictionary.selectAtLeastOneSource')
    return false
  }
  const wordKey = normalizeWordKey(props.word)
  const current = libraryStore.getWord(wordKey)
  const incomingSenses = previewSenses.value.map(sense => ({
    id: sense.id,
    pos: sense.pos,
    meaningZh: sense.meaningZh,
    examples: sense.examples,
  }))
  try {
    libraryStore.addWordToSets({
      wordKey,
      word: current?.word ?? props.word.trim(),
      senses: incomingSenses,
      updatedAt: new Date().toISOString(),
    }, targetSetIds.value.map(setId => ({ setId, membership: { wordKey, senseIds: incomingSenses.map(sense => sense.id) } })))
  }
  catch {
    error.value = t('dictionary.saveFailed')
    return false
  }
  initialDraftSnapshot.value = draftSnapshot()
  emit('saved')
  emit('close')
  return true
}

useDirtyForm({
  id: dirtyFormId,
  isDirty: () => draftDirty.value,
  save,
  discard: close,
})
</script>

<template>
  <Dialog :open="open" :title="$t('dictionary.addDialogTitle')" :description="$t('dictionary.addDialogDescription')" width-class="max-w-2xl" @close="close">
    <div class="space-y-5">
      <ol class="grid grid-cols-4 gap-2" :aria-label="$t('dictionary.addProgress')">
        <li v-for="number in 4" :key="number" class="rounded-xl border px-2 py-2 text-center text-[11px] font-bold" :class="number <= step ? 'border-accent-primary/25 bg-accent-primary/10 text-accent-primary' : 'border-ink-200/60 text-ink-400 dark:border-ink-200/20'">
          {{ number }}. {{ $t(`dictionary.addStep${number}`) }}
        </li>
      </ol>

      <div v-if="step === 1" class="space-y-3">
        <p class="text-sm font-bold">
          {{ $t('dictionary.chooseSets') }}
        </p>
        <label v-for="option in setOptions" :key="option.value" class="flex cursor-pointer items-center gap-3 rounded-xl border border-ink-200/70 p-3 dark:border-ink-200/20">
          <input type="checkbox" :checked="targetSetIds.includes(option.value)" @change="toggleSet(option.value)">
          <span class="text-sm font-semibold">{{ option.label }}</span>
        </label>
        <p v-if="!setOptions.length" class="text-sm font-semibold text-ink-500">
          {{ $t('dictionary.noSets') }}
        </p>
      </div>

      <div v-else-if="step === 2" class="space-y-3">
        <p class="text-sm font-bold">
          {{ $t('dictionary.chooseSources') }}
        </p>
        <article v-for="draft in drafts" :key="draft.id" class="space-y-3 rounded-2xl border border-ink-200/70 p-4 dark:border-ink-200/20">
          <label class="flex items-center gap-3">
            <input v-model="draft.selected" type="checkbox">
            <span class="text-xs font-black uppercase tracking-wider text-ink-500">{{ $t('dictionary.sourceMeaning') }}</span>
          </label>
          <div class="grid gap-3 sm:grid-cols-2">
            <Input v-model="draft.pos" :placeholder="$t('editor.pos')" />
            <Input v-model="draft.meaningZh" :placeholder="$t('dictionary.meaningRequired')" />
          </div>
          <div class="space-y-2">
            <div v-for="(example, index) in draft.examples" :key="example.id" class="flex items-start gap-2">
              <input v-model="example.selected" type="checkbox" class="mt-3">
              <Textarea v-model="example.text" :rows="2" class="min-w-0" :placeholder="$t('editor.examplePlaceholder')" />
              <Button variant="ghost" size="icon" class="h-11 w-11 shrink-0 text-red-500" :aria-label="$t('editor.removeExample')" @click="removeExample(draft, index)">
                <Trash2 class="h-4 w-4" />
              </Button>
            </div>
            <Button variant="ghost" size="sm" class="gap-1" @click="addExample(draft)">
              <Plus class="h-3.5 w-3.5" />{{ $t('editor.addExample') }}
            </Button>
          </div>
        </article>
      </div>

      <div v-else-if="step === 3" class="space-y-3">
        <p class="text-sm font-bold">
          {{ $t('dictionary.assignExamples') }}
        </p>
        <article v-for="draft in selectedDrafts" :key="draft.id" class="space-y-3 rounded-2xl border border-ink-200/70 p-4 dark:border-ink-200/20">
          <p class="text-sm font-bold">
            {{ draft.pos }}<span v-if="draft.meaningZh"> · {{ draft.meaningZh }}</span>
          </p>
          <div v-for="example in draft.examples.filter(item => item.selected && item.text.trim())" :key="example.id" class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_15rem] sm:items-center">
            <p class="text-sm italic text-ink-500">
              “{{ example.text }}”
            </p>
            <Select v-model="example.targetSenseId" :options="senseOptions" :placeholder="$t('dictionary.assignTo')" />
          </div>
          <p v-if="!draft.examples.some(item => item.selected && item.text.trim())" class="text-xs font-semibold text-ink-500">
            {{ $t('dictionary.noExamplesSelected') }}
          </p>
        </article>
      </div>

      <div v-else class="space-y-3">
        <p class="text-sm font-bold">
          {{ $t('dictionary.reviewAdd') }}
        </p>
        <p class="text-xs font-semibold text-ink-500">
          {{ props.word }} · {{ targetSetIds.length }} {{ $t('dictionary.setCount') }}
        </p>
        <article v-for="sense in previewSenses" :key="sense.id" class="surface-inset space-y-2 p-4">
          <p class="font-bold">
            {{ sense.pos }} · {{ sense.meaningZh }} <span v-if="sense.existing" class="text-xs font-semibold text-accent-primary">({{ $t('dictionary.existingSense') }})</span>
          </p>
          <ul v-if="sense.examples.length" class="space-y-1 text-sm italic text-ink-500">
            <li v-for="example in sense.examples" :key="example">
              “{{ example }}”
            </li>
          </ul>
        </article>
      </div>

      <StatusMessage v-if="error" tone="error">
        {{ error }}
      </StatusMessage>
    </div>

    <template #footer>
      <DialogFooter>
        <Button variant="outline" @click="close">
          {{ $t('editor.cancel') }}
        </Button>
        <Button v-if="step > 1" variant="ghost" @click="back">
          {{ $t('dictionary.previousStep') }}
        </Button>
        <Button v-if="step < 4" variant="default" @click="next">
          {{ $t('dictionary.nextStep') }}
        </Button>
        <Button v-else variant="default" @click="save">
          {{ $t('dictionary.confirmAdd') }}
        </Button>
      </DialogFooter>
    </template>
  </Dialog>
</template>

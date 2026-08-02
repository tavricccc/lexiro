<script setup lang="ts">
import type { SenseEditValue, WordSense } from '@/types'
import { Plus, Trash2 } from 'lucide-vue-next'
import { computed, ref, useId, watch } from 'vue'
import { useDirtyForm } from '@/lib/dirty-form'
import Button from '../ui/button/Button.vue'
import Dialog from '../ui/dialog/Dialog.vue'
import DialogFooter from '../ui/dialog/DialogFooter.vue'
import Input from '../ui/input/Input.vue'
import StatusMessage from '../ui/status-message/StatusMessage.vue'
import Textarea from '../ui/textarea/Textarea.vue'

const props = withDefaults(defineProps<{
  open: boolean
  sense: WordSense | null
  error?: string
  busy?: boolean
  saveHandler?: (value: SenseEditValue) => boolean | Promise<boolean>
}>(), {
  error: '',
  busy: false,
})

const emit = defineEmits<{
  close: []
  save: [value: SenseEditValue]
}>()

const idPrefix = useId().replace(/:/g, '-')
const draft = ref<SenseEditValue>({ pos: '', meaningZh: '', examples: [] })
const initialDraftSnapshot = ref('')
const saving = ref(false)
const isBusy = computed(() => props.busy || saving.value)

function syncDraft() {
  draft.value = props.sense
    ? { pos: props.sense.pos, meaningZh: props.sense.meaningZh, examples: [...props.sense.examples] }
    : { pos: '', meaningZh: '', examples: [] }
  initialDraftSnapshot.value = draftSnapshot()
}

watch(() => [props.open, props.sense?.id] as const, ([open]) => {
  if (open)
    syncDraft()
}, { immediate: true })

function addExample() {
  draft.value.examples.push('')
}

function removeExample(index: number) {
  draft.value.examples.splice(index, 1)
}

function draftSnapshot(): string {
  return JSON.stringify(draft.value)
}

const draftDirty = computed(() => props.open && initialDraftSnapshot.value !== draftSnapshot())

async function save(): Promise<boolean> {
  if (isBusy.value)
    return false
  const value = {
    pos: draft.value.pos,
    meaningZh: draft.value.meaningZh,
    examples: [...draft.value.examples],
  }
  saving.value = true
  try {
    const saved = props.saveHandler
      ? await props.saveHandler(value)
      : (emit('save', value), true)
    if (saved)
      initialDraftSnapshot.value = draftSnapshot()
    return saved
  }
  catch {
    return false
  }
  finally {
    saving.value = false
  }
}

useDirtyForm({
  id: `sense-editor-${idPrefix}`,
  isDirty: () => draftDirty.value,
  save,
  discard: () => emit('close'),
})
</script>

<template>
  <Dialog
    :open="open"
    :title="$t('vocabulary.editSense')"
    :description="$t('vocabulary.editSenseDescription')"
    size="lg"
    presentation="responsive-sheet"
    :busy="isBusy"
    :initial-focus="`#${idPrefix}-pos`"
    @close="emit('close')"
  >
    <div class="space-y-5">
      <StatusMessage v-if="error" tone="error">
        {{ error }}
      </StatusMessage>

      <div class="grid gap-4 sm:grid-cols-2">
        <label class="block text-sm font-bold" :for="`${idPrefix}-pos`">
          {{ $t('editor.pos') }}
          <Input :id="`${idPrefix}-pos`" v-model="draft.pos" class="mt-2" />
        </label>
        <label class="block text-sm font-bold" :for="`${idPrefix}-meaning`">
          {{ $t('editor.meaning') }}
          <Input :id="`${idPrefix}-meaning`" v-model="draft.meaningZh" class="mt-2" />
        </label>
      </div>

      <section class="space-y-3" :aria-labelledby="`${idPrefix}-examples-title`">
        <div class="flex items-center justify-between gap-3">
          <h3 :id="`${idPrefix}-examples-title`" class="text-sm font-black">
            {{ $t('editor.examples') }}
          </h3>
          <Button variant="outline" class="min-h-11 gap-2" :disabled="isBusy" @click="addExample">
            <Plus class="h-4 w-4" />{{ $t('editor.addExample') }}
          </Button>
        </div>

        <div v-if="draft.examples.length" class="space-y-3">
          <div v-for="(_, index) in draft.examples" :key="index" class="flex items-start gap-2">
            <Textarea v-model="draft.examples[index]" :rows="2" class="min-w-0 flex-1" :placeholder="$t('editor.examplePlaceholder')" />
            <Button
              variant="ghost"
              size="icon"
              class="h-11 w-11 shrink-0 text-red-500"
              :disabled="isBusy"
              :aria-label="$t('editor.removeExample')"
              @click="removeExample(index)"
            >
              <Trash2 class="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p v-else class="rounded-2xl border border-dashed border-ink-200/70 px-4 py-5 text-sm font-semibold text-ink-400 dark:border-ink-200/20">
          {{ $t('editor.noExamples') }}
        </p>
      </section>
    </div>

    <template #footer>
      <DialogFooter>
        <Button variant="outline" :disabled="isBusy" @click="emit('close')">
          {{ $t('editor.cancel') }}
        </Button>
        <Button :loading="isBusy" @click="save">
          {{ $t('editor.save') }}
        </Button>
      </DialogFooter>
    </template>
  </Dialog>
</template>

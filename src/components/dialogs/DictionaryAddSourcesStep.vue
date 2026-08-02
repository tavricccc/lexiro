<script setup lang="ts">
import type { SenseDraft } from './dictionary-add-types'
import { Plus, Trash2 } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import Button from '../ui/button/Button.vue'
import Input from '../ui/input/Input.vue'
import Textarea from '../ui/textarea/Textarea.vue'

defineProps<{
  drafts: SenseDraft[]
}>()

const emit = defineEmits<{
  addExample: [draft: SenseDraft]
  removeExample: [draft: SenseDraft, index: number]
}>()

const { t } = useI18n()
</script>

<template>
  <div class="space-y-3">
    <p class="text-sm font-bold">
      {{ t('dictionary.chooseSources') }}
    </p>
    <article v-for="draft in drafts" :key="draft.id" class="space-y-3 rounded-2xl border border-ink-200/70 p-4 dark:border-ink-200/20">
      <label class="flex items-center gap-3">
        <input v-model="draft.selected" type="checkbox">
        <span class="text-xs font-black uppercase tracking-wider text-ink-500">{{ t('dictionary.sourceMeaning') }}</span>
      </label>
      <div class="grid gap-3 sm:grid-cols-2">
        <Input v-model="draft.pos" :placeholder="t('editor.pos')" />
        <Input v-model="draft.meaningZh" :placeholder="t('dictionary.meaningRequired')" />
      </div>
      <div class="space-y-2">
        <div v-for="(example, index) in draft.examples" :key="example.id" class="flex items-start gap-2">
          <input v-model="example.selected" type="checkbox" class="mt-3">
          <Textarea v-model="example.text" :rows="2" class="min-w-0" :placeholder="t('editor.examplePlaceholder')" />
          <Button variant="ghost" size="icon" class="h-11 w-11 shrink-0 text-red-500" :aria-label="t('editor.removeExample')" @click="emit('removeExample', draft, index)">
            <Trash2 class="h-4 w-4" />
          </Button>
        </div>
        <Button variant="ghost" size="sm" class="gap-1" @click="emit('addExample', draft)">
          <Plus class="h-3.5 w-3.5" />{{ t('editor.addExample') }}
        </Button>
      </div>
    </article>
  </div>
</template>

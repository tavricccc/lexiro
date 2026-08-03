<script setup lang="ts">
import type { QuestionCreateChoice } from '@/types'
import { BookOpenText, ChevronRight, ListChecks } from 'lucide-vue-next'
import Button from '../ui/button/Button.vue'
import Dialog from '../ui/dialog/Dialog.vue'

defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
  choose: [choice: QuestionCreateChoice]
}>()
</script>

<template>
  <Dialog
    :open="open"
    :title="$t('questionCreate.title')"
    :description="$t('questionCreate.description')"
    presentation="center"
    width-class="max-w-sm"
    @close="emit('close')"
  >
    <div class="grid gap-2">
      <Button variant="outline" class="w-full justify-start gap-3 p-3 text-left" @click="emit('choose', 'question')">
        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-primary/10 text-accent-primary">
          <ListChecks class="h-5 w-5" aria-hidden="true" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-black text-ink-900 dark:text-ink-50">{{ $t('questionCreate.question') }}</span>
          <span class="mt-0.5 block text-xs font-medium text-ink-500 dark:text-ink-400">{{ $t('questionCreate.questionHint') }}</span>
        </span>
        <ChevronRight class="h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
      </Button>
      <Button variant="outline" class="w-full justify-start gap-3 p-3 text-left" @click="emit('choose', 'reading')">
        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-primary/10 text-accent-primary">
          <BookOpenText class="h-5 w-5" aria-hidden="true" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-black text-ink-900 dark:text-ink-50">{{ $t('questionCreate.reading') }}</span>
          <span class="mt-0.5 block text-xs font-medium text-ink-500 dark:text-ink-400">{{ $t('questionCreate.readingHint') }}</span>
        </span>
        <ChevronRight class="h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
      </Button>
    </div>
  </Dialog>
</template>

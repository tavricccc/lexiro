<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useSessionStore } from '@/stores/session'
import { useSetsStore } from '@/stores/sets'
import Button from '../ui/button/Button.vue'
import Dialog from '../ui/dialog/Dialog.vue'

const sessionStore = useSessionStore()
const setsStore = useSetsStore()
const { practiceDialogOpen, practiceDialogSetId, practiceDialogCount } = storeToRefs(sessionStore)
const { closePracticeDialog, confirmPracticeDialog } = sessionStore
const { sets } = storeToRefs(setsStore)
</script>

<template>
  <Dialog
    :open="practiceDialogOpen"
    :title="$t('practice.startTitle')"
    :description="$t('practice.countLabel')"
    @close="closePracticeDialog"
  >
    <div v-if="practiceDialogSetId && sets.find((set) => set.id === practiceDialogSetId)" class="space-y-6">
      <div class="rounded-2xl border border-ink-200/60 dark:border-ink-200/5 bg-ink-100 dark:bg-ink-100/50 p-5 text-left relative overflow-hidden">
        <div class="flex items-center justify-between gap-3 relative z-10">
          <div class="space-y-1">
            <p class="text-xs font-extrabold uppercase tracking-widest text-accent-primary">
              {{ $t('practice.countLabel') }}
            </p>
            <p class="text-xl font-extrabold text-ink-950 dark:text-ink-50">
              {{ practiceDialogCount }} <span class="text-xs text-ink-400">/ {{ $t('practice.questions', { count: sets.find((set) => set.id === practiceDialogSetId)?.items.length ?? 1 }) }}</span>
            </p>
          </div>
        </div>

        <input
          v-model.number="practiceDialogCount"
          class="mt-5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-200 dark:bg-ink-200/40 accent-accent-primary focus:outline-none relative z-10"
          type="range"
          min="1"
          :max="sets.find((set) => set.id === practiceDialogSetId)?.items.length ?? 1"
        >
      </div>

      <div class="flex justify-end gap-2 pt-2 border-t border-ink-200/40 dark:border-ink-200/10">
        <Button variant="outline" class="rounded-xl border-ink-200 dark:border-ink-200/40" @click="closePracticeDialog">
          {{ $t('editor.cancel') }}
        </Button>
        <Button variant="default" class="rounded-xl" @click="confirmPracticeDialog">
          {{ $t('practice.confirmStart') }}
        </Button>
      </div>
    </div>
  </Dialog>
</template>

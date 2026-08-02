<script setup lang="ts">
import type { SenseRemovalImpact } from '@/lib/sense-impact'
import Button from '../ui/button/Button.vue'
import Dialog from '../ui/dialog/Dialog.vue'
import DialogFooter from '../ui/dialog/DialogFooter.vue'

defineProps<{
  open: boolean
  setName: string
  otherSetNames: string[]
  impact: SenseRemovalImpact | null
}>()

const emit = defineEmits<{
  cancel: []
  confirm: []
}>()
</script>

<template>
  <Dialog
    :open="open"
    :title="$t('vocabulary.deleteSenseTitle')"
    :description="$t('vocabulary.deleteSenseImpactDescription')"
    presentation="center"
    tone="destructive"
    size="sm"
    :show-close="false"
    @close="emit('cancel')"
  >
    <div v-if="impact" class="space-y-3 text-sm font-semibold text-ink-600 dark:text-ink-300">
      <p v-if="otherSetNames.length">
        {{ $t('vocabulary.deleteSenseImpactSets', { sets: otherSetNames.join('、') }) }}
      </p>
      <p v-if="impact.questionCount">
        {{ $t('vocabulary.deleteSenseImpactQuestions', { count: impact.questionCount }) }}
      </p>
      <p v-if="impact.isLastSenseInSet">
        {{ $t('vocabulary.deleteSenseImpactLastSense') }}
      </p>
      <p v-if="impact.removesSet" class="font-bold text-red-600 dark:text-red-400">
        {{ $t('vocabulary.deleteSenseImpactLastWord') }}
      </p>
      <p v-if="setName" class="text-xs text-ink-400">
        {{ setName }}
      </p>
    </div>

    <template #footer>
      <DialogFooter>
        <Button variant="outline" @click="emit('cancel')">
          {{ $t('confirm.cancel') }}
        </Button>
        <Button variant="destructive" @click="emit('confirm')">
          {{ $t('vocabulary.confirmDeleteSense') }}
        </Button>
      </DialogFooter>
    </template>
  </Dialog>
</template>

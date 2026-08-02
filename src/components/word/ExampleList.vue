<script setup lang="ts">
import { Pencil, Plus, Trash2 } from 'lucide-vue-next'
import Button from '../ui/button/Button.vue'

const props = withDefaults(defineProps<{
  examples: string[]
  editable?: boolean
}>(), {
  editable: false,
})

const emit = defineEmits<{
  edit: [index: number]
  add: []
  delete: [index: number]
}>()
</script>

<template>
  <div class="space-y-2">
    <ul v-if="examples.length" class="space-y-2 border-l-2 border-accent-primary/30 pl-4 text-sm text-ink-700 dark:text-ink-200">
      <li v-for="(example, index) in examples" :key="`${example}-${index}`" class="flex min-h-11 items-start gap-2">
        <span class="min-w-0 flex-1 leading-relaxed">{{ example }}</span>
        <template v-if="props.editable">
          <Button variant="ghost" size="icon" class="h-11 w-11 shrink-0" :aria-label="$t('vocabulary.editExample')" @click="emit('edit', index)">
            <Pencil class="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" class="h-11 w-11 shrink-0 text-red-500" :aria-label="$t('vocabulary.deleteExample')" @click="emit('delete', index)">
            <Trash2 class="h-3.5 w-3.5" />
          </Button>
        </template>
      </li>
    </ul>
    <Button v-if="props.editable" variant="ghost" size="sm" class="gap-1" @click="emit('add')">
      <Plus class="h-3.5 w-3.5" />{{ $t('vocabulary.addExample') }}
    </Button>
  </div>
</template>

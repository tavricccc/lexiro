<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Badge from './ui/badge/Badge.vue'

const props = defineProps<{
  item: { id?: string, word: string, pos: string, meaning: string, example: string } | null
  index: number
  flipped?: boolean
}>()

const emit = defineEmits<{
  'update:flipped': [value: boolean]
}>()

const localFlipped = ref(false)

watch(() => [props.item?.id, props.item?.word, props.index] as const, () => {
  localFlipped.value = false
  emit('update:flipped', false)
})

watch(() => props.flipped, (val) => {
  if (typeof val === 'boolean')
    localFlipped.value = val
})

const isFlipped = computed(() =>
  typeof props.flipped === 'boolean' ? props.flipped : localFlipped.value,
)

function toggle() {
  const next = !isFlipped.value
  localFlipped.value = next
  emit('update:flipped', next)
}
</script>

<template>
  <div
    v-if="item"
    class="flashcard-scene"
    role="button"
    tabindex="0"
    :aria-pressed="isFlipped"
    :aria-label="$t('flashcard.flip')"
    @click="toggle"
    @keydown.space.prevent="toggle"
  >
    <div class="flashcard-inner" :class="{ 'is-flipped': isFlipped }">
      <div class="flashcard-face flashcard-front">
        <Badge variant="secondary" class="flashcard-index">
          {{ $t('flashcard.cardIndex', { index: index + 1 }) }}
        </Badge>
        <h2 class="flashcard-word">
          {{ item.word }}
        </h2>
        <Badge v-if="item.pos" variant="default" class="text-xs uppercase tracking-wider font-semibold rounded-lg px-2.5 py-0.5">
          {{ item.pos }}
        </Badge>
        <p class="flashcard-hint">
          {{ $t('flashcard.tapToFlip') }}
        </p>
      </div>

      <div class="flashcard-face flashcard-back">
        <Badge variant="secondary" class="flashcard-index">
          {{ $t('flashcard.cardIndex', { index: index + 1 }) }}
        </Badge>
        <div class="flashcard-block flashcard-block-primary">
          <p class="flashcard-label text-accent-primary">
            {{ $t('flashcard.meaning') }}
          </p>
          <p class="flashcard-body">
            {{ item.meaning }}
          </p>
        </div>
        <div class="flashcard-block flashcard-block-muted">
          <p class="flashcard-label text-ink-400 dark:text-ink-500">
            {{ $t('flashcard.example') }}
          </p>
          <p class="flashcard-example">
            {{ item.example }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

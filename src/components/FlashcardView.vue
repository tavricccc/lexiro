<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Badge from './ui/badge/Badge.vue'

const props = defineProps<{
  item: { id?: string, word: string, pos: string, meaning: string, example: string, phonetic?: string, audioUrl?: string, senses?: { id: string, pos: string, meaningZh: string, definitionEn?: string, examples: string[] }[] } | null
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
        <div v-if="item.phonetic" class="mb-3 text-sm font-semibold text-ink-500">
          {{ item.phonetic }}
        </div>
        <div v-for="sense in (item.senses?.length ? item.senses : [{ id: 'legacy', pos: item.pos, meaningZh: item.meaning, definitionEn: undefined, examples: [item.example] }])" :key="sense.id" class="flashcard-block flashcard-block-primary">
          <div class="flex items-center gap-2">
            <Badge v-if="sense.pos" variant="secondary" class="rounded-md text-[10px]">
              {{ sense.pos }}
            </Badge>
            <p class="flashcard-label text-accent-primary">
              {{ $t('flashcard.meaning') }}
            </p>
          </div>
          <p class="flashcard-body">
            {{ sense.meaningZh }}
          </p>
          <p v-if="sense.definitionEn" class="mt-1 text-sm leading-relaxed text-ink-600 dark:text-ink-300">
            {{ sense.definitionEn }}
          </p>
          <p v-for="example in sense.examples" :key="example" class="flashcard-example mt-2">
            {{ example }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

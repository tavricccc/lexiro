<script setup lang="ts">
import type { WordEntry } from '@/types'
import { Volume2 } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import Badge from './ui/badge/Badge.vue'
import Button from './ui/button/Button.vue'
import Card from './ui/card/Card.vue'

const props = defineProps<{ word: WordEntry | null }>()
const { t } = useI18n()
const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window

function speak() {
  if (!props.word || !('speechSynthesis' in window))
    return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(props.word.word)
  utterance.lang = 'en-US'
  utterance.rate = 0.85
  window.speechSynthesis.speak(utterance)
}
</script>

<template>
  <Card v-if="word" class="overflow-hidden p-5 text-left sm:p-7">
    <div class="flex flex-wrap items-start justify-between gap-4 border-b border-ink-200/60 pb-5 dark:border-ink-200/10">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-3">
          <h2 class="break-words text-4xl font-black tracking-tight text-ink-950 dark:text-ink-50 sm:text-5xl">
            {{ word.word }}
          </h2>
          <Button v-if="word.audioUrl || canSpeak" variant="outline" size="icon" :aria-label="t('dictionary.playAudio')" @click="speak">
            <Volume2 class="h-4 w-4" />
          </Button>
        </div>
        <p v-if="word.phonetic" class="mt-2 text-sm font-semibold tracking-wide text-ink-500 dark:text-ink-400">
          {{ word.phonetic }}
        </p>
      </div>
      <Badge variant="secondary" class="rounded-lg px-2.5 py-1 text-xs font-bold">
        {{ $t('study.wordList') }}
      </Badge>
    </div>

    <div class="mt-6 space-y-6">
      <article v-for="sense in word.senses" :key="sense.id" class="space-y-3">
        <div class="flex flex-wrap items-center gap-2">
          <Badge v-if="sense.pos" variant="outline" class="rounded-md text-[11px] font-bold uppercase">
            {{ sense.pos }}
          </Badge>
          <h3 class="text-lg font-extrabold text-ink-950 dark:text-ink-50">
            {{ sense.meaningZh }}
          </h3>
        </div>
        <p v-if="sense.definitionEn" class="text-sm leading-relaxed text-ink-600 dark:text-ink-300">
          {{ sense.definitionEn }}
        </p>
        <div v-if="sense.examples.length" class="space-y-2 border-l-2 border-accent-primary/30 pl-4">
          <p v-for="example in sense.examples" :key="example" class="text-sm leading-relaxed text-ink-700 dark:text-ink-200">
            {{ example }}
          </p>
        </div>
      </article>
    </div>
  </Card>
  <Card v-else class="p-8 text-center text-sm font-semibold text-ink-400">
    {{ $t('study.noWords') }}
  </Card>
</template>

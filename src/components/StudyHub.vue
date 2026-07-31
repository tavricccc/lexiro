<script setup lang="ts">
import { ArrowRight, BookOpenText, Brain, RotateCcw, SpellCheck2 } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useLearningStore } from '@/stores/learning'
import { useSessionStore } from '@/stores/session'
import { useSetsStore } from '@/stores/sets'
import Badge from './ui/badge/Badge.vue'
import Button from './ui/button/Button.vue'
import Card from './ui/card/Card.vue'

const router = useRouter()
const setsStore = useSetsStore()
const sessionStore = useSessionStore()
const learningStore = useLearningStore()
const { sets } = storeToRefs(setsStore)
const dueSets = computed(() => sets.value.map(set => ({ set, due: learningStore.getDueCount(set) })).filter(item => item.due > 0).sort((a, b) => b.due - a.due))
const totalDue = computed(() => dueSets.value.reduce((sum, item) => sum + item.due, 0))

function startReview(setId: string) {
  if (learningStore.startReview(setId))
    router.push({ name: 'review', params: { setId } })
}
function start(mode: 'quiz' | 'spelling' | 'flashcard', setId: string) {
  if (!setId)
    return
  if (mode === 'flashcard')
    sessionStore.startFlashcards(setId)
  else
    sessionStore.openPracticeDialog(mode, setId)
}

function startFromEvent(mode: 'quiz' | 'spelling' | 'flashcard', event: Event) {
  start(mode, (event.target as HTMLSelectElement).value)
}
</script>

<template>
  <section class="space-y-6 text-left">
    <div><p class="text-xs font-black uppercase tracking-[0.18em] text-ink-400">{{ $t('study.eyebrow') }}</p><h1 class="mt-2 text-3xl font-black tracking-tight">{{ $t('study.title') }}</h1><p class="mt-2 text-sm font-semibold text-ink-500">{{ $t('study.description') }}</p></div>
    <Card class="overflow-hidden border-0 bg-ink-950 p-6 text-white dark:bg-white dark:text-ink-950 sm:p-8"><div class="flex flex-col justify-between gap-6 md:flex-row md:items-center"><div><p class="text-xs font-black uppercase tracking-[0.18em] opacity-60">{{ $t('study.reviewEyebrow') }}</p><p class="mt-3 text-4xl font-black">{{ totalDue }}<span class="ml-2 text-base opacity-60">{{ $t('study.cardsDue') }}</span></p><p class="mt-2 max-w-lg text-sm font-semibold opacity-70">{{ totalDue ? $t('study.reviewHint') : $t('study.noReviewHint') }}</p></div><Button v-if="dueSets.length" variant="secondary" class="gap-2" @click="startReview(dueSets[0].set.id)"><RotateCcw class="h-4 w-4" />{{ $t('study.startReview') }}<ArrowRight class="h-4 w-4" /></Button></div></Card>
    <div class="grid gap-4 md:grid-cols-3"><Card class="p-5"><BookOpenText class="h-5 w-5 text-ink-500" /><h2 class="mt-5 font-black">{{ $t('setCard.flashcards') }}</h2><p class="mt-2 text-sm font-semibold leading-relaxed text-ink-500">{{ $t('study.flashcardDescription') }}</p><select class="mt-5 h-10 w-full rounded-xl border border-ink-200 bg-white px-3 text-xs font-bold dark:border-ink-700 dark:bg-ink-900" @change="startFromEvent('flashcard', $event)"><option value="">{{ $t('study.chooseSet') }}</option><option v-for="set in sets" :key="set.id" :value="set.id">{{ set.setName }}</option></select></Card><Card class="p-5"><Brain class="h-5 w-5 text-ink-500" /><h2 class="mt-5 font-black">{{ $t('setCard.quiz') }}</h2><p class="mt-2 text-sm font-semibold leading-relaxed text-ink-500">{{ $t('study.quizDescription') }}</p><select class="mt-5 h-10 w-full rounded-xl border border-ink-200 bg-white px-3 text-xs font-bold dark:border-ink-700 dark:bg-ink-900" @change="startFromEvent('quiz', $event)"><option value="">{{ $t('study.chooseSet') }}</option><option v-for="set in sets" :key="set.id" :value="set.id">{{ set.setName }}</option></select></Card><Card class="p-5"><SpellCheck2 class="h-5 w-5 text-ink-500" /><h2 class="mt-5 font-black">{{ $t('setCard.spelling') }}</h2><p class="mt-2 text-sm font-semibold leading-relaxed text-ink-500">{{ $t('study.spellingDescription') }}</p><select class="mt-5 h-10 w-full rounded-xl border border-ink-200 bg-white px-3 text-xs font-bold dark:border-ink-700 dark:bg-ink-900" @change="startFromEvent('spelling', $event)"><option value="">{{ $t('study.chooseSet') }}</option><option v-for="set in sets" :key="set.id" :value="set.id">{{ set.setName }}</option></select></Card></div>
    <div v-if="dueSets.length" class="space-y-3"><div class="flex items-center justify-between"><h2 class="text-lg font-black">{{ $t('study.dueBySet') }}</h2><RouterLink to="/library" class="text-xs font-black text-ink-500">{{ $t('home.viewLibrary') }}</RouterLink></div><div class="grid gap-3 md:grid-cols-2"><Card v-for="item in dueSets" :key="item.set.id" class="flex items-center justify-between gap-4 p-4"><div class="min-w-0"><p class="truncate text-sm font-black">{{ item.set.setName }}</p><Badge variant="secondary" class="mt-2 rounded-lg">{{ item.due }} {{ $t('study.cardsDue') }}</Badge></div><Button variant="outline" size="sm" class="gap-2" @click="startReview(item.set.id)">{{ $t('study.review') }}<ArrowRight class="h-3.5 w-3.5" /></Button></Card></div></div></section>
</template>

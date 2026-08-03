<script setup lang="ts">
import { ArrowLeft, Ellipsis, Folder, PencilLine, Play, Sparkles, Trash2 } from 'lucide-vue-next'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useLibraryStore } from '@/stores/library'
import { useSetsStore } from '@/stores/sets'
import PracticeSetupDialog from '../dialogs/PracticeSetupDialog.vue'
import Badge from '../ui/badge/Badge.vue'
import Button from '../ui/button/Button.vue'
import Card from '../ui/card/Card.vue'
import Menu from '../ui/popover/Menu.vue'

const props = defineProps<{
  setId?: string
}>()

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const libraryStore = useLibraryStore()
const setsStore = useSetsStore()
const setId = computed(() => props.setId || (typeof route.params.setId === 'string' ? route.params.setId : ''))
const activeSet = computed(() => libraryStore.getSet(setId.value))
const words = computed(() => libraryStore.getSetWords(setId.value))
const folderName = computed(() => {
  const folderId = activeSet.value?.folderId
  return libraryStore.folders.find(folder => folder.id === folderId)?.name ?? t('study.folderNone')
})
const tabs = [
  { name: 'set-overview', label: 'set.overviewTab' },
  { name: 'set-words', label: 'set.wordsTab' },
  { name: 'set-questions', label: 'set.questionsTab' },
] as const
const menuOpen = ref(false)
const practiceOpen = ref(false)
let hydrationController: AbortController | null = null

watch(setId, (value) => {
  hydrationController?.abort()
  if (value) {
    setsStore.ensureActiveSet(value)
    hydrationController = new AbortController()
    void libraryStore.hydrateSet(value, hydrationController.signal).catch(() => undefined)
  }
}, { immediate: true })

onUnmounted(() => hydrationController?.abort())

function openPractice() {
  menuOpen.value = false
  practiceOpen.value = true
}

function editSet() {
  menuOpen.value = false
  if (activeSet.value)
    setsStore.openSetEditor('edit', activeSet.value)
}

async function deleteSet() {
  menuOpen.value = false
  if (!activeSet.value)
    return
  const synced = await setsStore.requestDelete(activeSet.value.id)
  if (synced && !libraryStore.getSet(setId.value))
    await router.push({ name: 'library' })
}

function openGeneration() {
  menuOpen.value = false
  void router.push({ name: 'question-generation', params: { setId: setId.value } })
}
</script>

<template>
  <section v-if="activeSet" class="space-y-5 text-left">
    <header class="space-y-4">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div class="min-w-0">
          <Button variant="ghost" class="mb-2 -ml-3 gap-2" @click="router.push({ name: 'library' })">
            <ArrowLeft class="h-4 w-4" />{{ $t('study.backToLibrary') }}
          </Button>
          <div class="flex flex-wrap items-center gap-2">
            <h1 class="break-words text-2xl font-black tracking-tight">
              {{ activeSet.setName }}
            </h1>
            <Badge variant="secondary" class="gap-1">
              <Folder class="h-3.5 w-3.5" />{{ folderName }}
            </Badge>
          </div>
          <p class="mt-1 text-sm font-semibold text-ink-500">
            {{ $t('set.wordCount', { count: words.length }) }}
          </p>
        </div>

        <div class="flex items-center gap-2">
          <Button class="min-h-11 gap-2 font-black" @click="openPractice">
            <Play class="h-4 w-4" />{{ $t('set.startPractice') }}
          </Button>
          <Menu v-model:open="menuOpen" align="end" :max-height="240" width-class="w-64">
            <template #trigger="{ open, toggle, menuId }">
              <Button variant="outline" size="icon" class="h-11 w-11" :aria-label="t('set.manage')" aria-haspopup="menu" :aria-expanded="open" :aria-controls="open ? menuId : undefined" @click="toggle">
                <Ellipsis class="h-4 w-4" />
              </Button>
            </template>
            <button type="button" class="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-bold hover:bg-ink-100 dark:hover:bg-ink-800" role="menuitem" @click="editSet">
              <PencilLine class="h-4 w-4 text-ink-500" />{{ $t('set.edit') }}
            </button>
            <button type="button" class="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-bold hover:bg-ink-100 dark:hover:bg-ink-800" role="menuitem" @click="openGeneration">
              <Sparkles class="h-4 w-4 text-ink-500" />{{ $t('set.generateQuestions') }}
            </button>
            <div class="my-1 border-t border-ink-200/70 dark:border-ink-700/70" />
            <button type="button" class="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20" role="menuitem" @click="deleteSet">
              <Trash2 class="h-4 w-4" />{{ $t('set.delete') }}
            </button>
          </Menu>
        </div>
      </div>

      <nav class="flex gap-1 overflow-x-auto border-b border-ink-200/70 dark:border-ink-200/15" :aria-label="$t('set.overviewTab')">
        <RouterLink v-for="tab in tabs" :key="tab.name" :to="{ name: tab.name, params: { setId } }" class="min-h-11 shrink-0 border-b-2 border-transparent px-3 py-2.5 text-sm font-bold text-ink-500 transition-colors hover:text-ink-950 dark:hover:text-ink-50" active-class="border-accent-primary text-accent-primary">
          {{ $t(tab.label) }}
        </RouterLink>
      </nav>
    </header>

    <router-view v-slot="{ Component }">
      <component :is="Component" :set-id="setId" @start-practice="practiceOpen = true" />
    </router-view>

    <PracticeSetupDialog :open="practiceOpen" :set-id="setId" @close="practiceOpen = false" />
  </section>

  <Card v-else class="mx-auto max-w-xl space-y-3 p-6 text-center">
    <h1 class="text-xl font-black">
      {{ $t('set.invalidSetTitle') }}
    </h1>
    <p class="text-sm font-semibold text-ink-500">
      {{ $t('set.invalidSetDescription') }}
    </p>
    <Button class="mx-auto" @click="router.push({ name: 'library' })">
      {{ $t('study.backToLibrary') }}
    </Button>
  </Card>
</template>

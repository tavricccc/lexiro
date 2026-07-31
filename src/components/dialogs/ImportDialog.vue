<script setup lang="ts">
import { Check, ClipboardCopy, Sparkles } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { extractJsonText, generateWithAi, loadAiSettings } from '@/lib/ai-provider'
import { copyToClipboard } from '@/lib/clipboard'
import { parseImportJson } from '@/lib/import'
import { buildImportPrompt } from '@/lib/importPrompt'
import { useSetsStore } from '@/stores/sets'
import { useUIStore } from '@/stores/ui'
import Button from '../ui/button/Button.vue'
import DialogFooter from '../ui/dialog-footer/DialogFooter.vue'
import Dialog from '../ui/dialog/Dialog.vue'
import SectionPanel from '../ui/section-panel/SectionPanel.vue'
import StatusMessage from '../ui/status-message/StatusMessage.vue'
import Textarea from '../ui/textarea/Textarea.vue'

const { t } = useI18n()

const setsStore = useSetsStore()
const uiStore = useUIStore()
const { importOpen, importStep, importWords, importJson, importError, importPreview, importDifficulty } = storeToRefs(setsStore)
const { closeImport, nextImportStep, importSet } = setsStore
const { showToast } = uiStore

const importTextarea = ref<InstanceType<typeof Textarea> | null>(null)
const aiSettings = ref(loadAiSettings())
const aiGenerating = ref(false)

const difficultyLevels = ['', t('import.difficulty1'), t('import.difficulty2'), t('import.difficulty3')] as const
const difficultyLabel = computed(() => difficultyLevels[importDifficulty.value])
const wordCount = computed(() => importWords.value.split(/[\s,，、;；]+/).filter(Boolean).length)
const aiReady = computed(() => aiSettings.value.enabled && Boolean(aiSettings.value.apiKey.trim()))

watch([importOpen, importStep], ([open]) => {
  if (open) {
    aiSettings.value = loadAiSettings()
    nextTick(() => {
      importTextarea.value?.focus()
    })
  }
})

watch(importJson, (val) => {
  if (!val.trim()) {
    setsStore.importPreview = ''
    setsStore.importError = ''
    return
  }
  const result = parseImportJson(val.trim())
  if (result.valid) {
    setsStore.importPreview = t('import.jsonValid', { count: result.data.items.length })
    setsStore.importError = ''
  }
  else {
    setsStore.importPreview = ''
    setsStore.importError = result.error
  }
})

async function copyImportPrompt() {
  if (!wordCount.value) {
    setsStore.importError = t('import.wordsRequired')
    return
  }
  const prompt = buildImportPrompt(importWords.value, importDifficulty.value)
  try {
    await copyToClipboard(prompt)
    showToast(t('import.copied'))
    nextImportStep()
  }
  catch {
    showToast(t('toast.copyFailed'))
  }
}

async function generateWithConfiguredAi() {
  if (!wordCount.value) {
    setsStore.importError = t('import.wordsRequired')
    return
  }

  const settings = loadAiSettings()
  aiSettings.value = settings
  if (!settings.enabled || !settings.apiKey.trim()) {
    setsStore.importError = t('import.aiConfigureHint')
    return
  }

  const words = importWords.value.split(/[\s,，、;；]+/).map(word => word.trim()).filter(Boolean)
  const batchSize = Math.min(Math.max(Number(settings.batchSize) || 10, 5), 20)
  const batches = Array.from({ length: Math.ceil(words.length / batchSize) }, (_, index) => words.slice(index * batchSize, (index + 1) * batchSize))

  aiGenerating.value = true
  setsStore.importError = ''
  try {
    const items = []
    let difficulty = importDifficulty.value
    for (const batch of batches) {
      const response = await generateWithAi(settings, buildImportPrompt(batch.join(', '), importDifficulty.value))
      const result = parseImportJson(extractJsonText(response))
      if (!result.valid)
        throw new Error(result.error)
      items.push(...result.data.items)
      difficulty = result.data.difficulty
    }

    setsStore.importJson = JSON.stringify({ difficulty, items }, null, 2)
    setsStore.importPreview = t('import.jsonValid', { count: items.length })
    setsStore.importError = ''
    nextImportStep()
    showToast(t('import.generated', { count: items.length }))
  }
  catch (error) {
    setsStore.importError = (error as Error).message || t('import.aiFailed')
  }
  finally {
    aiGenerating.value = false
  }
}
</script>

<template>
  <Dialog
    :open="importOpen"
    :title="$t('import.title')"
    :description="importStep === 1 ? $t('import.step1') : $t('import.step2')"
    @close="closeImport"
  >
    <ol class="mb-6 grid grid-cols-2 gap-2" :aria-label="$t('import.progressLabel')">
      <li
        v-for="step in 2"
        :key="step"
        class="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold"
        :class="step <= importStep ? 'border-accent-primary/20 bg-accent-primary/10 text-accent-primary' : 'border-ink-200/60 text-ink-400 dark:border-ink-200/20'"
      >
        <span class="flex h-5 w-5 items-center justify-center rounded-full border border-current text-[10px]">
          <Check v-if="step < importStep" class="h-3 w-3" />
          <span v-else>{{ step }}</span>
        </span>
        {{ step === 1 ? $t('import.progressWords') : $t('import.progressPaste') }}
      </li>
    </ol>

    <div v-if="importStep === 1" class="space-y-5">
      <div class="flex flex-col gap-1.5 w-full text-left">
        <label class="text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
          {{ $t('import.step1') }}
        </label>
        <Textarea
          ref="importTextarea"
          v-model="importWords"
          :rows="8"
          class="font-mono text-sm leading-relaxed"
          :placeholder="$t('import.wordPlaceholder')"
        />
        <p class="text-xs font-semibold text-ink-400">
          {{ $t('import.wordCount', { count: wordCount }) }}
        </p>
      </div>

      <div class="flex flex-col gap-1.5 w-full text-left">
        <label class="text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
          {{ $t('import.difficulty') }}
        </label>
        <div class="flex items-center gap-3">
          <input
            v-model.number="importDifficulty"
            type="range"
            min="1"
            max="3"
            step="1"
            class="w-full h-2 rounded-full appearance-none cursor-pointer bg-ink-200 dark:bg-ink-700 accent-accent-primary"
          >
          <span class="text-sm font-bold text-ink-800 dark:text-ink-200 min-w-[5rem] text-right">
            {{ difficultyLabel }}
          </span>
        </div>
      </div>

      <SectionPanel class="border-accent-primary/15 bg-accent-primary/10">
        <p class="text-xs font-bold text-accent-primary">
          {{ $t('import.step2') }}
        </p>
        <p class="mt-1.5 text-xs leading-relaxed text-ink-500 dark:text-ink-400 font-medium">
          {{ $t('import.step2Hint') }}
        </p>
      </SectionPanel>
      <StatusMessage v-if="importError" tone="error">
        {{ importError }}
      </StatusMessage>

      <DialogFooter>
        <Button variant="outline" @click="closeImport">
          {{ $t('editor.cancel') }}
        </Button>
        <Button variant="outline" @click="nextImportStep">
          {{ $t('import.nextStep') }}
        </Button>
        <Button v-if="aiReady" variant="secondary" class="gap-2" :loading="aiGenerating" @click="generateWithConfiguredAi">
          <Sparkles class="h-4 w-4" />
          <span>{{ aiGenerating ? $t('import.generating') : $t('import.generateWithAi') }}</span>
        </Button>
        <Button variant="default" class="gap-2" :disabled="!wordCount" @click="copyImportPrompt">
          <ClipboardCopy class="h-4 w-4 text-accent-primary" />
          <span>{{ $t('import.copyPrompt') }}</span>
        </Button>
      </DialogFooter>
    </div>

    <div v-else-if="importStep === 2" class="space-y-5">
      <div class="flex flex-col gap-1.5 w-full text-left">
        <label class="text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
          {{ $t('import.importJson') }}
        </label>
        <Textarea
          ref="importTextarea"
          v-model="importJson"
          :rows="8"
          class="font-mono text-xs leading-relaxed"
          :placeholder="$t('import.jsonPlaceholder')"
        />
      </div>

      <StatusMessage v-if="importPreview" tone="success">
        {{ importPreview }}
      </StatusMessage>
      <StatusMessage v-if="importError" tone="error">
        {{ $t('import.jsonError') }}：{{ importError }}
      </StatusMessage>

      <DialogFooter>
        <Button variant="outline" @click="importStep = 1">
          {{ $t('import.backToWords') }}
        </Button>
        <Button variant="default" :disabled="!importPreview" @click="importSet">
          {{ $t('import.import') }}
        </Button>
      </DialogFooter>
    </div>
  </Dialog>
</template>

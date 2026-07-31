<script setup lang="ts">
import { Check, Cloud, Download, KeyRound, LockKeyhole, LogIn, LogOut, Save, Upload, UserRound } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { DAILY_GOAL_OPTIONS } from '@/constants'
import { defaultAiSettings, downloadAiSettings, loadAiSettings, parseAiSettingsJson, saveAiSettings } from '@/lib/ai-provider'
import { useCloudSyncStore } from '@/stores/cloudSync'
import { useLearningStore } from '@/stores/learning'
import { useUIStore } from '@/stores/ui'
import Button from './ui/button/Button.vue'
import Card from './ui/card/Card.vue'
import Input from './ui/input/Input.vue'
import Select from './ui/select/Select.vue'

const uiStore = useUIStore()
const learningStore = useLearningStore()
const cloudStore = useCloudSyncStore()
const { t } = useI18n()
const { configured, isSignedIn, accountLabel, status } = storeToRefs(cloudStore)
const { signIn: signInAccount, signOutAccount } = cloudStore
const statusLabel = computed(() => t(`sync.${status.value === 'disabled' ? 'notConfigured' : status.value}`))
const settings = reactive({ ...loadAiSettings() })
const saved = ref(false)
const aiImportInput = ref<HTMLInputElement | null>(null)
const dailyGoal = computed({
  get: () => String(learningStore.stats.dailyGoal),
  set: (value: string) => learningStore.setDailyGoal(Number(value)),
})
const dailyGoalOptions = DAILY_GOAL_OPTIONS.map(value => ({ value: String(value), label: `${value} 題` }))

const providerOptions = [
  { value: 'openai', label: 'OpenAI-compatible' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google Gemini' },
  { value: 'custom', label: 'Custom OpenAI-compatible' },
]
const aiModeOptions = computed(() => [
  { value: 'manual', label: t('settings.manualMode') },
  { value: 'api', label: t('settings.apiMode') },
])
const aiMode = computed({
  get: () => settings.enabled ? 'api' : 'manual',
  set: (value: string) => { settings.enabled = value === 'api' },
})

function save() {
  saveAiSettings({ ...settings, batchSize: Math.min(Math.max(Number(settings.batchSize) || 10, 5), 20) })
  saved.value = true
  uiStore.showToast(t('settings.saved'))
  window.setTimeout(() => saved.value = false, 1800)
}

function reset() {
  Object.assign(settings, defaultAiSettings)
  save()
}

function updateBatchSize(value: string) {
  settings.batchSize = Number(value) || 10
}

function exportAiSettings() {
  save()
  downloadAiSettings(settings)
  uiStore.showToast(t('settings.aiExported'))
}

function openAiImport() {
  aiImportInput.value?.click()
}

async function importAiSettings(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return
  try {
    Object.assign(settings, parseAiSettingsJson(await file.text()))
    save()
    uiStore.showToast(t('settings.aiImported'))
  }
  catch {
    uiStore.showToast(t('settings.aiImportFailed'))
  }
  input.value = ''
}

async function signOut() {
  await signOutAccount()
  uiStore.showToast(t('settings.signedOut'))
}

async function signIn() {
  await signInAccount()
}
</script>

<template>
  <section class="space-y-5 text-left">
    <div class="flex items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">
          {{ $t('settings.title') }}
        </h1>
      </div>
    </div>
    <Card class="p-5 sm:p-6">
      <div class="flex items-start gap-4">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-ink-100 dark:bg-ink-900">
          <KeyRound class="h-5 w-5" />
        </div><div>
          <h2 class="font-black">
            {{ $t('settings.aiTitle') }}
          </h2>
        </div>
      </div>
      <div class="mt-7">
        <p class="text-xs font-semibold text-ink-500">
          {{ $t('settings.aiMode') }}
        </p>
        <Select v-model="aiMode" :options="aiModeOptions" class="mt-2 max-w-md" />
        <p class="mt-2 text-xs font-semibold leading-relaxed text-ink-400">
          {{ settings.enabled ? $t('settings.apiModeHint') : $t('settings.manualModeHint') }}
        </p>
      </div>
      <div v-if="settings.enabled" class="mt-5 grid gap-4 sm:grid-cols-2">
        <div class="text-xs font-semibold text-ink-500">
          {{ $t('settings.provider') }}
          <Select v-model="settings.provider" :options="providerOptions" class="mt-2" />
        </div><label class="text-xs font-semibold text-ink-500">{{ $t('settings.model') }}<Input v-model="settings.model" class="mt-2" placeholder="gpt-4o-mini / claude / gemini" /></label><label class="text-xs font-semibold text-ink-500 sm:col-span-2">{{ $t('settings.endpoint') }}<Input v-model="settings.baseUrl" class="mt-2" :placeholder="$t('settings.endpointPlaceholder')" /><span class="mt-1 block text-[11px] font-medium text-ink-400">{{ $t('settings.endpointHint') }}</span></label><label class="text-xs font-semibold text-ink-500 sm:col-span-2">{{ $t('settings.apiKey') }}<Input v-model="settings.apiKey" type="password" class="mt-2" :placeholder="$t('settings.apiKeyPlaceholder')" /></label><label class="text-xs font-semibold text-ink-500">{{ $t('settings.batchSize') }}<Input :model-value="String(settings.batchSize)" type="number" min="5" max="20" class="mt-2" @update:model-value="updateBatchSize" /></label>
      </div><div class="mt-6 flex flex-wrap items-center gap-2">
        <Button variant="default" class="gap-2" @click="save">
          <Save class="h-4 w-4" />{{ $t('settings.save') }}
        </Button><Button variant="ghost" @click="reset">
          {{ $t('settings.reset') }}
        </Button>
        <Button variant="outline" class="gap-2" @click="exportAiSettings">
          <Download class="h-4 w-4" />{{ $t('settings.aiExport') }}
        </Button><Button variant="outline" class="gap-2" @click="openAiImport">
          <Upload class="h-4 w-4" />{{ $t('settings.aiImport') }}
        </Button><input ref="aiImportInput" type="file" accept="application/json,.json" class="hidden" @change="importAiSettings">
        <span v-if="saved" class="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600"><Check class="h-3.5 w-3.5" />{{ $t('settings.saved') }}</span>
      </div><div class="mt-5 flex gap-3 rounded-2xl bg-amber-50 p-3.5 text-xs font-medium leading-relaxed text-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
        <LockKeyhole class="mt-0.5 h-4 w-4 shrink-0" />{{ $t('settings.keySafety') }}
      </div>
    </Card>
    <Card class="p-5 sm:p-6">
      <div class="flex items-start gap-4">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-ink-100 dark:bg-ink-900">
          <Check class="h-5 w-5" />
        </div>
        <div>
          <h2 class="font-black">
            {{ $t('settings.dailyGoalTitle') }}
          </h2>
          <p class="mt-1 text-sm font-semibold leading-relaxed text-ink-500">
            {{ $t('settings.dailyGoalDescription') }}
          </p>
        </div>
      </div>
      <div class="mt-6 max-w-xs">
        <label class="text-xs font-black text-ink-500">
          {{ $t('settings.dailyGoalLabel') }}
          <Select v-model="dailyGoal" :options="dailyGoalOptions" class="mt-2" @change="uiStore.showToast(t('settings.dailyGoalSaved'))" />
        </label>
      </div>
    </Card>
    <Card class="p-5 sm:p-6">
      <div class="flex items-start gap-4">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-ink-100 dark:bg-ink-900">
          <UserRound class="h-5 w-5" />
        </div>
        <div class="min-w-0">
          <h2 class="font-black">
            {{ $t('settings.accountTitle') }}
          </h2>
          <p class="mt-1 text-sm font-semibold leading-relaxed text-ink-500">
            {{ $t('settings.accountDescription') }}
          </p>
        </div>
      </div>
      <div class="mt-5 flex items-center gap-3 rounded-2xl bg-ink-100/70 p-3.5 dark:bg-ink-900/70">
        <Cloud class="h-4 w-4 shrink-0 text-ink-500" />
        <div class="min-w-0 text-sm">
          <p class="truncate font-semibold text-ink-950 dark:text-ink-50">
            {{ isSignedIn ? accountLabel : $t('sync.localMode') }}
          </p>
          <p class="mt-0.5 text-xs font-medium text-ink-500">
            {{ isSignedIn ? $t('settings.cloudConnected') : $t('settings.localOnly') }} · {{ statusLabel }}
          </p>
        </div>
      </div>
      <div class="mt-5 flex flex-wrap gap-2">
        <Button variant="outline" class="gap-2" @click="uiStore.openTransfer">
          <Upload class="h-4 w-4" />{{ $t('backup.exportImport') }}
        </Button>
        <Button v-if="!isSignedIn && configured" variant="default" class="gap-2" @click="signIn">
          <LogIn class="h-4 w-4" />{{ $t('sync.signIn') }}
        </Button>
        <Button v-if="isSignedIn" variant="outline" class="gap-2" @click="signOut">
          <LogOut class="h-4 w-4" />{{ $t('sync.signOut') }}
        </Button>
      </div>
    </Card>
  </section>
</template>

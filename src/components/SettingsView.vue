<script setup lang="ts">
import { Check, Cloud, Download, KeyRound, LockKeyhole, LogIn, LogOut, Save, Upload, UserRound } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { DAILY_QUESTION_GOAL_OPTIONS, DAILY_WORD_GOAL_OPTIONS } from '@/constants'
import { defaultAiSettings, downloadAiSettings, loadAiSettings, parseAiSettingsJson, saveAiSettings } from '@/lib/ai-provider'
import { useDirtyForm } from '@/lib/dirty-form'
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
const { configured, isSignedIn, accountLabel, status, error } = storeToRefs(cloudStore)
const { signIn: signInAccount, signOutAccount } = cloudStore
const statusLabel = computed(() => {
  const key = status.value === 'disabled' ? 'notConfigured' : status.value === 'signed-out' ? 'signedOut' : status.value
  return t(`sync.${key}`)
})
const settings = reactive({ ...loadAiSettings() })
const initialSettingsSnapshot = ref(JSON.stringify(settings))
const saved = ref(false)
const aiImportInput = ref<HTMLInputElement | null>(null)
const dailyWordGoal = computed({
  get: () => String(learningStore.stats.dailyWordGoal),
  set: (value: string) => learningStore.setDailyWordGoal(Number(value)),
})
const dailyQuestionGoal = computed({
  get: () => String(learningStore.stats.dailyQuestionGoal),
  set: (value: string) => learningStore.setDailyQuestionGoal(Number(value)),
})
const dailyWordGoalOptions = computed(() => DAILY_WORD_GOAL_OPTIONS.map(value => ({ value: String(value), label: t('settings.dailyWordOption', { value }) })))
const dailyQuestionGoalOptions = computed(() => DAILY_QUESTION_GOAL_OPTIONS.map(value => ({ value: String(value), label: t('settings.dailyQuestionOption', { value }) })))

const providerOptions = computed(() => [
  { value: 'openai', label: t('settings.providerOpenai') },
  { value: 'anthropic', label: t('settings.providerAnthropic') },
  { value: 'google', label: t('settings.providerGoogle') },
  { value: 'custom', label: t('settings.providerCustom') },
])
const aiModeOptions = computed(() => [
  { value: 'manual', label: t('settings.manualMode') },
  { value: 'api', label: t('settings.apiMode') },
])
const aiMode = computed({
  get: () => settings.enabled ? 'api' : 'manual',
  set: (value: string) => { settings.enabled = value === 'api' },
})

function settingsSnapshot(): string {
  return JSON.stringify(settings)
}

const settingsDirty = computed(() => initialSettingsSnapshot.value !== settingsSnapshot())

function save(): boolean {
  saveAiSettings({ ...settings, batchSize: Math.min(Math.max(Number(settings.batchSize) || 10, 5), 20) })
  initialSettingsSnapshot.value = settingsSnapshot()
  saved.value = true
  uiStore.showToast(t('settings.saved'))
  window.setTimeout(() => saved.value = false, 1800)
  return true
}

function reset() {
  Object.assign(settings, defaultAiSettings)
  save()
}

function discardSettings() {
  Object.assign(settings, JSON.parse(initialSettingsSnapshot.value) as typeof settings)
}

useDirtyForm({
  id: 'settings',
  isDirty: () => settingsDirty.value,
  save,
  discard: discardSettings,
})

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
    const imported = parseAiSettingsJson(await file.text())
    Object.assign(settings, { ...imported, apiKey: settings.apiKey })
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
        </div><label class="text-xs font-semibold text-ink-500">{{ $t('settings.model') }}<Input v-model="settings.model" class="mt-2" :placeholder="$t('settings.modelPlaceholder')" /></label><label class="text-xs font-semibold text-ink-500 sm:col-span-2">{{ $t('settings.endpoint') }}<Input v-model="settings.baseUrl" class="mt-2" :placeholder="$t('settings.endpointPlaceholder')" /><span class="mt-1 block text-[11px] font-medium text-ink-400">{{ $t('settings.endpointHint') }}</span></label><label class="text-xs font-semibold text-ink-500 sm:col-span-2">{{ $t('settings.apiKey') }}<Input v-model="settings.apiKey" type="password" class="mt-2" :placeholder="$t('settings.apiKeyPlaceholder')" /></label><label class="text-xs font-semibold text-ink-500">{{ $t('settings.batchSize') }}<Input :model-value="String(settings.batchSize)" type="number" min="5" max="20" class="mt-2" @update:model-value="updateBatchSize" /></label>
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
            {{ $t('settings.dailyTargetsTitle') }}
          </h2>
          <p class="mt-1 text-sm font-semibold leading-relaxed text-ink-500">
            {{ $t('settings.dailyTargetsDescription') }}
          </p>
        </div>
      </div>
      <div class="mt-6 grid gap-4 sm:grid-cols-2">
        <label class="text-xs font-black text-ink-500">
          {{ $t('settings.dailyWordGoalLabel') }}
          <Select v-model="dailyWordGoal" :options="dailyWordGoalOptions" class="mt-2" @change="uiStore.showToast(t('settings.dailyTargetsSaved'))" />
        </label>
        <label class="text-xs font-black text-ink-500">
          {{ $t('settings.dailyQuestionGoalLabel') }}
          <Select v-model="dailyQuestionGoal" :options="dailyQuestionGoalOptions" class="mt-2" @change="uiStore.showToast(t('settings.dailyTargetsSaved'))" />
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
      <p v-if="error" class="mt-3 rounded-xl bg-red-50 p-3 text-xs font-semibold leading-relaxed text-red-600 dark:bg-red-950/20 dark:text-red-300" role="alert">
        {{ $t('sync.errorDetail', { message: error }) }}
      </p>
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

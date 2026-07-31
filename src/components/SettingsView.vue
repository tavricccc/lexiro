<script setup lang="ts">
import { Check, Cloud, KeyRound, LockKeyhole, Save, Settings2, Upload } from 'lucide-vue-next'
import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { defaultAiSettings, loadAiSettings, saveAiSettings } from '@/lib/ai-provider'
import { useUIStore } from '@/stores/ui'
import SyncProgressPanel from './SyncProgressPanel.vue'
import Button from './ui/button/Button.vue'
import Card from './ui/card/Card.vue'
import Input from './ui/input/Input.vue'

const router = useRouter()
const uiStore = useUIStore()
const { t } = useI18n()
const settings = reactive({ ...loadAiSettings() })
const saved = ref(false)

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
</script>

<template>
  <section class="space-y-6 text-left"><div class="flex items-end justify-between gap-4"><div><p class="text-xs font-black uppercase tracking-[0.18em] text-ink-400">{{ $t('settings.eyebrow') }}</p><h1 class="mt-2 text-3xl font-black tracking-tight">{{ $t('settings.title') }}</h1><p class="mt-2 text-sm font-semibold text-ink-500">{{ $t('settings.description') }}</p></div><Button variant="outline" class="gap-2" @click="router.push('/')"><Settings2 class="h-4 w-4" />{{ $t('settings.backHome') }}</Button></div>
    <Card class="p-6 sm:p-8"><div class="flex items-start gap-4"><div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-ink-100 dark:bg-ink-900"><KeyRound class="h-5 w-5" /></div><div><h2 class="font-black">{{ $t('settings.aiTitle') }}</h2><p class="mt-1 text-sm font-semibold leading-relaxed text-ink-500">{{ $t('settings.aiDescription') }}</p></div></div><div class="mt-7 grid gap-4 sm:grid-cols-2"><label class="text-xs font-black text-ink-500">{{ $t('settings.provider') }}<select v-model="settings.provider" class="mt-2 h-11 w-full rounded-xl border border-ink-200 bg-white px-3 text-sm font-bold dark:border-ink-700 dark:bg-ink-900"><option value="openai">OpenAI-compatible</option><option value="anthropic">Anthropic</option><option value="google">Google Gemini</option><option value="custom">Custom OpenAI-compatible</option></select></label><label class="text-xs font-black text-ink-500">{{ $t('settings.model') }}<Input v-model="settings.model" class="mt-2" placeholder="gpt-4o-mini / claude / gemini" /></label><label class="text-xs font-black text-ink-500 sm:col-span-2">{{ $t('settings.endpoint') }}<Input v-model="settings.baseUrl" class="mt-2" :placeholder="$t('settings.endpointPlaceholder')" /><span class="mt-1 block text-[11px] font-semibold text-ink-400">{{ $t('settings.endpointHint') }}</span></label><label class="text-xs font-black text-ink-500 sm:col-span-2">{{ $t('settings.apiKey') }}<Input v-model="settings.apiKey" type="password" class="mt-2" :placeholder="$t('settings.apiKeyPlaceholder')" /></label><label class="text-xs font-black text-ink-500">{{ $t('settings.batchSize') }}<Input :model-value="String(settings.batchSize)" type="number" min="5" max="20" class="mt-2" @update:model-value="updateBatchSize" /></label><label class="flex items-center gap-3 pt-6 text-sm font-bold"><input v-model="settings.enabled" type="checkbox" class="h-4 w-4 rounded accent-black" />{{ $t('settings.enableAi') }}</label></div><div class="mt-7 flex flex-wrap items-center gap-2"><Button variant="default" class="gap-2" @click="save"><Save class="h-4 w-4" />{{ $t('settings.save') }}</Button><Button variant="ghost" @click="reset">{{ $t('settings.reset') }}</Button><span v-if="saved" class="inline-flex items-center gap-1 text-xs font-bold text-emerald-600"><Check class="h-3.5 w-3.5" />{{ $t('settings.saved') }}</span></div><div class="mt-6 flex gap-3 rounded-2xl bg-amber-50 p-4 text-xs font-semibold leading-relaxed text-amber-800 dark:bg-amber-950/20 dark:text-amber-200"><LockKeyhole class="mt-0.5 h-4 w-4 shrink-0" />{{ $t('settings.keySafety') }}</div></Card>
    <div class="grid gap-4 lg:grid-cols-2"><Card class="p-6"><div class="flex items-center gap-2"><Cloud class="h-5 w-5" /><h2 class="font-black">{{ $t('sync.cloudTitle') }}</h2></div><p class="mt-2 text-sm font-semibold text-ink-500">{{ $t('sync.cloudDescription') }}</p><SyncProgressPanel class="mt-5" /></Card><Card class="p-6"><div class="flex items-center gap-2"><Upload class="h-5 w-5" /><h2 class="font-black">{{ $t('home.backupAndImport') }}</h2></div><p class="mt-2 text-sm font-semibold text-ink-500">{{ $t('backup.description') }}</p><Button variant="outline" class="mt-5" @click="uiStore.openTransfer">{{ $t('backup.configureExport') }}</Button></Card></div>
  </section>
</template>

<script setup lang="ts">
import { AlertTriangle, CheckCircle2, Cloud, CloudOff, LogIn, RefreshCw, UserRound } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCloudSyncStore } from '@/stores/cloudSync'
import Button from './ui/button/Button.vue'

defineProps<{ compact?: boolean }>()

const { t } = useI18n()
const cloudStore = useCloudSyncStore()
const { configured, status, error, accountLabel, isSignedIn, lastSyncedAt, pendingWrites, conflicts } = storeToRefs(cloudStore)
const { signIn, signOutAccount, flushAll, retryConnection, resolveConflict } = cloudStore

const statusText = computed(() => {
  if (!configured.value)
    return t('sync.notConfigured')
  if (!isSignedIn.value)
    return t('sync.signedOut')
  if (status.value === 'connecting')
    return t('sync.connecting')
  if (status.value === 'syncing')
    return t('sync.syncing')
  if (status.value === 'offline')
    return t('sync.offline')
  if (status.value === 'error')
    return t('sync.error')
  return t('sync.synced')
})

const statusClass = computed(() => {
  if (status.value === 'error')
    return 'text-red-600 dark:text-red-400'
  if (status.value === 'offline')
    return 'text-amber-700 dark:text-amber-300'
  if (status.value === 'synced')
    return 'text-emerald-700 dark:text-emerald-400'
  return 'text-ink-500 dark:text-ink-400'
})

function formatTime(value: string) {
  if (!value)
    return ''
  return new Intl.DateTimeFormat('zh-TW', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}
</script>

<template>
  <div :class="compact ? 'space-y-2' : 'rounded-2xl border border-ink-200/60 bg-white/60 p-4 dark:border-ink-200/15 dark:bg-ink-900/60'">
    <div class="flex items-center justify-between gap-3">
      <div class="flex min-w-0 items-center gap-2">
        <CloudOff v-if="status === 'offline'" class="h-4 w-4 shrink-0 text-amber-600" />
        <CheckCircle2 v-else-if="status === 'synced'" class="h-4 w-4 shrink-0 text-emerald-500" />
        <Cloud v-else class="h-4 w-4 shrink-0 text-accent-primary" />
        <div class="min-w-0">
          <p class="truncate text-xs font-extrabold" :class="statusClass">
            {{ statusText }}
          </p>
          <p v-if="accountLabel" class="truncate text-[11px] font-semibold text-ink-400">
            {{ accountLabel }}
          </p>
        </div>
      </div>
      <span v-if="pendingWrites" class="text-[11px] font-bold text-ink-400">{{ $t('sync.pending', { count: pendingWrites }) }}</span>
    </div>

    <div v-if="error" class="mt-2 space-y-2" role="alert">
      <p class="text-xs font-semibold leading-relaxed text-red-600 dark:text-red-400">
        {{ $t('sync.errorDetail', { message: error }) }}
      </p>
      <Button size="sm" variant="outline" class="h-7 px-2 text-[11px]" @click="retryConnection">
        {{ $t('sync.retry') }}
      </Button>
    </div>
    <p v-else-if="lastSyncedAt && isSignedIn" class="mt-2 text-[11px] font-semibold text-ink-400">
      {{ $t('sync.lastSynced', { time: formatTime(lastSyncedAt) }) }}
    </p>

    <div v-if="conflicts.length" class="mt-3 rounded-xl border border-amber-300/70 bg-amber-50 p-3 text-xs dark:border-amber-500/30 dark:bg-amber-950/20" role="alert">
      <div class="flex items-start gap-2 text-amber-800 dark:text-amber-200">
        <AlertTriangle class="mt-0.5 h-4 w-4 shrink-0" />
        <p class="font-bold">
          {{ $t('sync.conflictTitle') }}
        </p>
      </div>
      <p class="mt-1 text-amber-700 dark:text-amber-300">
        {{ $t('sync.conflictHint') }}
      </p>
      <div class="mt-2 space-y-2">
        <div v-for="conflict in conflicts" :key="conflict.setId" class="flex flex-wrap items-center gap-2">
          <span class="min-w-0 flex-1 truncate font-bold text-amber-800 dark:text-amber-200">{{ conflict.setName }}</span>
          <Button size="sm" variant="outline" class="h-7 px-2 text-[11px]" @click="resolveConflict(conflict.setId, 'local')">
            {{ $t('sync.keepLocal') }}
          </Button>
          <Button size="sm" variant="outline" class="h-7 px-2 text-[11px]" @click="resolveConflict(conflict.setId, 'remote')">
            {{ $t('sync.useCloud') }}
          </Button>
        </div>
      </div>
    </div>

    <div v-if="!compact" class="mt-3 flex flex-wrap gap-2">
      <Button v-if="configured && !isSignedIn" size="sm" variant="default" class="gap-2" @click="signIn">
        <LogIn class="h-3.5 w-3.5" />
        {{ $t('sync.signIn') }}
      </Button>
      <Button v-if="isSignedIn" size="sm" variant="outline" class="gap-2" @click="flushAll">
        <RefreshCw class="h-3.5 w-3.5" />
        {{ $t('sync.syncNow') }}
      </Button>
      <Button v-if="isSignedIn" size="sm" variant="ghost" class="gap-2" @click="signOutAccount">
        <UserRound class="h-3.5 w-3.5" />
        {{ $t('sync.signOut') }}
      </Button>
    </div>
  </div>
</template>

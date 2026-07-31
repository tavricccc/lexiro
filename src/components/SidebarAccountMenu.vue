<script setup lang="ts">
import { ChevronDown, CircleUserRound, LogIn, LogOut, Upload } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCloudSyncStore } from '@/stores/cloudSync'
import { useUIStore } from '@/stores/ui'
import Button from './ui/button/Button.vue'

const props = defineProps<{ collapsed?: boolean, mobile?: boolean }>()
const { t } = useI18n()
const cloudStore = useCloudSyncStore()
const uiStore = useUIStore()
const { configured, isSignedIn, accountLabel, status, user } = storeToRefs(cloudStore)
const { signIn, signOutAccount } = cloudStore
const menuOpen = ref(false)
const profilePhoto = computed(() => user.value?.photoURL ?? '')
const statusText = computed(() => {
  if (!configured.value)
    return t('sync.notConfigured')
  if (!isSignedIn.value)
    return t('sync.signIn')
  if (status.value === 'syncing' || status.value === 'connecting')
    return t('sync.syncing')
  if (status.value === 'offline')
    return t('sync.offline')
  return t('sync.synced')
})

async function login() {
  await signIn()
  menuOpen.value = false
}

async function logout() {
  await signOutAccount()
  menuOpen.value = false
}
</script>

<template>
  <div class="relative" :class="props.mobile ? 'w-full' : props.collapsed ? 'app-sidebar-account-collapsed' : ''">
    <button type="button" class="flex w-full text-left transition" :class="props.mobile ? ['mobile-bottom-tab', menuOpen ? 'mobile-bottom-tab--active' : ''] : ['items-center gap-3 rounded-2xl bg-ink-100/70 px-3 py-3 hover:bg-ink-200/70 dark:bg-ink-900/70 dark:hover:bg-ink-800', menuOpen ? 'ring-2 ring-accent-primary/15' : '', props.collapsed ? 'justify-center px-0' : '']" :aria-expanded="menuOpen" :aria-label="t('sync.accountMenu')" @click="menuOpen = !menuOpen">
      <img v-if="profilePhoto" :src="profilePhoto" :alt="accountLabel" :class="props.mobile ? 'h-6 w-6 shrink-0 rounded-full object-cover' : 'h-8 w-8 shrink-0 rounded-full object-cover'" referrerpolicy="no-referrer">
      <span v-else class="flex shrink-0 items-center justify-center rounded-full bg-white text-ink-500 shadow-sm dark:bg-ink-800" :class="props.mobile ? 'h-6 w-6' : 'h-8 w-8'"><CircleUserRound :class="props.mobile ? 'h-4 w-4' : 'h-5 w-5'" /></span>
      <span v-if="props.mobile" class="block max-w-full truncate text-[11px] font-bold leading-[1.1rem]">{{ $t('nav.account') }}</span>
      <span v-else-if="!props.collapsed" class="min-w-0 flex-1">
        <span class="block truncate text-xs font-black">{{ isSignedIn ? accountLabel : t('sync.loginPrompt') }}</span>
        <span class="mt-0.5 block truncate text-[11px] font-semibold text-ink-500">{{ isSignedIn ? statusText : t('sync.localMode') }}</span>
      </span>
      <ChevronDown v-if="!props.mobile && !props.collapsed" class="h-4 w-4 shrink-0 text-ink-400" :class="menuOpen ? 'rotate-180' : ''" />
    </button>

    <div v-if="menuOpen" class="absolute z-50 w-72 rounded-2xl border border-ink-200/70 bg-white p-4 shadow-[var(--shadow-floating)] dark:border-ink-700 dark:bg-ink-900" :class="props.mobile ? 'bottom-[calc(100%+0.75rem)] right-0' : 'bottom-0 left-full ml-3'">
      <div class="flex items-center gap-3">
        <img v-if="profilePhoto" :src="profilePhoto" :alt="accountLabel" class="h-10 w-10 rounded-full object-cover" referrerpolicy="no-referrer">
        <span v-else class="flex h-10 w-10 items-center justify-center rounded-full bg-ink-100 text-ink-500 dark:bg-ink-800"><CircleUserRound class="h-6 w-6" /></span>
        <div class="min-w-0">
          <p class="truncate text-sm font-black">
            {{ isSignedIn ? accountLabel : t('sync.localMode') }}
          </p>
          <p class="mt-0.5 text-xs font-semibold text-ink-500">
            {{ statusText }}
          </p>
        </div>
      </div>
      <div class="mt-4 grid gap-2">
        <Button v-if="!isSignedIn" variant="default" class="w-full justify-start gap-2" :disabled="!configured" @click="login">
          <LogIn class="h-4 w-4" />{{ $t('sync.signIn') }}
        </Button>
        <Button v-if="isSignedIn" variant="outline" class="w-full justify-start gap-2" @click="logout">
          <LogOut class="h-4 w-4" />{{ $t('sync.signOut') }}
        </Button>
        <Button variant="outline" class="w-full justify-start gap-2" @click="uiStore.openTransfer(); menuOpen = false">
          <Upload class="h-4 w-4" />{{ $t('backup.exportImport') }}
        </Button>
      </div>
    </div>
  </div>
</template>

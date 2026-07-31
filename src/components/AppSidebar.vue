<script setup lang="ts">
import { ChevronLeft, ChevronRight, Settings } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'
import { APP_NAV_ITEMS } from '@/constants/navigation'
import { useAccountStore } from '@/stores/account'
import { useUIStore } from '@/stores/ui'
import AccountAvatar from './AccountAvatar.vue'
import Button from './ui/button/Button.vue'

const route = useRoute()
const uiStore = useUIStore()
const { t } = useI18n()
const { sidebarExpanded: expanded } = storeToRefs(uiStore)
const { label: accountLabel } = storeToRefs(useAccountStore())

const isActive = (key: string) => route.name === key

function toggle() {
  uiStore.toggleSidebar()
}
</script>

<template>
  <aside class="app-sidebar fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-ink-200/60 bg-white/90 py-4 shadow-soft backdrop-blur-xl dark:border-ink-200/10 dark:bg-ink-950/90 md:flex" :class="expanded ? 'app-sidebar--expanded w-64' : 'app-sidebar--collapsed w-20'">
    <div class="relative flex h-12 items-center px-3">
      <RouterLink to="/" class="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-2xl px-3 text-ink-950 hover:bg-ink-100 dark:text-ink-50 dark:hover:bg-ink-900" :aria-label="t('app.name')">
        <img src="/icons/lexiro.png" alt="" class="h-9 w-9 shrink-0 rounded-xl object-cover" aria-hidden="true">
        <span v-if="expanded" class="truncate text-sm font-black tracking-wide">lexiro</span>
      </RouterLink>
      <Button variant="ghost" size="icon" class="absolute -right-3 h-7 w-7 rounded-full border border-ink-200 bg-white shadow-sm dark:border-ink-700 dark:bg-ink-900" :aria-label="expanded ? t('nav.collapseSidebar') : t('nav.expandSidebar')" @click="toggle">
        <ChevronLeft v-if="expanded" class="h-3.5 w-3.5" />
        <ChevronRight v-else class="h-3.5 w-3.5" />
      </Button>
    </div>

    <nav class="mt-8 flex flex-1 flex-col gap-2 px-3" :aria-label="t('nav.main')">
      <RouterLink v-for="item in APP_NAV_ITEMS" :key="item.key" :to="item.to" class="app-sidebar-item group" :class="isActive(item.key) ? 'app-sidebar-item--active' : ''" :aria-label="t(item.label)" :data-label="t(item.label)">
        <component :is="item.icon" class="h-5 w-5 shrink-0" :stroke-width="1.9" />
        <span v-if="expanded" class="truncate text-sm font-bold">{{ t(item.label) }}</span>
      </RouterLink>
    </nav>

    <div class="flex flex-col gap-2 px-3">
      <RouterLink to="/settings" class="app-sidebar-item settings-account-entry" :class="isActive('settings') ? 'app-sidebar-item--active' : ''" :data-label="t('nav.settings')">
        <AccountAvatar />
        <span v-if="expanded" class="min-w-0 flex-1 truncate text-sm font-bold">{{ accountLabel || t('nav.settings') }}</span>
        <Settings v-if="expanded" class="h-4 w-4 shrink-0 text-ink-400" :stroke-width="1.9" />
      </RouterLink>
    </div>
  </aside>
</template>

<style scoped>
.app-sidebar {
  transition: width 0.42s cubic-bezier(0.16, 1, 0.3, 1);
}

.app-sidebar-item {
  position: relative;
  display: flex;
  height: 3rem;
  width: 100%;
  align-items: center;
  gap: 0.75rem;
  overflow: visible;
  border-radius: 9999px;
  padding-inline: 0.875rem;
  color: var(--color-on-surface-variant);
  transition: background-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.app-sidebar--collapsed .app-sidebar-item {
  justify-content: center;
  padding-inline: 0;
}

.app-sidebar-item:hover,
.app-sidebar-item--active {
  background: var(--color-surface-container);
  color: var(--color-on-surface);
}

.app-sidebar-item--active {
  box-shadow: var(--shadow-control);
}

@media (min-width: 768px) and (max-width: 1100px) {
  .app-sidebar--expanded {
    width: 5rem;
  }

  .app-sidebar--expanded .app-sidebar-item {
    justify-content: center;
    padding-inline: 0;
  }

  .app-sidebar--expanded .app-sidebar-item span,
  .app-sidebar--expanded a > span,
  .app-sidebar--expanded .app-sidebar-item + span {
    display: none;
  }
}

.app-sidebar-item[data-label]::after {
  position: absolute;
  left: calc(100% + 0.65rem);
  top: 50%;
  z-index: 70;
  border-radius: 0.65rem;
  background: var(--color-on-surface);
  color: var(--color-surface);
  content: attr(data-label);
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1rem;
  opacity: 0;
  padding: 0.4rem 0.6rem;
  pointer-events: none;
  transform: translate(-0.3rem, -50%);
  transition: opacity 0.16s ease, transform 0.2s ease;
  white-space: nowrap;
}

.app-sidebar--collapsed .app-sidebar-item:hover::after,
.app-sidebar--collapsed .app-sidebar-item:focus-visible::after {
  opacity: 1;
  transform: translate(0, -50%);
}
</style>

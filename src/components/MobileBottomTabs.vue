<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'
import { LAYERS } from '@/constants/layers'
import { APP_NAV_ITEMS } from '@/constants/navigation'
import AccountAvatar from './AccountAvatar.vue'

const route = useRoute()
const { t } = useI18n()
const itemCount = APP_NAV_ITEMS.length + 1
const activeIndex = computed(() => {
  const primaryIndex = APP_NAV_ITEMS.findIndex(item => route.name === item.key)
  return primaryIndex >= 0 ? primaryIndex : route.name === 'settings' ? APP_NAV_ITEMS.length : -1
})
</script>

<template>
  <nav class="mobile-bottom-tabs fixed mx-auto max-w-md rounded-full border-0 bg-white/95 px-3 py-1.5 backdrop-blur-xl dark:bg-ink-950/95 md:hidden" :style="{ zIndex: LAYERS.navigation }" :aria-label="t('nav.main')">
    <div class="relative mx-auto grid w-full" :style="{ gridTemplateColumns: `repeat(${itemCount}, minmax(0, 1fr))` }">
      <span v-if="activeIndex >= 0" class="mobile-bottom-tabs__indicator" :style="{ width: `${100 / itemCount}%`, transform: `translateX(${activeIndex * 100}%)` }" aria-hidden="true" />
      <RouterLink v-for="item in APP_NAV_ITEMS" :key="item.key" :to="item.to" class="mobile-bottom-tab" :class="route.name === item.key ? 'mobile-bottom-tab--active' : ''">
        <component :is="item.icon" class="h-5 w-5" :stroke-width="1.9" />
        <span>{{ t(item.label) }}</span>
      </RouterLink>
      <RouterLink to="/settings" class="mobile-bottom-tab" :class="route.name === 'settings' ? 'mobile-bottom-tab--active' : ''" :aria-label="t('nav.settings')">
        <AccountAvatar size="sm" />
        <span>{{ t('nav.settings') }}</span>
      </RouterLink>
    </div>
  </nav>
</template>

<style scoped>
.mobile-bottom-tabs {
  bottom: max(0.9375rem, env(safe-area-inset-bottom));
  left: max(var(--app-viewport-gutter), env(safe-area-inset-left));
  right: max(var(--app-viewport-gutter), env(safe-area-inset-right));
  box-shadow: var(--shadow-floating);
  contain: layout paint;
  isolation: isolate;
  transform: translateZ(0);
}

.mobile-bottom-tabs__indicator {
  position: absolute;
  inset-block: 0;
  left: 0;
  border-radius: 9999px;
  background: var(--color-surface-container);
  box-shadow: var(--shadow-control);
  transition: transform 0.42s cubic-bezier(0.16, 1, 0.3, 1);
}

.mobile-bottom-tabs :deep(.mobile-bottom-tab) {
  position: relative;
  z-index: var(--layer-local-content);
  display: flex;
  min-width: 0;
  height: 3rem;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.125rem;
  border-radius: 9999px;
  color: var(--color-on-surface-variant);
  font-size: 0.6875rem;
  font-weight: 600;
  transition: transform 0.2s ease, color 0.2s ease;
}

.mobile-bottom-tabs :deep(.mobile-bottom-tab--active) {
  color: var(--color-on-surface);
}

.mobile-bottom-tabs :deep(.mobile-bottom-tab:active) {
  transform: scale(1.05);
}

.mobile-bottom-tabs :deep(.mobile-bottom-tab:is(:active, .is-pressing):not([aria-disabled='true'])) {
  background: color-mix(in srgb, var(--color-secondary-container) 96%, transparent);
  box-shadow: var(--shadow-card);
  filter: brightness(1.08) saturate(1.04);
}
</style>

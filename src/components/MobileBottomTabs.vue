<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'
import { APP_NAV_ITEMS } from '@/constants/navigation'

const route = useRoute()
const { t } = useI18n()
const activeIndex = computed(() => APP_NAV_ITEMS.findIndex(item => route.name === item.key))
</script>

<template>
  <nav class="mobile-bottom-tabs fixed inset-x-3 bottom-3 z-40 mx-auto max-w-md rounded-full border border-ink-200/60 bg-white/90 px-2 py-1.5 shadow-floating backdrop-blur-xl dark:border-ink-700/60 dark:bg-ink-950/90 md:hidden" :aria-label="t('nav.main')">
    <div class="relative grid grid-cols-5 gap-1">
      <span v-if="activeIndex >= 0" class="mobile-bottom-tabs__indicator" :style="{ width: `${100 / APP_NAV_ITEMS.length}%`, transform: `translateX(${activeIndex * 100}%)` }" aria-hidden="true" />
      <RouterLink v-for="item in APP_NAV_ITEMS" :key="item.key" :to="item.to" class="mobile-bottom-tab" :class="route.name === item.key ? 'mobile-bottom-tab--active' : ''">
        <component :is="item.icon" class="h-5 w-5" :stroke-width="1.9" />
        <span>{{ t(item.label) }}</span>
      </RouterLink>
    </div>
  </nav>
</template>

<style scoped>
.mobile-bottom-tabs__indicator {
  position: absolute;
  inset-block: 0;
  left: 0;
  border-radius: 9999px;
  background: var(--color-surface-container);
  box-shadow: var(--shadow-control);
  transition: transform 0.42s cubic-bezier(0.16, 1, 0.3, 1);
}

.mobile-bottom-tab {
  position: relative;
  z-index: 1;
  display: flex;
  min-width: 0;
  height: 3rem;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.1rem;
  border-radius: 9999px;
  color: var(--color-on-surface-variant);
  font-size: 0.65rem;
  font-weight: 800;
  transition: transform 0.2s ease, color 0.2s ease;
}

.mobile-bottom-tab--active {
  color: var(--color-on-surface);
}

.mobile-bottom-tab:active {
  transform: scale(1.05);
}
</style>

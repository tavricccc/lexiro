<script setup lang="ts">
import { BarChart3, BookMarked, BookOpen, Brain, Library } from 'lucide-vue-next'
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

const route = useRoute()
const items = [
  { key: 'home', to: '/', label: '首頁', icon: Brain },
  { key: 'study', to: '/study', label: '學習', icon: BookOpen },
  { key: 'library', to: '/library', label: '字庫', icon: Library },
  { key: 'dictionary', to: '/dictionary', label: '字典', icon: BookMarked },
  { key: 'stats', to: '/stats', label: '統計', icon: BarChart3 },
]
const activeIndex = computed(() => items.findIndex(item => route.name === item.key))
</script>

<template>
  <nav class="mobile-bottom-tabs fixed inset-x-3 bottom-3 z-40 mx-auto max-w-md rounded-full border border-ink-200/60 bg-white/90 px-2 py-1.5 shadow-floating backdrop-blur-xl dark:border-ink-700/60 dark:bg-ink-950/90 md:hidden" aria-label="主要導覽">
    <div class="relative grid grid-cols-5 gap-1">
      <span v-if="activeIndex >= 0" class="mobile-bottom-tabs__indicator" :style="{ width: `${100 / items.length}%`, transform: `translateX(${activeIndex * 100}%)` }" aria-hidden="true" />
      <RouterLink v-for="item in items" :key="item.key" :to="item.to" class="mobile-bottom-tab" :class="route.name === item.key ? 'mobile-bottom-tab--active' : ''">
        <component :is="item.icon" class="h-5 w-5" :stroke-width="1.9" />
        <span>{{ item.label }}</span>
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

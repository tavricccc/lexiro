<script setup lang="ts">
import { CircleUserRound } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useAccountStore } from '@/stores/account'

const props = withDefaults(defineProps<{ size?: 'sm' | 'md' }>(), { size: 'md' })
const accountStore = useAccountStore()
const { label, photoUrl } = storeToRefs(accountStore)
const sizeClass = computed(() => props.size === 'sm' ? 'h-6 w-6' : 'h-8 w-8')
const iconClass = computed(() => props.size === 'sm' ? 'h-4 w-4' : 'h-5 w-5')
</script>

<template>
  <img v-if="photoUrl" :src="photoUrl" :alt="label" class="shrink-0 rounded-full object-cover" :class="[sizeClass]" referrerpolicy="no-referrer">
  <span v-else class="flex shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-300" :class="[sizeClass]" aria-hidden="true">
    <CircleUserRound :class="iconClass" />
  </span>
</template>

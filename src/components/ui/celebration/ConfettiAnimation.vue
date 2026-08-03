<script setup lang="ts">
import { DotLottieVue } from '@lottiefiles/dotlottie-vue'
import { onMounted, onUnmounted, ref } from 'vue'
import { CONFETTI_LOTTIE } from '@/constants/animations'
import { LAYERS } from '@/constants/layers'
import { useReducedMotion } from '@/lib/use-reduced-motion'

const props = withDefaults(defineProps<{
  duration?: number
}>(), {
  duration: 5200,
})

const visible = ref(true)
const reducedMotion = useReducedMotion()
let hideTimer: ReturnType<typeof setTimeout> | null = null

onMounted(() => {
  hideTimer = setTimeout(() => {
    visible.value = false
  }, props.duration)
})

onUnmounted(() => {
  if (hideTimer)
    clearTimeout(hideTimer)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="celebration-overlay">
      <div v-if="visible && !reducedMotion" class="pointer-events-none fixed inset-0 overflow-hidden" :style="{ zIndex: LAYERS.celebration }" aria-hidden="true">
        <DotLottieVue :src="CONFETTI_LOTTIE" autoplay class="h-full w-full" />
      </div>
    </Transition>
  </Teleport>
</template>

import { onMounted, onUnmounted, ref } from 'vue'

export function useReducedMotion() {
  const reducedMotion = ref(false)
  let mediaQuery: MediaQueryList | null = null

  const update = () => {
    reducedMotion.value = mediaQuery?.matches ?? false
  }

  onMounted(() => {
    mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    update()
    mediaQuery.addEventListener('change', update)
  })

  onUnmounted(() => {
    mediaQuery?.removeEventListener('change', update)
  })

  return reducedMotion
}

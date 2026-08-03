import { defineComponent, h } from 'vue'

const instance = {
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  setFrame: () => undefined,
}

export const DotLottieVue = defineComponent({
  name: 'DotLottieVue',
  setup(_, { expose }) {
    expose({ getDotLottieInstance: () => instance })
    return () => h('div', { 'data-testid': 'lottie-placeholder' })
  },
})

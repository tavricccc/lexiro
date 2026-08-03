// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import LottieLoadingOverlay from '@/components/ui/loading-overlay/LottieLoadingOverlay.vue'
import { i18n } from '@/lib/i18n'

describe('loading overlay', () => {
  it('keeps page loading inside the content area without visible text', () => {
    const wrapper = mount(LottieLoadingOverlay, {
      attachTo: document.body,
      global: { plugins: [i18n] },
      props: {
        open: true,
        fullscreen: false,
        showMessage: false,
        showProgress: false,
      },
    })

    const overlay = document.body.querySelector('[role="status"]')
    expect(overlay?.classList.contains('absolute')).toBe(true)
    expect(overlay?.classList.contains('fixed')).toBe(false)
    expect(overlay?.textContent?.trim()).toBe('')
    wrapper.unmount()
  })

  it('keeps sync loading as a fullscreen status overlay by default', () => {
    const wrapper = mount(LottieLoadingOverlay, {
      attachTo: document.body,
      global: { plugins: [i18n] },
      props: {
        open: true,
        message: '正在同步',
      },
    })

    const overlay = document.body.querySelector('[role="status"]')
    expect(overlay?.classList.contains('fixed')).toBe(true)
    expect(overlay?.textContent).toContain('正在同步')
    wrapper.unmount()
  })
})

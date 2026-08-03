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
        revealDelay: 0,
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
        revealDelay: 0,
      },
    })

    const overlay = document.body.querySelector('[role="status"]')
    expect(overlay?.classList.contains('fixed')).toBe(true)
    expect(overlay?.textContent).toContain('正在同步')
    expect(overlay?.querySelector('[role="progressbar"]')?.classList.contains('h-1')).toBe(true)
    const progressbar = overlay?.querySelector('[role="progressbar"]')
    const message = Array.from(overlay?.querySelectorAll('p') ?? []).find(element => element.textContent?.includes('正在同步'))
    expect(progressbar && message && Boolean(progressbar.compareDocumentPosition(message) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true)
    wrapper.unmount()
  })
})

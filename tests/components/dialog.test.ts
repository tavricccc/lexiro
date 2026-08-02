// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Dialog from '@/components/ui/dialog/Dialog.vue'
import { i18n } from '@/lib/i18n'

describe('dialog close policy', () => {
  it('closes on Escape by default', async () => {
    const wrapper = mount(Dialog, {
      attachTo: document.body,
      global: { plugins: [i18n] },
      props: { open: true, title: 'Confirm' },
    })

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })

  it('blocks Escape and backdrop close for mandatory dialogs', async () => {
    const wrapper = mount(Dialog, {
      attachTo: document.body,
      global: { plugins: [i18n] },
      props: { open: true, title: 'Update', closePolicy: 'blocked', showClose: false },
    })

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    const overlay = document.body.querySelector<HTMLElement>('[role="presentation"]')
    expect(overlay).not.toBeNull()
    await overlay?.click()

    expect(wrapper.emitted('close')).toBeUndefined()
    wrapper.unmount()
  })

  it('only lets the topmost dialog handle Escape', () => {
    const outer = mount(Dialog, {
      attachTo: document.body,
      global: { plugins: [i18n] },
      props: { open: true, title: 'Outer', overlayZIndex: 50 },
    })
    const inner = mount(Dialog, {
      attachTo: document.body,
      global: { plugins: [i18n] },
      props: { open: true, title: 'Inner', overlayZIndex: 60 },
    })

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(outer.emitted('close')).toBeUndefined()
    expect(inner.emitted('close')).toHaveLength(1)
    outer.unmount()
    inner.unmount()
  })

  it('uses DOM order to resolve dialogs sharing a layer', () => {
    const first = mount(Dialog, {
      attachTo: document.body,
      global: { plugins: [i18n] },
      props: { open: true, title: 'First', overlayZIndex: 50 },
    })
    const second = mount(Dialog, {
      attachTo: document.body,
      global: { plugins: [i18n] },
      props: { open: true, title: 'Second', overlayZIndex: 50 },
    })

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(first.emitted('close')).toBeUndefined()
    expect(second.emitted('close')).toHaveLength(1)
    first.unmount()
    second.unmount()
  })
})

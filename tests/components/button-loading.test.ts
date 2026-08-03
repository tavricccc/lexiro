// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Button from '@/components/ui/button/Button.vue'

describe('button loading state', () => {
  it('replaces visible content with a centered spinner without changing the button width', async () => {
    const wrapper = mount(Button, { props: { loading: false }, slots: { default: '儲存' } })
    const widthBefore = wrapper.element.getBoundingClientRect().width

    await wrapper.setProps({ loading: true })

    expect(wrapper.attributes('disabled')).toBeDefined()
    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.find('span').classes()).toContain('opacity-0')
    expect(wrapper.element.getBoundingClientRect().width).toBe(widthBefore)
  })
})

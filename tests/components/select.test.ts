// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import Select from '@/components/ui/select/Select.vue'

describe('select', () => {
  it('teleports the listbox and selects an option', async () => {
    const wrapper = mount(Select, {
      attachTo: document.body,
      props: {
        modelValue: 'one',
        options: [
          { value: 'one', label: 'One' },
          { value: 'two', label: 'Two' },
        ],
      },
    })

    await wrapper.get('button[role="combobox"]').trigger('click')
    const listbox = document.body.querySelector('[role="listbox"]')
    expect(listbox).not.toBeNull()
    expect((listbox as HTMLElement).style.position).toBe('fixed')
    expect(listbox?.querySelectorAll('[role="option"]')).toHaveLength(2)

    const secondOption = Array.from(listbox?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])
      .find(option => option.textContent?.includes('Two'))
    secondOption?.click()
    await nextTick()
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['two'])
    expect(wrapper.get('button[role="combobox"]').attributes('aria-expanded')).toBe('false')
    wrapper.unmount()
  })

  it('skips disabled options during keyboard navigation', async () => {
    const wrapper = mount(Select, {
      attachTo: document.body,
      props: {
        options: [
          { value: 'one', label: 'One' },
          { value: 'disabled', label: 'Disabled', disabled: true },
          { value: 'three', label: 'Three' },
        ],
      },
    })
    const trigger = wrapper.get('button[role="combobox"]')

    await trigger.trigger('keydown', { key: 'ArrowDown' })
    await trigger.trigger('keydown', { key: 'ArrowDown' })
    await trigger.trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['three'])
    wrapper.unmount()
  })

  it('opens and highlights a matching option for typeahead', async () => {
    const wrapper = mount(Select, {
      attachTo: document.body,
      props: {
        options: [
          { value: 'apple', label: 'Apple' },
          { value: 'banana', label: 'Banana' },
        ],
      },
    })
    const trigger = wrapper.get('button[role="combobox"]')

    await trigger.trigger('keydown', { key: 'b' })

    const listbox = document.body.querySelector('[role="listbox"]')
    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(trigger.attributes('aria-activedescendant')).toBe(listbox?.querySelectorAll('[role="option"]')[1]?.id)
    wrapper.unmount()
  })
})

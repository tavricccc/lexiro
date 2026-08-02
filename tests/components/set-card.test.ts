// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it } from 'vitest'
import SetCard from '@/components/SetCard.vue'
import { i18n } from '@/lib/i18n'

describe('set card actions menu', () => {
  it('puts edit, move, and delete actions under the three-dot menu', async () => {
    const wrapper = mount(SetCard, {
      global: { plugins: [createPinia(), i18n] },
      props: {
        set: {
          id: 'set-1',
          setName: 'Fruits',
          folderId: '__uncategorized__',
          createdAt: '',
          updatedAt: '',
        },
        folders: [
          { id: '__uncategorized__', name: '未分類', parentId: undefined, order: -1, createdAt: '', updatedAt: '' },
          { id: 'folder-1', name: '學校', parentId: undefined, order: 0, createdAt: '', updatedAt: '' },
        ],
      },
    })

    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    await wrapper.find('button[aria-label="單字集操作"]').trigger('click')
    expect(wrapper.find('[role="menu"]').text()).toContain('編輯單字集')
    expect(wrapper.find('[role="menu"]').text()).toContain('移動到資料夾')
    expect(wrapper.find('[role="menu"]').text()).toContain('刪除單字集')

    const folderButton = wrapper.findAll('[role="menuitem"]').find(button => button.text().includes('學校'))
    await folderButton?.trigger('click')
    expect(wrapper.emitted('move')?.[0]).toEqual(['set-1', 'folder-1'])
  })
})

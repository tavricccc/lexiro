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

    expect(document.body.querySelector('[role="menu"]')).toBeNull()
    await wrapper.find('button[aria-label="單字集操作"]').trigger('click')
    const menu = document.body.querySelector('[role="menu"]')
    expect(menu?.textContent).toContain('編輯單字集')
    expect(menu?.textContent).toContain('移動到資料夾')
    expect(menu?.textContent).toContain('刪除單字集')

    const folderButton = Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'))
      .find(button => button.textContent?.includes('學校'))
    folderButton?.click()
    expect(wrapper.emitted('move')?.[0]).toEqual(['set-1', 'folder-1'])
    wrapper.unmount()
  })
})

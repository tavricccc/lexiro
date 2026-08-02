// @vitest-environment happy-dom

import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import FolderManageDialog from '@/components/dialogs/FolderManageDialog.vue'
import { i18n } from '@/lib/i18n'
import { useLibraryStore } from '@/stores/library'
import { useUIStore } from '@/stores/ui'

describe('folder manage dialog', () => {
  it('deletes a folder after confirmation', async () => {
    setActivePinia(createPinia())
    const libraryStore = useLibraryStore()
    const uiStore = useUIStore()
    const folder = libraryStore.addFolder('Work')
    const router = createRouter({ history: createMemoryHistory(), routes: [] })

    const wrapper = mount(FolderManageDialog, {
      attachTo: document.body,
      global: { plugins: [i18n, router] },
      props: { open: true, folder },
    })
    const deleteButton = Array.from(document.body.querySelectorAll('button')).find(button => button.textContent?.includes('刪除資料夾'))

    expect(deleteButton).toBeDefined()
    deleteButton?.click()
    await flushPromises()
    expect(uiStore.confirmOpen).toBe(true)

    uiStore.resolveConfirm(true)
    await flushPromises()

    expect(libraryStore.folders.some(item => item.id === folder.id)).toBe(false)
    expect(wrapper.emitted('deleted')).toHaveLength(1)
    wrapper.unmount()
  })
})

// @vitest-environment happy-dom

import type { VueWrapper } from '@vue/test-utils'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import ImportDialog from '@/components/dialogs/ImportDialog.vue'
import { i18n } from '@/lib/i18n'
import { buildSenseId } from '@/lib/library'
import { useSetsStore } from '@/stores/sets'

function mountImportDialog() {
  const pinia = createPinia()
  const wrapper = mount(ImportDialog, {
    attachTo: document.body,
    global: {
      plugins: [pinia, i18n],
    },
  })
  return { store: useSetsStore(pinia), wrapper }
}

let wrapper: VueWrapper | null = null

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('output file import dialog', () => {
  it('only exposes the output JSON file importer', async () => {
    const mounted = mountImportDialog()
    wrapper = mounted.wrapper

    mounted.store.openImport()
    await nextTick()

    expect(document.body.textContent).toContain('匯入 output 資料夾中的單字或題目 JSON')
    expect(document.body.textContent).not.toContain('AI JSON 匯入')
    expect(document.body.querySelector('input[type="file"]')).not.toBeNull()
  })

  it('imports a vocab output file as a new set', async () => {
    const mounted = mountImportDialog()
    wrapper = mounted.wrapper
    mounted.store.openImport()
    await nextTick()

    const input = document.body.querySelector('input[type="file"]')
    if (!(input instanceof HTMLInputElement))
      throw new TypeError('file input not found')
    const json = JSON.stringify({
      schemaVersion: 1,
      kind: 'words',
      batch: 1,
      words: [{
        wordKey: 'apple',
        word: 'apple',
        senses: [{ id: buildSenseId('apple', 'n.', '蘋果'), pos: 'n.', meaningZh: '蘋果', examples: [] }],
        updatedAt: '2026-08-02T00:00:00.000Z',
      }],
    })
    const file = new File([json], 'vocab-001.json', { type: 'application/json' })
    Object.defineProperty(file, 'text', { configurable: true, value: async () => json })
    Object.defineProperty(input, 'files', { configurable: true, value: [file] })
    input.dispatchEvent(new Event('change', { bubbles: true }))

    await new Promise(resolve => setTimeout(resolve, 20))
    expect(mounted.store.importError).toBe('')
    expect(mounted.store.sets).toHaveLength(0)
    expect(document.body.textContent).toContain('vocab-001.json')
    const applyButton = Array.from(document.body.querySelectorAll('button')).find(button => button.textContent?.includes('確認匯入'))
    expect(applyButton).toBeDefined()
    applyButton!.click()
    await vi.waitFor(() => expect(mounted.store.sets).toHaveLength(1))
    expect(mounted.store.sets[0].setName).toBe('vocab-001')
  })
})

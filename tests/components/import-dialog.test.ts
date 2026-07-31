// @vitest-environment happy-dom

import type { VueWrapper } from '@vue/test-utils'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import ImportDialog from '@/components/dialogs/ImportDialog.vue'
import { i18n } from '@/lib/i18n'
import { useSetsStore } from '@/stores/sets'

function findButton(label: string): HTMLButtonElement {
  const button = Array.from(document.body.querySelectorAll('button')).find(element =>
    element.textContent?.includes(label),
  )

  if (!(button instanceof HTMLButtonElement)) {
    throw new TypeError(`Button not found: ${label}`)
  }

  return button
}

function findExactButton(label: string): HTMLButtonElement {
  const button = Array.from(document.body.querySelectorAll('button')).find(element =>
    element.textContent?.trim() === label,
  )

  if (!(button instanceof HTMLButtonElement)) {
    throw new TypeError(`Button not found: ${label}`)
  }

  return button
}

function mountImportDialog() {
  const pinia = createPinia()
  const wrapper = mount(ImportDialog, {
    attachTo: document.body,
    global: {
      plugins: [pinia, i18n],
    },
  })
  const store = useSetsStore(pinia)

  return { store, wrapper }
}

let wrapper: VueWrapper | null = null

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('import dialog', () => {
  it('defaults to manual fields and can switch to the AI JSON flow', async () => {
    const mounted = mountImportDialog()
    wrapper = mounted.wrapper
    const { store } = mounted

    store.openImport()
    await nextTick()

    expect(store.importOpen).toBe(true)
    expect(document.body.textContent).toContain('每個單字只需要填寫英文單字、詞性與繁體中文意思')

    findButton('AI JSON 匯入').click()
    await nextTick()

    expect(store.importOpen).toBe(true)
    expect(store.importStep).toBe(1)
    expect(document.body.textContent).toContain('輸入要交給 AI 整理的英文單字')

    store.nextImportStep()
    await nextTick()

    expect(store.importStep).toBe(2)
    expect(document.body.textContent).toContain('或者直接貼上 JSON')
    expect(document.body.textContent).toContain('匯入')
    expect(document.body.querySelector('textarea')?.getAttribute('placeholder')).toContain('items')
  })

  it('creates a set after importing valid JSON from the second step', async () => {
    const mounted = mountImportDialog()
    wrapper = mounted.wrapper
    const { store } = mounted

    store.openImport()
    await nextTick()
    findButton('AI JSON 匯入').click()
    store.nextImportStep()
    store.importJson = JSON.stringify({
      setName: 'Fruits',
      items: [
        {
          word: 'apple',
          meaning: '蘋果',
          example: 'I eat an apple.',
          question: {
            prompt: '蘋果的英文是？',
            opts: ['apple', 'banana', 'cherry', 'date'],
            ans: 0,
          },
        },
      ],
    })
    await nextTick()

    findExactButton('匯入').click()
    await nextTick()

    expect(store.importOpen).toBe(false)
    expect(store.setEditorOpen).toBe(false)
    expect(store.sets).toHaveLength(1)
    expect(store.sets[0].setName).toBe('Fruits')
    expect(store.sets[0].items[0].word).toBe('apple')
    expect(store.sets[0].items[0].pos).toBe('')
  })
})

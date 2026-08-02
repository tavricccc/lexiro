// @vitest-environment happy-dom

import type { VueWrapper } from '@vue/test-utils'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import ImportDialog from '@/components/dialogs/ImportDialog.vue'
import { i18n } from '@/lib/i18n'
import { useLibraryStore } from '@/stores/library'
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
  const libraryStore = useLibraryStore(pinia)

  return { store, libraryStore, wrapper }
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
    expect(document.body.textContent).toContain('每個單字可以加入多個字義；例句是選填。')

    findButton('AI JSON 匯入').click()
    await nextTick()

    expect(store.importOpen).toBe(true)
    expect(store.importStep).toBe(1)
    expect(document.body.textContent).toContain('輸入要交給 AI 整理的英文單字')

    store.nextImportStep()
    await nextTick()

    expect(store.importStep).toBe(2)
    expect(document.body.textContent).toContain('或者直接貼上 JSON')
    expect(document.body.querySelector('textarea')?.getAttribute('placeholder')).toContain('senses')
  })

  it('creates a set after parsing a source-bound AI response', async () => {
    const mounted = mountImportDialog()
    wrapper = mounted.wrapper
    const { store, libraryStore } = mounted

    const previousClipboard = navigator.clipboard
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })

    try {
      store.openImport()
      await nextTick()
      findButton('AI JSON 匯入').click()
      store.importWords = 'apple'
      await nextTick()
      findExactButton('複製匯入指令').click()
      await nextTick()
      expect(writeText).toHaveBeenCalledOnce()
      await vi.waitFor(() => expect(store.importStep).toBe(2))

      store.importJson = JSON.stringify({
        kind: 'words',
        words: [{
          sourceRef: 'source-1',
          word: 'apple',
          senses: [{ pos: 'n.', meaningZh: '蘋果', examples: [] }],
        }],
      })
      await nextTick()
      findExactButton('解析 AI 回覆').click()
      await nextTick()

      const setNameInput = Array.from(document.body.querySelectorAll('input')).find(input => input.getAttribute('placeholder') === '單字集名稱')
      expect(setNameInput).not.toBeUndefined()
      setNameInput!.value = 'Fruits'
      setNameInput!.dispatchEvent(new Event('input', { bubbles: true }))
      await nextTick()
      findExactButton('建立單字集').click()
      await nextTick()

      expect(store.importOpen).toBe(false)
      expect(store.sets).toHaveLength(1)
      expect(store.sets[0].setName).toBe('Fruits')
      const studyWords = libraryStore.getSetStudyWords(store.sets[0].id)
      expect(studyWords[0].word).toBe('apple')
      expect(studyWords[0].pos).toBe('n.')
    }
    finally {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: previousClipboard })
    }
  })
})

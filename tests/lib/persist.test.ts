import { describe, expect, it } from 'vitest'
import { loadFromStorage, saveToStorage, setStorageNamespace } from '@/lib/persist'

describe('persist', () => {
  it('saves data to the shared repository', async () => {
    await saveToStorage('target-key', { value: 1 })

    await expect(loadFromStorage('target-key')).resolves.toEqual({
      value: JSON.stringify({ value: 1 }),
    })
  })

  it('loads the current repository key', async () => {
    await saveToStorage('target-key', 'target')

    const result = await loadFromStorage('target-key')

    expect(result).toEqual({
      value: 'target',
    })
  })

  it('stores small and large values through the same path', async () => {
    await saveToStorage('target-key', { value: 'small' })
    await saveToStorage('large-key', { value: 'x'.repeat(300_000) })

    await expect(loadFromStorage('target-key')).resolves.toEqual({
      value: JSON.stringify({ value: 'small' }),
    })
    await expect(loadFromStorage('large-key')).resolves.toEqual({
      value: JSON.stringify({ value: 'x'.repeat(300_000) }),
    })
  })

  it('isolates user preferences between namespaces', async () => {
    setStorageNamespace('guest-test')
    await saveToStorage('lexiro_ui_data', { questionCountPreference: 3 })

    setStorageNamespace('account-test')
    await expect(loadFromStorage('lexiro_ui_data')).resolves.toEqual({ value: null })

    setStorageNamespace('guest-test')
    await expect(loadFromStorage('lexiro_ui_data')).resolves.toEqual({
      value: JSON.stringify({ questionCountPreference: 3 }),
    })
    setStorageNamespace('guest')
  })
})

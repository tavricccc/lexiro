import { beforeEach, describe, expect, it } from 'vitest'
import { loadFromStorage, saveToStorage } from '@/lib/persist'

class MemoryStorage implements Storage {
  private store = new Map<string, string>()

  get length(): number {
    return this.store.size
  }

  clear(): void {
    this.store.clear()
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
}

describe('persist', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: new MemoryStorage(),
      configurable: true,
    })
  })

  it('saves data to localStorage synchronously', () => {
    saveToStorage('target-key', { value: 1 })

    expect(localStorage.getItem('target-key')).toBe(JSON.stringify({ value: 1 }))
  })

  it('loads the current storage key', async () => {
    localStorage.setItem('target-key', 'target')

    const result = await loadFromStorage('target-key')

    expect(result).toEqual({
      value: 'target',
    })
  })
})

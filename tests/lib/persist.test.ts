import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadFromStorage, migrateStorage, saveToStorage } from '@/lib/persist'

const idbMock = vi.hoisted(() => {
  const store = new Map<string, string>()
  return {
    store,
    get: vi.fn((key: string) => Promise.resolve(store.get(key))),
  }
})

vi.mock('idb-keyval', () => ({
  get: idbMock.get,
}))

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
    idbMock.store.clear()
    idbMock.get.mockClear()
  })

  it('saves data to localStorage synchronously', () => {
    saveToStorage('target-key', { value: 1 })

    expect(localStorage.getItem('target-key')).toBe(JSON.stringify({ value: 1 }))
  })

  it('loads the target key before legacy keys', async () => {
    localStorage.setItem('target-key', 'target')
    localStorage.setItem('legacy-key', 'legacy')

    const result = await loadFromStorage('target-key', ['legacy-key'])

    expect(result).toEqual({
      value: 'target',
      sourceKey: 'target-key',
      source: 'localStorage',
    })
  })

  it('loads legacy localStorage when the target key is empty', async () => {
    localStorage.setItem('legacy-key', 'legacy')

    const result = await loadFromStorage('target-key', ['legacy-key'])

    expect(result).toEqual({
      value: 'legacy',
      sourceKey: 'legacy-key',
      source: 'localStorage',
    })
  })

  it('falls back to legacy IndexedDB data', async () => {
    idbMock.store.set('legacy-key', 'legacy-idb')

    const result = await loadFromStorage('target-key', ['legacy-key'])

    expect(result).toEqual({
      value: 'legacy-idb',
      sourceKey: 'legacy-key',
      source: 'indexedDB',
    })
  })

  it('migrates valid legacy localStorage data only when target is empty', async () => {
    localStorage.setItem('legacy-key', JSON.stringify({ ok: true }))

    const migrated = await migrateStorage('legacy-key', 'target-key', raw => JSON.parse(raw).ok === true)

    expect(migrated).toBe(true)
    expect(localStorage.getItem('target-key')).toBe(JSON.stringify({ ok: true }))
  })

  it('does not overwrite an existing target during migration', async () => {
    localStorage.setItem('target-key', 'existing')
    localStorage.setItem('legacy-key', 'legacy')

    const migrated = await migrateStorage('legacy-key', 'target-key', () => true)

    expect(migrated).toBe(false)
    expect(localStorage.getItem('target-key')).toBe('existing')
  })

  it('migrates valid legacy IndexedDB data', async () => {
    idbMock.store.set('legacy-key', JSON.stringify({ ok: true }))

    const migrated = await migrateStorage('legacy-key', 'target-key', raw => JSON.parse(raw).ok === true)

    expect(migrated).toBe(true)
    expect(localStorage.getItem('target-key')).toBe(JSON.stringify({ ok: true }))
  })
})

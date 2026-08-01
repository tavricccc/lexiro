import { del, get, set } from 'idb-keyval'

export interface StorageLoadResult {
  value: string | null
}

const INDEXED_DB_MARKER = '__indexeddb__'
const INDEXED_DB_PREFIX = 'lexiro-storage:'
const INDEXED_DB_THRESHOLD = 250_000
const INDEXED_DB_KEYS = new Set(['lexiro_library_data'])
const indexedDbWrites = new Map<string, Promise<void>>()

function canUseIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined'
}

function indexedDbKey(key: string): string {
  return `${INDEXED_DB_PREFIX}${key}`
}

function queueIndexedDbWrite(key: string, write: () => Promise<void>) {
  const previous = indexedDbWrites.get(key) ?? Promise.resolve()
  const next = previous.catch(() => undefined).then(write)
  indexedDbWrites.set(key, next)
  void next.then(() => {
    if (indexedDbWrites.get(key) === next)
      indexedDbWrites.delete(key)
  }, () => {
    if (indexedDbWrites.get(key) === next)
      indexedDbWrites.delete(key)
  })
}

export function saveToStorage(key: string, data: unknown): void {
  const serialized = JSON.stringify(data)
  if (canUseIndexedDb() && (INDEXED_DB_KEYS.has(key) || serialized.length > INDEXED_DB_THRESHOLD)) {
    queueIndexedDbWrite(key, async () => {
      await set(indexedDbKey(key), serialized)
      try {
        localStorage.setItem(key, INDEXED_DB_MARKER)
      }
      catch {
        try {
          localStorage.removeItem(key)
        }
        catch {
          // IndexedDB remains the source of truth when localStorage is full.
        }
      }
    })
    return
  }

  localStorage.setItem(key, serialized)
  if (canUseIndexedDb()) {
    queueIndexedDbWrite(key, async () => {
      await del(indexedDbKey(key))
    })
  }
}

export async function loadFromStorage(key: string): Promise<StorageLoadResult> {
  const local = localStorage.getItem(key)
  if (local === INDEXED_DB_MARKER && canUseIndexedDb()) {
    try {
      const indexed = await get<string>(indexedDbKey(key))
      return { value: indexed ?? null }
    }
    catch {
      return { value: null }
    }
  }
  if (local) {
    if (canUseIndexedDb() && INDEXED_DB_KEYS.has(key)) {
      try {
        await set(indexedDbKey(key), local)
        localStorage.setItem(key, INDEXED_DB_MARKER)
      }
      catch {
        // Keep using the local copy if IndexedDB is unavailable or blocked.
      }
    }
    return {
      value: local,
    }
  }
  if (canUseIndexedDb()) {
    try {
      const indexed = await get<string>(indexedDbKey(key))
      if (indexed)
        return { value: indexed }
    }
    catch {
      // Treat an unavailable IndexedDB as an empty optional cache.
    }
  }
  return {
    value: null,
  }
}

/** Debounced save helper: schedule() coalesces writes; flush() writes immediately. */
export function createDebouncedSaver(write: () => void, delayMs = 300) {
  let timer: ReturnType<typeof setTimeout> | null = null

  function cancel() {
    if (timer != null) {
      clearTimeout(timer)
      timer = null
    }
  }

  function schedule() {
    cancel()
    timer = setTimeout(() => {
      timer = null
      write()
    }, delayMs)
  }

  function flush() {
    cancel()
    write()
  }

  return { schedule, flush, cancel }
}

import { get, set } from 'idb-keyval'

export interface StorageLoadResult {
  value: string | null
}

const pendingWrites = new Map<string, Promise<void>>()
let storageNamespace = 'guest'

const NAMESPACE_SCOPED_KEYS = new Set([
  'lexiro_session_data',
  'lexiro_learning_data',
  'lexiro_library_data',
  'lexiro_ai_settings',
  'lexiro_ui_data',
])

export function setStorageNamespace(namespace: string): void {
  const normalized = namespace.trim()
  storageNamespace = normalized || 'guest'
}

export function getStorageNamespace(): string {
  return storageNamespace
}

function resolveKey(key: string): string {
  return NAMESPACE_SCOPED_KEYS.has(key) ? `${storageNamespace}:${key}` : key
}

function enqueueWrite(key: string, write: () => Promise<void>): Promise<void> {
  const previous = pendingWrites.get(key) ?? Promise.resolve()
  const next = previous.catch(() => undefined).then(write)
  pendingWrites.set(key, next)
  void next.then(() => {
    if (pendingWrites.get(key) === next)
      pendingWrites.delete(key)
  }, () => {
    if (pendingWrites.get(key) === next)
      pendingWrites.delete(key)
  })
  return next
}

export function saveToStorage(key: string, data: unknown): Promise<void> {
  const serialized = typeof data === 'string' ? data : JSON.stringify(data)
  const resolvedKey = resolveKey(key)
  return enqueueWrite(resolvedKey, async () => {
    await set(resolvedKey, serialized)
  })
}

export async function loadFromStorage(key: string): Promise<StorageLoadResult> {
  const resolvedKey = resolveKey(key)
  await pendingWrites.get(resolvedKey)
  return { value: await get<string>(resolvedKey) ?? null }
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

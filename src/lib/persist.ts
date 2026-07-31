export interface StorageLoadResult {
  value: string | null
}

export function saveToStorage(key: string, data: unknown): void {
  localStorage.setItem(key, JSON.stringify(data))
}

export async function loadFromStorage(key: string): Promise<StorageLoadResult> {
  const local = localStorage.getItem(key)
  if (local) {
    return {
      value: local,
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

import { get } from 'idb-keyval'

export interface StorageLoadResult {
  value: string | null
  sourceKey: string | null
  source: 'localStorage' | 'indexedDB' | null
}

export function saveToStorage(key: string, data: unknown): void {
  localStorage.setItem(key, JSON.stringify(data))
}

function isValidRaw(raw: string, validate: (raw: string) => boolean): boolean {
  try {
    return validate(raw)
  }
  catch {
    return false
  }
}

export async function loadFromStorage(key: string, legacyKeys: string[] = []): Promise<StorageLoadResult> {
  const keys = [key, ...legacyKeys]

  for (const candidateKey of keys) {
    const local = localStorage.getItem(candidateKey)
    if (local) {
      return {
        value: local,
        sourceKey: candidateKey,
        source: 'localStorage',
      }
    }
  }

  for (const candidateKey of legacyKeys) {
    try {
      const idb = await get<string>(candidateKey)
      if (idb) {
        return {
          value: idb,
          sourceKey: candidateKey,
          source: 'indexedDB',
        }
      }
    }
    catch {
      // Legacy IndexedDB read failed.
    }
  }

  return {
    value: null,
    sourceKey: null,
    source: null,
  }
}

export async function migrateStorage(
  sourceKey: string,
  targetKey: string,
  validate: (raw: string) => boolean,
): Promise<boolean> {
  if (localStorage.getItem(targetKey))
    return false

  const local = localStorage.getItem(sourceKey)
  if (local && isValidRaw(local, validate)) {
    localStorage.setItem(targetKey, local)
    return true
  }

  let idb: string | undefined
  try {
    idb = await get<string>(sourceKey)
  }
  catch {
    idb = undefined
  }

  if (!idb || !isValidRaw(idb, validate))
    return false

  localStorage.setItem(targetKey, idb)
  return true
}

import type { DocumentData } from 'firebase/firestore'
import { CloudSyncError } from './cloud-sync-errors'

function invalidValue(path: string, detail: string): never {
  throw new CloudSyncError('cloud/data-invalid', `Cloud 寫入資料 ${path} ${detail}`)
}

function normalizeValue(value: unknown, path: string, inArray: boolean): unknown {
  if (value === undefined) {
    if (inArray)
      invalidValue(path, '不可為 undefined')
    return undefined
  }
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value))
      invalidValue(path, '必須是有限數字')
    return value
  }
  if (Array.isArray(value))
    return value.map((item, index) => normalizeValue(item, `${path}[${index}]`, true))
  if (typeof value !== 'object')
    invalidValue(path, `包含不支援的 ${typeof value}`)

  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null)
    invalidValue(path, '必須是一般物件')

  const normalized: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value)) {
    const next = normalizeValue(item, `${path}.${key}`, false)
    if (next !== undefined)
      normalized[key] = next
  }
  return normalized
}

/**
 * Produces data accepted by Firestore while preserving JSON-equivalent hashes.
 * Optional object properties are omitted; undefined array items and unsupported
 * runtime values fail locally with a useful path instead of Firebase's generic
 * invalid-argument error.
 */
export function prepareFirestoreData(value: DocumentData): DocumentData {
  return normalizeValue(value, 'document', false) as DocumentData
}

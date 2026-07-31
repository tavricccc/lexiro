import type { VocabSet } from '@/types'

function timestamp(value?: string) {
  const parsed = value ? Date.parse(value) : Number.NaN
  return Number.isNaN(parsed) ? 0 : parsed
}

/** Keep one canonical set per name; ties intentionally keep the latest array entry. */
export function deduplicateSetsByName<T extends Pick<VocabSet, 'setName' | 'updatedAt'>>(sets: T[]): T[] {
  const latest = new Map<string, T>()
  for (const set of sets) {
    const key = set.setName.trim().toLocaleLowerCase()
    const current = latest.get(key)
    if (!current || timestamp(set.updatedAt) >= timestamp(current.updatedAt))
      latest.set(key, set)
  }
  return [...latest.values()]
}

export function isRemoteSetNewer(local: Pick<VocabSet, 'updatedAt'>, remote: Pick<VocabSet, 'updatedAt'>) {
  return timestamp(remote.updatedAt) > timestamp(local.updatedAt)
}

import type { DictionaryEntry } from '@/types'
import { DICTIONARY_CACHE_KEY } from '@/constants'
import { loadFromStorage, saveToStorage } from '@/lib/persist'

const API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en'
const CACHE_TTL = 1000 * 60 * 60 * 24 * 30

interface CachedEntry {
  fetchedAt: number
  entries: DictionaryEntry[]
}

export type DictionaryErrorCode = 'notFound' | 'unavailable'

export class DictionaryLookupError extends Error {
  constructor(readonly code: DictionaryErrorCode) {
    super(code)
    this.name = 'DictionaryLookupError'
  }
}

async function readCache(): Promise<Record<string, CachedEntry>> {
  const stored = await loadFromStorage(DICTIONARY_CACHE_KEY)
  if (!stored.value)
    return {}
  try {
    return JSON.parse(stored.value) as Record<string, CachedEntry>
  }
  catch {
    return {}
  }
}

async function writeCache(cache: Record<string, CachedEntry>) {
  const keys = Object.keys(cache)
  const trimmed = keys.length > 120
    ? Object.fromEntries(keys.slice(-120).map(key => [key, cache[key]]))
    : cache
  await saveToStorage(DICTIONARY_CACHE_KEY, trimmed)
}

export async function lookupDictionary(word: string): Promise<DictionaryEntry[]> {
  const normalized = word.trim().toLowerCase()
  if (!normalized)
    return []

  const cache = await readCache()
  const cached = cache[normalized]
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL)
    return cached.entries

  const response = await fetch(`${API_BASE}/${encodeURIComponent(normalized)}`)
  if (!response.ok)
    throw new DictionaryLookupError(response.status === 404 ? 'notFound' : 'unavailable')

  const entries = await response.json() as DictionaryEntry[]
  cache[normalized] = { fetchedAt: Date.now(), entries }
  await writeCache(cache)
  return entries
}

export function dictionaryAudio(entry: DictionaryEntry): string | null {
  const audio = entry.phonetics?.find(item => item.audio)?.audio
  return audio ? (audio.startsWith('//') ? `https:${audio}` : audio) : null
}

export function dictionaryDefinitions(entry: DictionaryEntry) {
  return entry.meanings.flatMap(meaning => meaning.definitions.map(definition => ({
    ...definition,
    partOfSpeech: meaning.partOfSpeech ?? '',
  })))
}

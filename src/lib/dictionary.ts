import type { DictionaryEntry } from '@/types'
import { DICTIONARY_CACHE_KEY } from '@/constants'

const API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en'
const CACHE_TTL = 1000 * 60 * 60 * 24 * 30

interface CachedEntry {
  fetchedAt: number
  entries: DictionaryEntry[]
}

function readCache(): Record<string, CachedEntry> {
  try {
    const raw = localStorage.getItem(DICTIONARY_CACHE_KEY)
    return raw ? JSON.parse(raw) as Record<string, CachedEntry> : {}
  }
  catch {
    return {}
  }
}

function writeCache(cache: Record<string, CachedEntry>) {
  const keys = Object.keys(cache)
  const trimmed = keys.length > 120
    ? Object.fromEntries(keys.slice(-120).map(key => [key, cache[key]]))
    : cache
  localStorage.setItem(DICTIONARY_CACHE_KEY, JSON.stringify(trimmed))
}

export async function lookupDictionary(word: string): Promise<DictionaryEntry[]> {
  const normalized = word.trim().toLowerCase()
  if (!normalized)
    return []

  const cache = readCache()
  const cached = cache[normalized]
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL)
    return cached.entries

  const response = await fetch(`${API_BASE}/${encodeURIComponent(normalized)}`)
  if (!response.ok)
    throw new Error(response.status === 404 ? '找不到這個單字' : '字典服務暫時無法使用')

  const entries = await response.json() as DictionaryEntry[]
  cache[normalized] = { fetchedAt: Date.now(), entries }
  writeCache(cache)
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

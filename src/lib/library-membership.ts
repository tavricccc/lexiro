import type { SetMembership, WordEntry } from '@/types'
import { normalizeWordKey } from './library'

export function sanitizeMemberships(memberships: SetMembership[], words: Record<string, WordEntry>): SetMembership[] {
  const byWord = new Map<string, SetMembership>()
  for (const membership of memberships) {
    const wordKey = normalizeWordKey(membership.wordKey)
    const word = words[wordKey]
    if (!word || !Array.isArray(word.senses) || !Array.isArray(membership.senseIds))
      continue
    const senseIds = Array.from(new Set(membership.senseIds)).filter(senseId => word.senses.some(sense => sense.id === senseId))
    if (!senseIds.length)
      continue
    const existing = byWord.get(wordKey)
    byWord.set(wordKey, existing
      ? { wordKey, senseIds: Array.from(new Set([...existing.senseIds, ...senseIds])) }
      : { wordKey, senseIds })
  }
  return Array.from(byWord.values())
}

export function membershipsCoverWords(words: WordEntry[], memberships: SetMembership[]): boolean {
  const wordKeys = new Set(words.map(word => normalizeWordKey(word.wordKey)))
  const membershipWordKeys = new Set(memberships.map(membership => normalizeWordKey(membership.wordKey)))
  return Array.from(wordKeys).every(wordKey => membershipWordKeys.has(wordKey))
}

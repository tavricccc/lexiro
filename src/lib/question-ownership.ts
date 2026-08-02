import type { LibraryQuestion, SetMembership, WordEntry } from '@/types'
import { normalizeWordKey } from './library'

export function questionUsesWords(question: LibraryQuestion, words: Record<string, WordEntry>): boolean {
  function hasSense(wordKey: string | undefined, senseId: string | undefined): boolean {
    if (!wordKey || !senseId)
      return false
    return Boolean(words[normalizeWordKey(wordKey)]?.senses.some(sense => sense.id === senseId))
  }
  if (question.kind === 'reading')
    return question.wordKeys.length > 0 && question.wordKeys.every(wordKey => Boolean(words[normalizeWordKey(wordKey)])) && question.questions.length > 0 && question.questions.every(child => hasSense(child.wordKey, child.senseId))
  return hasSense(question.wordKey, question.senseId)
}

export function questionBelongsToMemberships(question: LibraryQuestion, memberships: SetMembership[]): boolean {
  const membershipsByWordKey = new Map(memberships.map(membership => [normalizeWordKey(membership.wordKey), membership]))
  if (question.kind === 'reading') {
    return question.wordKeys.length > 0
      && question.questions.length > 0
      && question.wordKeys.every(wordKey => membershipsByWordKey.has(normalizeWordKey(wordKey)))
      && question.questions.every((child) => {
        const membership = membershipsByWordKey.get(normalizeWordKey(child.wordKey))
        return Boolean(membership?.senseIds.includes(child.senseId))
      })
  }

  if (!question.wordKey || !question.senseId)
    return false
  const membership = membershipsByWordKey.get(normalizeWordKey(question.wordKey))
  return Boolean(membership?.senseIds.includes(question.senseId))
}

export function questionBelongsToAnyMemberships(question: LibraryQuestion, membershipGroups: Iterable<SetMembership[]>): boolean {
  for (const memberships of membershipGroups) {
    if (questionBelongsToMemberships(question, memberships))
      return true
  }
  return false
}

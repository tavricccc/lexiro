import type { LibraryQuestion, SetMembership } from '@/types'
import { normalizeWordKey } from './library'
import { questionBelongsToMemberships } from './question-ownership'

export interface SenseRemovalImpact {
  otherSetIds: string[]
  questionCount: number
  isLastSenseInSet: boolean
  removesWordFromSet: boolean
  removesSet: boolean
  requiresConfirmation: boolean
}

interface SenseRemovalImpactOptions {
  setId: string
  wordKey: string
  senseId: string
  memberships: Record<string, SetMembership[]>
  questions: LibraryQuestion[]
}

function questionReferencesSense(question: LibraryQuestion, wordKey: string, senseId: string): boolean {
  const normalizedWordKey = normalizeWordKey(wordKey)
  if (question.kind === 'reading')
    return question.questions.some(child => normalizeWordKey(child.wordKey) === normalizedWordKey && child.senseId === senseId)
  return normalizeWordKey(question.wordKey) === normalizedWordKey && question.senseId === senseId
}

export function calculateSenseRemovalImpact(options: SenseRemovalImpactOptions): SenseRemovalImpact {
  const normalizedWordKey = normalizeWordKey(options.wordKey)
  const currentMemberships = options.memberships[options.setId] ?? []
  const membership = currentMemberships.find(item => normalizeWordKey(item.wordKey) === normalizedWordKey)
  const usingSetIds = Object.entries(options.memberships)
    .filter(([, memberships]) => memberships.some(item => normalizeWordKey(item.wordKey) === normalizedWordKey && item.senseIds.includes(options.senseId)))
    .map(([setId]) => setId)
  const otherSetIds = usingSetIds.filter(setId => setId !== options.setId)
  const questionCount = options.questions.filter((question) => {
    if (!questionReferencesSense(question, options.wordKey, options.senseId))
      return false
    return questionBelongsToMemberships(question, currentMemberships)
  }).length
  const isLastSenseInSet = membership?.senseIds.length === 1 && membership.senseIds.includes(options.senseId)
  const removesWordFromSet = isLastSenseInSet
  const removesSet = removesWordFromSet && currentMemberships.length === 1
  const requiresConfirmation = Boolean(otherSetIds.length || questionCount || removesWordFromSet)

  return {
    otherSetIds,
    questionCount,
    isLastSenseInSet,
    removesWordFromSet,
    removesSet,
    requiresConfirmation,
  }
}

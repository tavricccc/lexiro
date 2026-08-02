import type { LibraryQuestion, SetMembership } from '@/types'
import { describe, expect, it } from 'vitest'
import { calculateSenseRemovalImpact } from '@/lib/sense-impact'

const memberships: Record<string, SetMembership[]> = {
  'set-one': [{ wordKey: 'adapt', senseIds: ['sense-one', 'sense-two'] }],
  'set-two': [{ wordKey: 'adapt', senseIds: ['sense-one'] }],
}

const question = {
  id: 'question-one',
  fingerprint: 'fingerprint-one',
  kind: 'multipleChoice',
  questionStyle: 'standard',
  wordKey: 'adapt',
  senseId: 'sense-one',
  difficulty: 1,
  prompt: 'Adapt the plan.',
  options: ['adapt', 'avoid', 'forget', 'remove'],
  answerIndex: 0,
  createdAt: '',
  updatedAt: '',
} satisfies LibraryQuestion

describe('sense removal impact', () => {
  it('requires confirmation for shared senses and bound questions', () => {
    const impact = calculateSenseRemovalImpact({
      setId: 'set-one',
      wordKey: 'adapt',
      senseId: 'sense-one',
      memberships,
      questions: [question],
    })

    expect(impact.otherSetIds).toEqual(['set-two'])
    expect(impact.questionCount).toBe(1)
    expect(impact.requiresConfirmation).toBe(true)
    expect(impact.removesWordFromSet).toBe(false)
  })

  it('allows immediate removal when no relationship is affected', () => {
    const impact = calculateSenseRemovalImpact({
      setId: 'set-one',
      wordKey: 'adapt',
      senseId: 'sense-two',
      memberships,
      questions: [],
    })

    expect(impact.requiresConfirmation).toBe(false)
    expect(impact.otherSetIds).toEqual([])
    expect(impact.removesWordFromSet).toBe(false)
  })
})

import type { SetMembership, WordEntry } from '@/types'
import { describe, expect, it } from 'vitest'
import { sanitizeMemberships } from '@/lib/library-membership'

const words: Record<string, WordEntry> = {
  abandon: {
    wordKey: 'abandon',
    word: 'abandon',
    senses: [
      { id: 'sense-a', pos: 'verb', meaningZh: '放棄', examples: [] },
      { id: 'sense-b', pos: 'noun', meaningZh: '放任', examples: [] },
    ],
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
}

describe('sanitizeMemberships', () => {
  it('normalizes keys, merges duplicate words, and drops invalid senses', () => {
    const memberships: SetMembership[] = [
      { wordKey: ' Abandon ', senseIds: ['sense-a', 'missing', 'sense-a'] },
      { wordKey: 'abandon', senseIds: ['sense-b'] },
      { wordKey: 'unknown', senseIds: ['sense-a'] },
    ]

    expect(sanitizeMemberships(memberships, words)).toEqual([
      { wordKey: 'abandon', senseIds: ['sense-a', 'sense-b'] },
    ])
  })
})

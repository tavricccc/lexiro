import type { SharedSet } from '@/types'
import { describe, expect, it } from 'vitest'
import { countSharedSetSenses } from '@/lib/shared-set'

describe('shared set counts', () => {
  it('counts each exported sense exactly once per membership', () => {
    const sets: SharedSet[] = [{
      id: 'set-1',
      setName: 'Fruits',
      folderId: '__uncategorized__',
      createdAt: '',
      updatedAt: '',
      words: [],
      memberships: [{ wordKey: 'run', senseIds: ['sense-1', 'sense-2'] }],
      questions: [],
    }]

    expect(countSharedSetSenses(sets)).toBe(2)
  })
})

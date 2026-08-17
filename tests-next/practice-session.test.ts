import { describe, expect, it } from 'vitest'

import { parsePracticeSession } from '@/src/lib/practice-session'

const validSession = {
  schemaVersion: 1,
  mode: 'questions',
  setId: 'set-1',
  amount: 10,
  index: 1,
  correct: 1,
  wrong: [1],
  skipped: [],
  marked: [1],
  selected: 2,
  revealed: true,
  questionType: 'all',
  difficulty: 'all',
  itemIds: ['question:one', 'question:two'],
  failedSenseIds: ['sense-one'],
  retrying: false,
}

describe('practice session persistence', () => {
  it('restores a valid answered question without losing the current choice', () => {
    expect(parsePracticeSession(JSON.stringify(validSession))).toEqual(validSession)
  })

  it('rejects incomplete legacy sessions and invalid queues', () => {
    expect(parsePracticeSession(JSON.stringify({ mode: 'review', index: 1 }))).toBeNull()
    expect(parsePracticeSession(JSON.stringify({ ...validSession, itemIds: ['same', 'same'] }))).toBeNull()
    expect(parsePracticeSession(JSON.stringify({ ...validSession, index: 2 }))).toBeNull()
  })

  it('rejects corrupt JSON instead of throwing during hydration', () => {
    expect(parsePracticeSession('{not-json')).toBeNull()
  })
})

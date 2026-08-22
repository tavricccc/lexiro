import { describe, expect, it } from 'vitest'

import { canRestorePracticeSession, parsePracticeSession } from '@/src/lib/practice-session'

const validSession = {
  schemaVersion: 2,
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
  answerChoices: [null, 2],
}

describe('practice session persistence', () => {
  it('restores a valid answered question without losing the current choice', () => {
    expect(parsePracticeSession(JSON.stringify(validSession))).toEqual(validSession)
  })

  it('migrates a legacy v1 session by defaulting answer choices to null', () => {
    const { answerChoices: _omitted, ...legacy } = validSession
    expect(parsePracticeSession(JSON.stringify({ ...legacy, schemaVersion: 1 }))).toEqual({
      ...validSession,
      answerChoices: [null, null],
    })
  })

  it('rejects invalid answer choices', () => {
    expect(parsePracticeSession(JSON.stringify({ ...validSession, answerChoices: [0, 9] }))).toBeNull()
    expect(parsePracticeSession(JSON.stringify({ ...validSession, answerChoices: ['yes'] }))).toBeNull()
    expect(parsePracticeSession(JSON.stringify({ ...validSession, answerChoices: [null, null, null] }))).toBeNull()
  })

  it('rejects incomplete legacy sessions and invalid queues', () => {
    expect(parsePracticeSession(JSON.stringify({ mode: 'review', index: 1 }))).toBeNull()
    expect(parsePracticeSession(JSON.stringify({ ...validSession, itemIds: ['same', 'same'] }))).toBeNull()
    expect(parsePracticeSession(JSON.stringify({ ...validSession, index: 2 }))).toBeNull()
  })

  it('rejects corrupt JSON instead of throwing during hydration', () => {
    expect(parsePracticeSession('{not-json')).toBeNull()
  })

  it('restores a question session after refreshing the question practice route', () => {
    const session = parsePracticeSession(JSON.stringify(validSession))
    expect(session).not.toBeNull()
    expect(canRestorePracticeSession(session!, 'questions', '')).toBe(true)
  })

  it('does not override an explicit set route with an unrelated session', () => {
    const session = parsePracticeSession(JSON.stringify(validSession))
    expect(session).not.toBeNull()
    expect(canRestorePracticeSession(session!, 'review', 'set-1')).toBe(false)
    expect(canRestorePracticeSession(session!, 'questions', 'set-2')).toBe(false)
  })
})

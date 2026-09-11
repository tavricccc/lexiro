import { describe, expect, it } from 'vitest'

import { canRestorePracticeSession, parsePracticeSession } from '@/src/lib/practice-session'

const validSession = {
  schemaVersion: 3,
  tasks: ['vocabulary', 'reading'],
  setId: 'set-1',
  amount: 10,
  index: 1,
  correct: 1,
  wrong: [1],
  skipped: [],
  marked: [1],
  selected: 2,
  revealed: true,
  difficulty: 'all',
  entryIds: ['question:one', 'question:two'],
  failedSenseIds: ['sense-one'],
  retrying: false,
  answerChoices: [null, 2],
}

describe('practice session persistence', () => {
  it('restores a valid answered question without losing the current choice', () => {
    expect(parsePracticeSession(JSON.stringify(validSession))).toEqual(validSession)
  })

  it('keeps a mixed card session, ordering its tasks canonically', () => {
    const session = {
      ...validSession,
      tasks: ['spelling', 'flashcard'],
      entryIds: ['card:flashcard:sense-one', 'card:spelling:sense-two'],
      selected: null,
      correct: 1,
      answerChoices: [null, null],
    }
    expect(parsePracticeSession(JSON.stringify(session))?.tasks).toEqual([
      'flashcard',
      'spelling',
    ])
  })

  it('accepts a choice from a ten-option 文意選填 bank', () => {
    const session = { ...validSession, selected: 9, answerChoices: [null, 9] }
    expect(parsePracticeSession(JSON.stringify(session))?.selected).toBe(9)
  })

  it('rejects invalid answer choices', () => {
    expect(parsePracticeSession(JSON.stringify({ ...validSession, answerChoices: [0, 12] }))).toBeNull()
    expect(parsePracticeSession(JSON.stringify({ ...validSession, answerChoices: ['yes'] }))).toBeNull()
    expect(parsePracticeSession(JSON.stringify({ ...validSession, answerChoices: [null, null, null] }))).toBeNull()
  })

  it('drops the superseded single-mode snapshots instead of guessing a queue', () => {
    const { tasks: _tasks, entryIds, ...rest } = validSession
    const legacy = { ...rest, schemaVersion: 2, mode: 'questions', questionType: 'all', itemIds: entryIds }
    expect(parsePracticeSession(JSON.stringify(legacy))).toBeNull()
  })

  it('rejects incomplete sessions, unknown tasks and invalid queues', () => {
    expect(parsePracticeSession(JSON.stringify({ schemaVersion: 3, index: 1 }))).toBeNull()
    expect(parsePracticeSession(JSON.stringify({ ...validSession, tasks: ['nonsense'] }))).toBeNull()
    expect(parsePracticeSession(JSON.stringify({ ...validSession, tasks: [] }))).toBeNull()
    expect(parsePracticeSession(JSON.stringify({ ...validSession, entryIds: ['same', 'same'] }))).toBeNull()
    expect(parsePracticeSession(JSON.stringify({ ...validSession, index: 2 }))).toBeNull()
  })

  it('rejects corrupt JSON instead of throwing during hydration', () => {
    expect(parsePracticeSession('{not-json')).toBeNull()
  })

  it('restores a session after refreshing the practice route', () => {
    const session = parsePracticeSession(JSON.stringify(validSession))
    expect(session).not.toBeNull()
    expect(canRestorePracticeSession(session!, '')).toBe(true)
  })

  it('does not override an explicit set route with an unrelated session', () => {
    const session = parsePracticeSession(JSON.stringify(validSession))
    expect(session).not.toBeNull()
    expect(canRestorePracticeSession(session!, 'set-2')).toBe(false)
    expect(canRestorePracticeSession(session!, 'set-1')).toBe(true)
  })
})

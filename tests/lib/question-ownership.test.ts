import type { LibraryQuestion, SetMembership, WordEntry } from '@/types'
import { describe, expect, it } from 'vitest'
import { buildSenseId } from '@/lib/library'
import { questionBelongsToAnyMemberships, questionBelongsToMemberships, questionUsesWords } from '@/lib/question-ownership'

const memberships: SetMembership[] = [
  { wordKey: 'Run', senseIds: ['run-verb'] },
  { wordKey: 'read', senseIds: ['read-verb'] },
]

const reading: LibraryQuestion = {
  id: 'reading-1',
  fingerprint: 'reading-1-fp',
  kind: 'reading',
  title: 'A passage',
  passage: 'A passage.',
  wordKeys: ['run', 'read'],
  questions: [{ id: 'child-1', kind: 'multipleChoice', prompt: 'What happened?', options: ['A', 'B', 'C', 'D'], answerIndex: 0, wordKey: 'run', senseId: 'run-verb' }],
  difficulty: 1,
  createdAt: '',
  updatedAt: '',
}

const words: Record<string, WordEntry> = {
  run: { wordKey: 'run', word: 'run', senses: [{ id: buildSenseId('run', 'v.', '跑步'), pos: 'v.', meaningZh: '跑步', examples: [] }], updatedAt: '' },
  read: { wordKey: 'read', word: 'read', senses: [{ id: buildSenseId('read', 'v.', '閱讀'), pos: 'v.', meaningZh: '閱讀', examples: [] }], updatedAt: '' },
}

describe('question ownership', () => {
  it('requires every reading word and child sense to exist in the shared library', () => {
    const sourceReading = {
      ...reading,
      questions: [{ ...reading.questions[0], senseId: words.run.senses[0].id }],
      wordKeys: ['run', 'read'],
    }
    expect(questionUsesWords(sourceReading, words)).toBe(true)
    expect(questionUsesWords({ ...sourceReading, wordKeys: ['run', 'missing'] }, words)).toBe(false)
    expect(questionUsesWords({ ...sourceReading, questions: [{ ...sourceReading.questions[0], senseId: 'missing-sense' }] }, words)).toBe(false)
  })

  it('requires every reading word and child sense to belong to the same set', () => {
    expect(questionBelongsToMemberships(reading, memberships)).toBe(true)
    expect(questionBelongsToMemberships(reading, [{ wordKey: 'run', senseIds: ['run-verb'] }])).toBe(false)
    expect(questionBelongsToMemberships(reading, [{ wordKey: 'run', senseIds: ['other-sense'] }, { wordKey: 'read', senseIds: ['read-verb'] }])).toBe(false)
    expect(questionBelongsToMemberships({ ...reading, wordKeys: [], questions: [] }, memberships)).toBe(false)
  })

  it('finds a set that fully owns a question', () => {
    expect(questionBelongsToAnyMemberships(reading, [[{ wordKey: 'run', senseIds: ['run-verb'] }], memberships])).toBe(true)
    expect(questionBelongsToAnyMemberships(reading, [[{ wordKey: 'run', senseIds: ['run-verb'] }]])).toBe(false)
  })
})

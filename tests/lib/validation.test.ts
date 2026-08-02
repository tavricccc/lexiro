import type { PracticeSession, StudyWord } from '@/types'
import { describe, expect, it } from 'vitest'
import { areWordDraftsComplete, containsHan, createBlankEditorItem, createEditorItem, createEditorItems, getFilledWordDrafts, normalizeSession, toSessionEntries } from '@/lib/validation'

const studyWord: StudyWord = {
  id: 'sense-apple',
  wordKey: 'apple',
  word: 'apple',
  pos: 'n.',
  meaning: '蘋果',
  examples: ['I eat an apple.'],
  example: 'I eat an apple.',
}

const baseSession: PracticeSession = {
  sourceSetId: 'set-1',
  mode: 'quiz',
  entries: [{ item: studyWord, originalIndex: 0 }],
  index: 0,
  correctCount: 0,
  wrongEntries: [],
  answers: [],
  drafts: [],
  markedForReview: [false],
  review: false,
  status: 'in-progress',
}

describe('draft validation helpers', () => {
  it('validates filled word drafts without duplicating UI rules', () => {
    const drafts = [
      { word: '  abandon ', senses: [{ id: 'sense-1', pos: 'v.', meaning: '放棄', examples: [''] }] },
      { word: '', senses: [{ id: 'sense-2', pos: '', meaning: '', examples: [] }] },
    ]
    expect(getFilledWordDrafts(drafts)).toHaveLength(1)
    expect(areWordDraftsComplete(getFilledWordDrafts(drafts))).toBe(true)
    expect(areWordDraftsComplete([{ word: 'abandon', senses: [{ id: 'sense-1', pos: '', meaning: '放棄', examples: [] }] }])).toBe(false)
  })

  it('detects Han characters consistently', () => {
    expect(containsHan('English only')).toBe(false)
    expect(containsHan('中文')).toBe(true)
  })
})

describe('canonical session validation', () => {
  it('rejects malformed or unrelated sessions', () => {
    const validSetIds = new Set(['set-1'])

    expect(normalizeSession(null, validSetIds)).toBeNull()
    expect(normalizeSession({ ...baseSession, sourceSetId: 'unknown' }, validSetIds)).toBeNull()
    expect(normalizeSession({ ...baseSession, mode: 'invalid' }, validSetIds)).toBeNull()
    expect(normalizeSession({ ...baseSession, entries: [] }, validSetIds)).toBeNull()
    expect(normalizeSession({ ...baseSession, unexpectedField: 'quiz' }, validSetIds)).toBeNull()
  })

  it('rejects malformed session counters instead of repairing them', () => {
    const result = normalizeSession({ ...baseSession, index: -1, correctCount: -1, markedForReview: [true] }, new Set(['set-1']))

    expect(result).toBeNull()
  })

  it('forces a result view to completed', () => {
    expect(normalizeSession(baseSession, new Set(['set-1']), 'result')?.status).toBe('completed')
  })

  it('creates editor drafts from the canonical study word shape', () => {
    expect(createEditorItem(studyWord)).toEqual({
      id: 'sense-apple',
      word: 'apple',
      senses: [{ id: 'sense-apple', pos: 'n.', meaning: '蘋果', examples: ['I eat an apple.'] }],
    })
    expect(createBlankEditorItem()).toMatchObject({ id: expect.stringContaining('editor-'), word: '', senses: [{ pos: '', meaning: '', examples: [] }] })
    expect(createEditorItems([studyWord])).toHaveLength(1)
  })

  it('creates session entries without copying a second word model', () => {
    expect(toSessionEntries([studyWord])).toEqual([{ item: studyWord, originalIndex: 0 }])
  })
})

import type { VocabItem } from '@/types'
import { describe, expect, it } from 'vitest'
import { normalizeSession, toSessionEntries } from '@/lib/validation'

const validItem: VocabItem = {
  id: 'item-1',
  word: 'apple',
  pos: 'n.',
  meaning: '蘋果',
  example: 'I eat an apple.',
}

describe('toSessionEntries', () => {
  it('converts VocabItems to SessionEntries with originalIndex', () => {
    const items = [validItem]
    const entries = toSessionEntries(items)
    expect(entries).toHaveLength(1)
    expect(entries[0].item).toBe(items[0])
    expect(entries[0].originalIndex).toBe(0)
  })

  it('preserves order with correct indices', () => {
    const items: VocabItem[] = [
      { ...validItem, id: 'a' },
      { ...validItem, id: 'b' },
      { ...validItem, id: 'c' },
    ]
    const entries = toSessionEntries(items)
    expect(entries).toHaveLength(3)
    expect(entries[0].originalIndex).toBe(0)
    expect(entries[1].originalIndex).toBe(1)
    expect(entries[2].originalIndex).toBe(2)
  })

  it('returns empty array for empty items', () => {
    expect(toSessionEntries([])).toEqual([])
  })
})

describe('normalizeSession', () => {
  const validSetIds = new Set(['set-1', 'set-2'])

  const baseSession = {
    sourceSetId: 'set-1',
    mode: 'quiz',
    entries: [{ item: validItem, originalIndex: 0 }],
    index: 0,
    correctCount: 0,
    wrongEntries: [],
    answers: [],
    drafts: [],
    review: false,
    status: 'in-progress',
  }

  it('returns a valid PracticeSession for complete input', () => {
    const result = normalizeSession(baseSession, validSetIds)
    expect(result).not.toBeNull()
    expect(result!.sourceSetId).toBe('set-1')
    expect(result!.mode).toBe('quiz')
    expect(result!.entries).toHaveLength(1)
    expect(result!.index).toBe(0)
    expect(result!.status).toBe('in-progress')
  })

  it('returns null for non-object input', () => {
    expect(normalizeSession(null, validSetIds)).toBeNull()
    expect(normalizeSession('string', validSetIds)).toBeNull()
    expect(normalizeSession(123, validSetIds)).toBeNull()
    expect(normalizeSession([], validSetIds)).toBeNull()
  })

  it('returns null when sourceSetId is missing', () => {
    const { sourceSetId: _, ...noId } = baseSession
    expect(normalizeSession(noId, validSetIds)).toBeNull()
  })

  it('returns null when sourceSetId is empty', () => {
    expect(normalizeSession({ ...baseSession, sourceSetId: '' }, validSetIds)).toBeNull()
  })

  it('returns null when sourceSetId is not in validSetIds', () => {
    expect(normalizeSession({ ...baseSession, sourceSetId: 'unknown' }, validSetIds)).toBeNull()
  })

  it('returns null when mode is missing', () => {
    const { mode: _, ...noMode } = baseSession
    expect(normalizeSession(noMode, validSetIds)).toBeNull()
  })

  it('returns null when mode is invalid', () => {
    expect(normalizeSession({ ...baseSession, mode: 'invalid' }, validSetIds)).toBeNull()
  })

  it('returns null when entries is missing', () => {
    const { entries: _, ...noEntries } = baseSession
    expect(normalizeSession(noEntries, validSetIds)).toBeNull()
  })

  it('returns null when entries is empty', () => {
    expect(normalizeSession({ ...baseSession, entries: [] }, validSetIds)).toBeNull()
  })

  it('forgives absent optional arrays', () => {
    const { wrongEntries: _, answers: _a, drafts: _d, ...partial } = baseSession
    const result = normalizeSession(partial, validSetIds)
    expect(result).not.toBeNull()
    expect(result!.wrongEntries).toEqual([])
    expect(result!.answers).toEqual([])
    expect(result!.drafts).toEqual([])
    expect(result!.markedForReview).toEqual([false])
  })

  it('preserves completed status', () => {
    const result = normalizeSession({ ...baseSession, status: 'completed' }, validSetIds)
    expect(result!.status).toBe('completed')
  })

  it('forces status to completed when view is result', () => {
    const result = normalizeSession(baseSession, validSetIds, 'result')
    expect(result!.status).toBe('completed')
  })

  it('defaults index to 0 when missing or negative', () => {
    const { index: _, ...noIndex } = baseSession
    expect(normalizeSession(noIndex, validSetIds)!.index).toBe(0)
    expect(normalizeSession({ ...baseSession, index: -1 }, validSetIds)!.index).toBe(0)
  })

  it('defaults correctCount to 0 when missing or negative', () => {
    const { correctCount: _, ...noCount } = baseSession
    expect(normalizeSession(noCount, validSetIds)!.correctCount).toBe(0)
    expect(normalizeSession({ ...baseSession, correctCount: -1 }, validSetIds)!.correctCount).toBe(0)
  })

  it('supports spelling mode', () => {
    const result = normalizeSession({ ...baseSession, mode: 'spelling' }, validSetIds)
    expect(result!.mode).toBe('spelling')
  })

  it('validates entries from different valid set IDs', () => {
    const session2 = { ...baseSession, sourceSetId: 'set-2' }
    expect(normalizeSession(session2, validSetIds)).not.toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import { hasOutboxDomain, incrementOutboxAttempts, queueRecordChanges, rebaseQueuedRecords, removeOutboxDomain } from '@/lib/sync-outbox'

describe('sync outbox', () => {
  it('queues record-level create, update, and delete changes', () => {
    const baseline = { 'word:run': { meaning: '跑步' }, 'word:keep': { meaning: '保留' } }
    const previous = { ...baseline }
    const current = { 'word:run': { meaning: '奔跑' }, 'word:new': { meaning: '新' } }
    const entries = queueRecordChanges('library', baseline, previous, current, [], '2026-08-01T00:00:00.000Z')

    expect(entries).toHaveLength(3)
    expect(entries.map(entry => entry.recordKey).sort()).toEqual(['word:keep', 'word:new', 'word:run'])
    expect(entries.find(entry => entry.recordKey === 'word:keep')?.payload).toBeNull()
    expect(entries.find(entry => entry.recordKey === 'word:run')?.baseHash).not.toBe('')
    expect(entries.find(entry => entry.recordKey === 'word:new')?.payload).toEqual({ meaning: '新' })
  })

  it('coalesces a queued record when local edits return to baseline', () => {
    const baseline = { 'set:a': { name: 'A' } }
    const queued = queueRecordChanges('library', baseline, baseline, { 'set:a': { name: 'B' } }, [])
    const reverted = queueRecordChanges('library', baseline, { 'set:a': { name: 'B' } }, baseline, queued)

    expect(reverted).toEqual([])
  })

  it('rebases non-conflicting records and sends conflicts to Cloud', () => {
    const entries = queueRecordChanges(
      'library',
      { 'word:a': { value: 1 }, 'word:b': { value: 1 } },
      { 'word:a': { value: 1 }, 'word:b': { value: 1 } },
      { 'word:a': { value: 2 }, 'word:b': { value: 2 } },
      [],
    )
    const result = rebaseQueuedRecords(
      { 'word:a': { value: 1 }, 'word:b': { value: 9 } },
      entries,
      'library',
    )

    expect(result.records['word:a']).toEqual({ value: 2 })
    expect(result.records['word:b']).toEqual({ value: 9 })
    expect(result.accepted.map(entry => entry.recordKey)).toEqual(['word:a'])
    expect(result.conflicted.map(entry => entry.recordKey)).toEqual(['word:b'])
  })

  it('rebases deletes as accepted changes when the base is unchanged', () => {
    const entries = queueRecordChanges(
      'learning',
      { 'card:sense-1': { due: 1 } },
      { 'card:sense-1': { due: 1 } },
      {},
      [],
    )
    const result = rebaseQueuedRecords({ 'card:sense-1': { due: 1 } }, entries, 'learning')

    expect(result.records).toEqual({})
    expect(result.accepted).toHaveLength(1)
    expect(result.conflicted).toHaveLength(0)
  })

  it('keeps domain filtering and retry updates in shared helpers', () => {
    const entries = queueRecordChanges('library', {}, {}, { 'word:a': { value: 1 } }, [], '2026-08-01T00:00:00.000Z')
    const withLearning = [...entries, { ...entries[0], id: 'learning-entry', domain: 'learning' as const, recordKey: 'card:a' }]

    expect(hasOutboxDomain(withLearning, 'learning')).toBe(true)
    expect(removeOutboxDomain(withLearning, 'library')).toHaveLength(1)
    expect(incrementOutboxAttempts(withLearning, 'library', '2026-08-02T00:00:00.000Z')[0]).toMatchObject({ attempts: 1, updatedAt: '2026-08-02T00:00:00.000Z' })
  })
})

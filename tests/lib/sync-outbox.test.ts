import type { LibraryState } from '@/types'
import { describe, expect, it } from 'vitest'
import { hasOutboxDomain, incrementOutboxAttempts, isSyncOutboxEntry, libraryRecords, queueRecordChanges, rebaseQueuedRecords, removeOutboxDomain } from '@/lib/sync-outbox'

describe('sync outbox', () => {
  it('accepts the membership record generated when a set is created', () => {
    const entries = queueRecordChanges(
      'library',
      {},
      {},
      { 'membership:set-1': [{ wordKey: 'apple', senseIds: ['sense-1'] }] },
      [],
      '2026-08-01T00:00:00.000Z',
    )

    expect(entries).toHaveLength(1)
    expect(isSyncOutboxEntry(entries[0])).toBe(true)
  })

  it('ignores index-only set summary fields when comparing sync records', () => {
    const baseSet = { id: 'set-1', setName: 'A', folderId: '__uncategorized__', createdAt: 'created', updatedAt: 'updated' }
    const baseState: LibraryState = { version: 1, words: {}, sets: [baseSet], memberships: {}, folders: [], questions: [], updatedAt: 'updated' }
    const summaryState: LibraryState = {
      ...baseState,
      sets: [{ ...baseSet, wordCount: 2, senseCount: 3, questionCount: 1 } as LibraryState['sets'][number]],
    }

    expect(queueRecordChanges('library', libraryRecords(baseState), libraryRecords(baseState), libraryRecords(summaryState), [])).toEqual([])
  })

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

  it('keeps earlier pending records when a later local mutation changes another record', () => {
    const baseline = { 'word:a': { value: 1 }, 'word:b': { value: 1 } }
    const afterFirst = { ...baseline, 'word:a': { value: 2 } }
    const firstQueue = queueRecordChanges('library', baseline, baseline, afterFirst, [], '2026-08-01T00:00:00.000Z')
    const afterSecond = { ...afterFirst, 'word:b': { value: 2 } }

    const secondQueue = queueRecordChanges('library', baseline, afterFirst, afterSecond, firstQueue, '2026-08-01T00:01:00.000Z')

    expect(secondQueue.map(entry => entry.recordKey).sort()).toEqual(['word:a', 'word:b'])
  })

  it('removes a pending record when a later edit restores its baseline value', () => {
    const baseline = { 'word:a': { value: 1 } }
    const changed = { 'word:a': { value: 2 } }
    const queue = queueRecordChanges('library', baseline, baseline, changed, [])

    expect(queueRecordChanges('library', baseline, changed, baseline, queue)).toEqual([])
  })

  it('resolves a queued write already present in Cloud without re-uploading it', () => {
    const remote = { 'word:a': { value: 2 } }
    const entries = queueRecordChanges('library', { 'word:a': { value: 1 } }, { 'word:a': { value: 1 } }, remote, [])

    const result = rebaseQueuedRecords(remote, entries, 'library')

    expect(result.accepted).toEqual([])
    expect(result.conflicted).toEqual([])
    expect(result.records).toEqual(remote)
  })

  it('coalesces a queued record when local edits return to baseline', () => {
    const baseline = { 'set:a': { name: 'A' } }
    const queued = queueRecordChanges('library', baseline, baseline, { 'set:a': { name: 'B' } }, [])
    const reverted = queueRecordChanges('library', baseline, { 'set:a': { name: 'B' } }, baseline, queued)

    expect(reverted).toEqual([])
  })

  it('lets Cloud win when a queued record conflicts', () => {
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
    expect(incrementOutboxAttempts(withLearning, 'library', '2026-08-02T00:00:00.000Z')[0]).toMatchObject({
      attempts: 1,
      updatedAt: '2026-08-02T00:00:00.000Z',
      nextAttemptAt: '2026-08-02T00:00:00.250Z',
    })
  })

  it('resets retry metadata when a pending record receives a newer local edit', () => {
    const first = queueRecordChanges('library', { 'word:a': { value: 0 } }, { 'word:a': { value: 0 } }, { 'word:a': { value: 1 } }, [])
    const failed = incrementOutboxAttempts(first, 'library', '2026-08-02T00:00:00.000Z', 'network')
    const next = queueRecordChanges('library', { 'word:a': { value: 0 } }, { 'word:a': { value: 1 } }, { 'word:a': { value: 2 } }, failed)

    expect(next[0]).toMatchObject({ attempts: 0 })
    expect(next[0]).not.toHaveProperty('nextAttemptAt')
    expect(next[0]).not.toHaveProperty('lastErrorCode')
  })
})

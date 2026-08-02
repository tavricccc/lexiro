import type { LearningProgress } from '@/types'
import { describe, expect, it } from 'vitest'
import { defaultAiSettings } from '@/lib/ai-provider'
import { reconcileAiSettingsState, reconcileLearningState, reconcileLibraryState } from '@/lib/cloud-sync-reconcile'
import { createDefaultStats } from '@/lib/learning-defaults'
import { libraryRecords, queueRecordChanges } from '@/lib/sync-outbox'

describe('cloud sync reconciliation', () => {
  it('uses canonical defaults when the Cloud AI settings record is absent', () => {
    const result = reconcileAiSettingsState(null, { ...defaultAiSettings, enabled: true, model: 'cached-model', apiKey: 'device-key' }, [])

    expect(result.merged).toEqual({ ...defaultAiSettings, apiKey: 'device-key' })
    expect(result.baselineRecords).toEqual({})
    expect(result.dirty).toBe(false)
  })

  it('rebases non-conflicting learning records and preserves Cloud baseline records', () => {
    const progress: LearningProgress = { cards: {}, updatedAt: '2026-08-01T00:00:00.000Z' }
    const stats = createDefaultStats()
    const result = reconcileLearningState(progress, stats, [])

    expect(result.merged).toEqual({ progress, stats })
    expect(result.baselineRecords['stats:summary']).toEqual(stats)
    expect(result.observedRecords['stats:summary']).toEqual(stats)
    expect(result.accepted).toEqual([])
    expect(result.dirty).toBe(false)
  })

  it('prunes remote library content when a pending local set deletion removes its last membership', () => {
    const timestamp = '2026-08-02T00:00:00.000Z'
    const remote = {
      version: 1,
      words: {
        apple: { wordKey: 'apple', word: 'apple', senses: [{ id: 'sense-1', pos: 'n.', meaningZh: '蘋果', examples: [] }], updatedAt: timestamp },
      },
      sets: [{ id: 'set-1', setName: 'Fruit', folderId: '__uncategorized__', createdAt: timestamp, updatedAt: timestamp }],
      memberships: { 'set-1': [{ wordKey: 'apple', senseIds: ['sense-1'] }] },
      folders: [{ id: '__uncategorized__', name: '未分類', order: -1, createdAt: timestamp, updatedAt: timestamp }],
      questions: [],
      updatedAt: timestamp,
    }
    const local = { ...remote, sets: [], memberships: {} }
    const queued = queueRecordChanges('library', libraryRecords(remote), libraryRecords(remote), libraryRecords(local), [])

    const result = reconcileLibraryState(remote, queued)

    expect(result.merged.sets).toEqual([])
    expect(result.merged.words).toEqual({})
    expect(result.merged.memberships).toEqual({})
    expect(result.accepted.map(entry => entry.recordKey).sort()).toEqual(['membership:set-1', 'set:set-1'])
  })
})

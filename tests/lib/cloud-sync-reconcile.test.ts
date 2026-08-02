import type { LearningProgress } from '@/types'
import { describe, expect, it } from 'vitest'
import { defaultAiSettings } from '@/lib/ai-provider'
import { reconcileAiSettingsState, reconcileLearningState } from '@/lib/cloud-sync-reconcile'
import { createDefaultStats } from '@/lib/learning-defaults'

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
})

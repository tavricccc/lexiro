import type { LibraryState } from '@/types'
import { describe, expect, it } from 'vitest'

import { createUncategorizedFolder, UNCATEGORIZED_FOLDER_ID } from '@/src/lib/folders'
import { createInitialProgress } from '@/src/lib/fsrs'
import { asSenseId, normalizeWordKey } from '@/src/lib/library'
import { buildLibrarySetMetrics, countQuestionItems, countReviewableSenses } from '@/src/lib/library-metrics'

const timestamp = '2026-08-23T00:00:00.000Z'
const CALM = normalizeWordKey('calm')
const CALM_ADJECTIVE = asSenseId('sense-calm-adjective')
const CALM_VERB = asSenseId('sense-calm-verb')

function library(): LibraryState {
  return {
    version: 1,
    words: {
      [CALM]: {
        wordKey: CALM,
        word: 'calm',
        senses: [
          { id: CALM_ADJECTIVE, pos: 'adj.', meaningZh: '平靜的', examples: [] },
          { id: CALM_VERB, pos: 'v.', meaningZh: '使平靜', examples: [] },
        ],
        updatedAt: timestamp,
      },
    },
    sets: [
      { id: 'set-a', setName: 'A', folderId: UNCATEGORIZED_FOLDER_ID, createdAt: timestamp, updatedAt: timestamp },
      { id: 'set-b', setName: 'B', folderId: UNCATEGORIZED_FOLDER_ID, createdAt: timestamp, updatedAt: timestamp },
    ],
    memberships: {
      'set-a': [{ wordKey: CALM, senseIds: [CALM_ADJECTIVE, CALM_VERB] }],
      'set-b': [{ wordKey: CALM, senseIds: [CALM_ADJECTIVE] }],
    },
    folders: [createUncategorizedFolder()],
    questions: [
      {
        id: 'question-standard',
        fingerprint: 'standard',
        kind: 'multipleChoice',
        questionStyle: 'vocabulary',
        difficulty: 1,
        wordKey: CALM,
        senseId: CALM_VERB,
        prompt: 'She stayed _____ during the storm.',
        options: ['使平靜', '奔跑'],
        answerIndex: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: 'question-reading',
        fingerprint: 'reading',
        kind: 'reading',
    format: 'reading',
        difficulty: 2,
        title: 'A calm day',
        passage: 'The sea was calm.',
        wordKeys: [CALM],
        questions: [
          { id: 'child-a', kind: 'multipleChoice', prompt: 'Meaning?', options: ['平靜的', '吵鬧的'], answerIndex: 0, wordKey: CALM, senseId: CALM_ADJECTIVE },
          { id: 'child-b', kind: 'multipleChoice', prompt: 'Again?', options: ['平靜的', '快速的'], answerIndex: 0, wordKey: CALM, senseId: CALM_ADJECTIVE },
        ],
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    updatedAt: timestamp,
  }
}

describe('library metrics', () => {
  it('counts reviewable senses and individual reading questions', () => {
    const state = library()
    const futureCard = { ...createInitialProgress(new Date(timestamp)), due: '2026-08-25T00:00:00.000Z' }

    expect(countReviewableSenses(state.words, { [CALM_ADJECTIVE]: futureCard }, new Date(timestamp))).toBe(1)
    expect(countQuestionItems(state)).toBe(3)
  })

  it('builds per-set metrics in one pass without double-counting a reading pack', () => {
    const state = library()
    const dueCard = { ...createInitialProgress(new Date(timestamp)), due: '2026-08-22T00:00:00.000Z' }
    const metrics = buildLibrarySetMetrics(state, { [CALM_ADJECTIVE]: dueCard }, new Date(timestamp))

    expect(metrics.get('set-a')).toEqual({ due: 1, learned: 1, questionCount: 2, senseCount: 2 })
    expect(metrics.get('set-b')).toEqual({ due: 1, learned: 1, questionCount: 1, senseCount: 1 })
  })
})

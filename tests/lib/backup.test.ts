import type { DashboardStats, LearningProgress, LibraryState, WordEntry } from '@/types'
import { describe, expect, it } from 'vitest'
import { buildFullBackupPayload, normalizeBackupPayload } from '@/lib/file'
import { createUncategorizedFolder } from '@/lib/folders'
import { buildSenseId } from '@/lib/library'
import { normalizeFullBackupPayload, normalizeLibraryState } from '@/lib/share'

const library: LibraryState = {
  version: 1,
  words: {},
  sets: [],
  memberships: {},
  folders: [createUncategorizedFolder()],
  questions: [],
  updatedAt: '2026-08-01T00:00:00.000Z',
}

const learning: LearningProgress = {
  cards: {},
  updatedAt: '2026-08-01T00:00:00.000Z',
}

const questionStats = Object.fromEntries([
  'standard:1',
  'standard:2',
  'standard:3',
  'fillBlank:1',
  'fillBlank:2',
  'fillBlank:3',
  'reading:1',
  'reading:2',
  'reading:3',
].map(key => [key, { total: 0, correct: 0, retry: 0 }])) as DashboardStats['questionStats']

const stats: DashboardStats = {
  totalMemoryReviews: 0,
  correctMemoryReviews: 0,
  totalQuestionReviews: 0,
  correctQuestionReviews: 0,
  streakDays: 0,
  longestStreak: 0,
  xp: 0,
  level: 1,
  lastStudyDate: '',
  dailyWordGoal: 15,
  dailyQuestionGoal: 5,
  todayMemoryReviews: 0,
  todayMemoryCorrectReviews: 0,
  todayQuestionReviews: 0,
  todayQuestionCorrectReviews: 0,
  questionStats,
  questionStatsBySense: {},
  dailyHistory: {},
  updatedAt: '2026-08-01T00:00:00.000Z',
}

describe('full backup security', () => {
  it('moves legacy folders out of the uncategorized bucket while loading', () => {
    const normalized = normalizeLibraryState({
      ...library,
      folders: [
        createUncategorizedFolder(),
        { id: 'legacy-folder', name: 'Legacy', parentId: '__uncategorized__', order: 0, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
      ],
    })

    expect(normalized.folders.find(folder => folder.id === 'legacy-folder')?.parentId).toBeUndefined()
  })

  it('accepts only the two canonical backup payload kinds', () => {
    expect(() => normalizeBackupPayload({ kind: 'unsupported-backup' })).toThrow('不支援的備份類型')
    expect(() => normalizeBackupPayload(null)).toThrow('備份內容格式錯誤')
  })

  it('never serializes the device API key', () => {
    const payload = buildFullBackupPayload(library, learning, stats, {
      enabled: true,
      provider: 'openai',
      apiKey: 'device-secret',
      baseUrl: '',
      model: 'gpt-4o-mini',
      batchSize: 10,
    })

    expect(JSON.stringify(payload)).not.toContain('device-secret')
    expect(payload.aiSettings).not.toHaveProperty('apiKey')
  })

  it('rejects an API key supplied by a backup file', () => {
    expect(() => normalizeFullBackupPayload({
      version: 1,
      exportedAt: '2026-08-01T00:00:00.000Z',
      appName: 'Lexiro',
      kind: 'full-backup',
      library,
      learning,
      stats,
      aiSettings: {
        enabled: true,
        provider: 'openai',
        apiKey: 'malicious-imported-key',
        baseUrl: '',
        model: 'gpt-4o-mini',
        batchSize: 10,
      },
    })).toThrow('apiKey')
  })

  it('rejects unknown question-stat buckets instead of dropping them', () => {
    const invalidStats = {
      ...stats,
      questionStats: {
        ...stats.questionStats,
        unexpected: { total: 1, correct: 1, retry: 0 },
      },
    }

    expect(() => normalizeFullBackupPayload({
      version: 1,
      exportedAt: '2026-08-01T00:00:00.000Z',
      appName: 'Lexiro',
      kind: 'full-backup',
      library,
      learning,
      stats: invalidStats,
      aiSettings: {
        enabled: false,
        provider: 'openai',
        baseUrl: '',
        model: 'gpt-4o-mini',
        batchSize: 10,
      },
    })).toThrow('不支援欄位')
  })

  it('rejects canonical words that are not referenced by any membership', () => {
    const makeWord = (wordKey: string, meaningZh: string): WordEntry => ({
      wordKey,
      word: wordKey,
      senses: [{ id: buildSenseId(wordKey, 'v.', meaningZh), pos: 'v.', meaningZh, examples: [] }],
      updatedAt: '2026-08-01T00:00:00.000Z',
    })
    const referenced = makeWord('abandon', '放棄')
    const orphan = makeWord('accept', '接受')
    const invalidLibrary: LibraryState = {
      ...library,
      words: { [referenced.wordKey]: referenced, [orphan.wordKey]: orphan },
      sets: [{ id: 'set-1', setName: 'Set 1', folderId: '__uncategorized__', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' }],
      memberships: { 'set-1': [{ wordKey: referenced.wordKey, senseIds: [referenced.senses[0].id] }] },
    }

    expect(() => normalizeFullBackupPayload({
      version: 1,
      exportedAt: '2026-08-01T00:00:00.000Z',
      appName: 'Lexiro',
      kind: 'full-backup',
      library: invalidLibrary,
      learning,
      stats,
      aiSettings: {
        enabled: false,
        provider: 'openai',
        baseUrl: '',
        model: 'gpt-4o-mini',
        batchSize: 10,
      },
    })).toThrow('沒有 membership')
  })
})

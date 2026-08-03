export const CLOUD_SCHEMA_VERSION = 4
export const LIBRARY_CLOUD_SCHEMA_VERSION = 5
export const MAX_LIBRARY_CHUNK_BYTES = 420 * 1024
export const MAX_LIBRARY_MANIFEST_BYTES = 420 * 1024
export const CLOUD_LIBRARY_BATCH_SIZE = 8

export const CLOUD_STATS_PAYLOAD_KEYS = [
  'totalMemoryReviews',
  'correctMemoryReviews',
  'totalQuestionReviews',
  'correctQuestionReviews',
  'streakDays',
  'longestStreak',
  'xp',
  'level',
  'lastStudyDate',
  'dailyWordGoal',
  'dailyQuestionGoal',
  'todayMemoryReviews',
  'todayMemoryCorrectReviews',
  'todayQuestionReviews',
  'todayQuestionCorrectReviews',
  'questionStats',
  'questionStatsBySense',
  'dailyHistory',
  'updatedAt',
] as const

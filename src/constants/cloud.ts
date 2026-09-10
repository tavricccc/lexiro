export const CLOUD_SCHEMA_VERSION = 5 as const
/**
 * Firestore refuses a document larger than one mebibyte. The learning progress
 * and statistics documents are each a single document, so they are checked
 * before upload and reported as a clear error instead of a rejected write.
 */
export const MAX_CLOUD_DOCUMENT_BYTES = 900 * 1024
export const MAX_LIBRARY_CHUNK_BYTES = 192 * 1024
export const MAX_LIBRARY_MANIFEST_BYTES = 420 * 1024
export const CLOUD_LIBRARY_BATCH_SIZE = 16
export const CLOUD_LIBRARY_DOWNLOAD_CONCURRENCY = 12
export const CLOUD_LIBRARY_UPLOAD_CONCURRENCY = 4

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

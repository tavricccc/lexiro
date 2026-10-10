export const CLOUD_SCHEMA_VERSION = 9 as const;
/**
 * Keep account blobs comfortably below D1's 2 MB row/binding limit and the
 * Worker request ceiling. Reject oversized payloads before upload.
 */
export const MAX_CLOUD_DOCUMENT_BYTES = 900 * 1024;
/** Records read per query. One page covers a typical Library in a single round trip. */
export const CLOUD_RECORD_PAGE_SIZE = 400;
/** Rows are encoded as one JSON binding and applied by one atomic SQL batch. */
export const CLOUD_WRITE_BATCH_SIZE = 400;

export const CLOUD_STATS_PAYLOAD_KEYS = [
  "totalMemoryReviews",
  "correctMemoryReviews",
  "totalQuestionReviews",
  "correctQuestionReviews",
  "streakDays",
  "longestStreak",
  "streakFreezes",
  "lastStudyDate",
  "dailyWordGoal",
  "dailyQuestionGoal",
  "todayMemoryReviews",
  "todayMemoryCorrectReviews",
  "todayQuestionReviews",
  "todayQuestionCorrectReviews",
  "questionStatsBySense",
  "dailyHistory",
  "updatedAt",
] as const;

export const CLOUD_SCHEMA_VERSION = 9 as const;
export const CLOUD_RECORD_COLLECTION = "records-v9";
export const CLOUD_LIBRARY_META_ID = "library-v9";
export const CLOUD_PROGRESS_DOCUMENT_ID = "global-v9";
export const CLOUD_STATS_DOCUMENT_ID = "summary-v9";
/**
 * Firestore refuses a document larger than one mebibyte. The learning progress
 * and statistics documents are each a single document, so they are checked
 * before upload and reported as a clear error instead of a rejected write.
 */
export const MAX_CLOUD_DOCUMENT_BYTES = 900 * 1024;
/** Records read per query. One page covers a typical Library in a single round trip. */
export const CLOUD_RECORD_PAGE_SIZE = 400;
/** Firestore accepts 500 writes per batch; the margin leaves room for the change marker. */
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

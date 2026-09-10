export const LEARNING_STORAGE_KEY = 'lexiro_learning_data'
export const AI_SETTINGS_KEY = 'lexiro_ai_settings'
export const AI_API_KEY_STORAGE_KEY = 'lexiro_ai_api_key'
export const SYNC_HEAD_STORAGE_KEY = 'lexiro_sync_head'
export const CLOUD_SYNC_PENDING_STORAGE_KEY = 'lexiro-sync-pending-v2'
export const CLOUD_SYNC_PENDING_EVENT = 'lexiro:sync-pending'
export const PRACTICE_SESSION_STORAGE_KEY = 'lexiro-practice-session-v3'
export const PRACTICE_PREFERENCES_STORAGE_KEY = 'lexiro-practice-preferences-v2'

/**
 * Keys whose value belongs to one signed-in account. They are read through
 * `resolveKey` in `persist.ts`, which prefixes them with the active namespace so
 * switching accounts cannot mix two people's data.
 */
export const NAMESPACE_SCOPED_KEYS: readonly string[] = [
  LEARNING_STORAGE_KEY,
  AI_SETTINGS_KEY,
  SYNC_HEAD_STORAGE_KEY,
]

import type { DashboardStats, LearningProgress } from "@/types";
import { CLOUD_SCHEMA_VERSION, CLOUD_STATS_PAYLOAD_KEYS } from "@/constants/cloud";
import { CloudSyncError } from "./cloud-sync-errors";
import { normalizeDashboardStats, normalizeLearningProgress } from "./share";

/**
 * The two documents that are still whole documents.
 *
 * The Library syncs record by record, but learning progress and statistics are
 * each one small blob that is only ever read and written as a whole. They are
 * merged field by field on the way in — see `cloud-account.ts` — so these
 * functions only have to say what a well-formed cloud copy looks like.
 */
export function validateCloudEnvelope(
  value: unknown,
  uid: string,
  field: string,
  payloadKeys: readonly string[] = [],
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new CloudSyncError("cloud/data-invalid", `${field} 格式錯誤`);
  const source = value as Record<string, unknown>;
  const allowedKeys = new Set(["ownerId", "schemaVersion", ...payloadKeys]);
  if (
    Object.keys(source).some((key) => !allowedKeys.has(key)) ||
    source.ownerId !== uid ||
    source.schemaVersion !== CLOUD_SCHEMA_VERSION
  )
    throw new CloudSyncError(
      "cloud/schema-unsupported",
      `${field} schema 不受支援`,
    );
  return source;
}

export function normalizeCloudProgress(
  value: unknown,
  uid: string,
): LearningProgress {
  const remote = validateCloudEnvelope(value, uid, "Cloud progress", [
    "cards",
    "updatedAt",
  ]);
  return normalizeLearningProgress({
    cards: remote.cards,
    updatedAt: remote.updatedAt,
  });
}

export function normalizeCloudStats(
  value: unknown,
  uid: string,
): DashboardStats {
  const remote = validateCloudEnvelope(
    value,
    uid,
    "Cloud stats",
    CLOUD_STATS_PAYLOAD_KEYS,
  );
  const {
    ownerId: _ownerId,
    schemaVersion: _schemaVersion,
    ...statsData
  } = remote;
  return normalizeDashboardStats(statsData);
}

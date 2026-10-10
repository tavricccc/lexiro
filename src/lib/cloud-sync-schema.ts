import type { DashboardStats, LearningProgress } from "@/types";
import {
  CLOUD_SCHEMA_VERSION,
  CLOUD_STATS_PAYLOAD_KEYS,
} from "@/constants/cloud";
import { CloudSyncError } from "./cloud-sync-errors";
import { normalizeDashboardStats, normalizeLearningProgress } from "./share";

/** Validates the account-wide learning progress and statistics documents. */
export function validateCloudEnvelope(
  value: unknown,
  uid: string,
  field: string,
  payloadKeys: readonly string[] = [],
): Record<string, unknown> {
  return validateEnvelope(value, uid, field, payloadKeys, CLOUD_SCHEMA_VERSION);
}

function validateEnvelope(
  value: unknown,
  uid: string,
  field: string,
  payloadKeys: readonly string[],
  schemaVersion: 8 | 9,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new CloudSyncError("cloud/data-invalid", `${field} 格式錯誤`);
  const source = value as Record<string, unknown>;
  const allowedKeys = new Set(["ownerId", "schemaVersion", ...payloadKeys]);
  if (
    Object.keys(source).some((key) => !allowedKeys.has(key)) ||
    source.ownerId !== uid ||
    source.schemaVersion !== schemaVersion
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
  return normalizeProgress(value, uid, CLOUD_SCHEMA_VERSION);
}

export function normalizeLegacyCloudProgress(
  value: unknown,
  uid: string,
): LearningProgress {
  return normalizeProgress(value, uid, 8);
}

function normalizeProgress(
  value: unknown,
  uid: string,
  schemaVersion: 8 | 9,
): LearningProgress {
  const remote = validateEnvelope(
    value,
    uid,
    "Cloud progress",
    ["cards", "updatedAt"],
    schemaVersion,
  );
  return normalizeLearningProgress({
    cards: remote.cards,
    updatedAt: remote.updatedAt,
  });
}

export function normalizeCloudStats(
  value: unknown,
  uid: string,
): DashboardStats {
  return normalizeStats(value, uid, CLOUD_SCHEMA_VERSION);
}

export function normalizeLegacyCloudStats(
  value: unknown,
  uid: string,
): DashboardStats {
  return normalizeStats(value, uid, 8);
}

function normalizeStats(
  value: unknown,
  uid: string,
  schemaVersion: 8 | 9,
): DashboardStats {
  const remote = validateEnvelope(
    value,
    uid,
    "Cloud stats",
    CLOUD_STATS_PAYLOAD_KEYS,
    schemaVersion,
  );
  const {
    ownerId: _ownerId,
    schemaVersion: _schemaVersion,
    ...statsData
  } = remote;
  return normalizeDashboardStats(statsData);
}

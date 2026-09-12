import type { AiSettings, DashboardStats, LearningProgress } from "@/types";
import {
  CLOUD_AI_SETTINGS_PAYLOAD_KEYS,
  CLOUD_SCHEMA_VERSION,
  CLOUD_STATS_PAYLOAD_KEYS,
} from "@/constants/cloud";
import { normalizeShareableAiSettings } from "./ai/settings";
import { CloudSyncError } from "./cloud-sync-errors";
import { normalizeDashboardStats, normalizeLearningProgress } from "./share";

/**
 * The three documents that are still whole documents.
 *
 * The Library syncs record by record, but learning progress, statistics and the
 * AI setup are each one small blob that is only ever read and written as a
 * whole, so these functions only have to say what a well-formed cloud copy
 * looks like.
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

/**
 * The AI setup as another device left it.
 *
 * `normalizeShareableAiSettings` is the same gate an imported backup goes
 * through, migrations included, so a device still writing an older shape is
 * read rather than rejected. What it refuses — an unknown field, a provider
 * that does not exist — is reported as a cloud schema error like any other.
 */
export function normalizeCloudAiSettings(
  value: unknown,
  uid: string,
): Omit<AiSettings, "apiKey"> {
  const remote = validateCloudEnvelope(
    value,
    uid,
    "Cloud AI settings",
    CLOUD_AI_SETTINGS_PAYLOAD_KEYS,
  );
  const {
    ownerId: _ownerId,
    schemaVersion: _schemaVersion,
    ...settings
  } = remote;
  try {
    return normalizeShareableAiSettings(settings);
  } catch (reason) {
    throw new CloudSyncError(
      "cloud/data-invalid",
      reason instanceof Error ? reason.message : String(reason),
    );
  }
}

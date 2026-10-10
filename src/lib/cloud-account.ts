import type { CloudClient } from "./cloud-client";
import type {
  CardProgress,
  DashboardStats,
  LearningProgress,
} from "@/types";
import {
  CLOUD_SCHEMA_VERSION,
  MAX_CLOUD_DOCUMENT_BYTES,
} from "@/constants";
import { SYNC_ORIGIN_ID } from "./cloud-sync";
import { randomUUID } from "./id";
import { CloudSyncError } from "./cloud-sync-errors";
import {
  normalizeCloudProgress,
  normalizeCloudStats,
} from "./cloud-sync-schema";
import { estimateJsonBytes } from "./hash";
import { normalizeCloudPreferences } from "./cloud-preferences";
import type { AiPreferences } from "./ai-preferences";
import { QUESTION_STAT_KEYS } from "./learning-defaults";
import { entriesOf } from "./record";

/** Account-wide review schedules and statistics merge field by field before upload. */

function assertFits(value: unknown, label: string): void {
  const bytes = estimateJsonBytes(value);
  if (bytes > MAX_CLOUD_DOCUMENT_BYTES)
    throw new CloudSyncError(
      "cloud/data-invalid",
      `${label}資料過大（${Math.round(bytes / 1024)} KB），無法同步至雲端`,
    );
}

function laterOf(left: string | undefined, right: string | undefined): string {
  return (left ?? "") >= (right ?? "") ? (left ?? "") : (right ?? "");
}

/**
 * Merges review schedules card by card.
 *
 * Answering the same word on two devices is the one conflict that actually
 * loses work if a whole document is taken from one side: the other device's
 * entire history goes with it. Per card, the more recent review wins, which is
 * the comparison `remapSenses` already makes when two senses are folded
 * together.
 */
export function mergeProgress(
  local: LearningProgress,
  remote: LearningProgress | null,
): LearningProgress {
  if (!remote) return local;
  const cards: Record<string, CardProgress> = { ...remote.cards };
  for (const [senseId, card] of Object.entries(local.cards)) {
    const current = cards[senseId];
    if (
      !current ||
      laterOf(card.lastReview, current.lastReview) === (card.lastReview ?? "")
    )
      cards[senseId] = card;
  }
  return {
    cards: cards as LearningProgress["cards"],
    updatedAt: laterOf(local.updatedAt, remote.updatedAt),
  };
}

/**
 * Merges statistics so neither device's practice disappears.
 *
 * Counters only ever go up, so the larger value is the one that has seen more
 * work. Daily history is per day, and the day with more answers in it is the
 * one that was actually recorded; goals are a setting, so the more recent edit
 * wins instead. Days back are spent as well as earned, so they come from the
 * more recent side with everything else — taking the larger would hand back a
 * day the other device had already spent repairing the streak.
 */
export function mergeStats(
  local: DashboardStats,
  remote: DashboardStats | null,
): DashboardStats {
  if (!remote) return local;
  const newest = local.updatedAt >= remote.updatedAt ? local : remote;
  const dailyHistory = { ...remote.dailyHistory };
  for (const [date, activity] of Object.entries(local.dailyHistory)) {
    const current = dailyHistory[date];
    if (
      !current ||
      activity.questionTotal + activity.memoryAgain + activity.memoryGood >=
        current.questionTotal + current.memoryAgain + current.memoryGood
    )
      dailyHistory[date] = activity;
  }
  const questionStatsBySense = {
    ...remote.questionStatsBySense,
  };
  for (const [senseId, incoming] of entriesOf(local.questionStatsBySense)) {
    const totals = { ...questionStatsBySense[senseId] };
    for (const key of QUESTION_STAT_KEYS) {
      const row = incoming[key];
      if (!row) continue;
      const current = totals[key];
      totals[key] = current
        ? {
            total: Math.max(row.total, current.total),
            correct: Math.max(row.correct, current.correct),
            retry: Math.max(row.retry, current.retry),
          }
        : row;
    }
    questionStatsBySense[senseId] = totals;
  }
  return {
    ...newest,
    totalMemoryReviews: Math.max(
      local.totalMemoryReviews,
      remote.totalMemoryReviews,
    ),
    correctMemoryReviews: Math.max(
      local.correctMemoryReviews,
      remote.correctMemoryReviews,
    ),
    totalQuestionReviews: Math.max(
      local.totalQuestionReviews,
      remote.totalQuestionReviews,
    ),
    correctQuestionReviews: Math.max(
      local.correctQuestionReviews,
      remote.correctQuestionReviews,
    ),
    longestStreak: Math.max(local.longestStreak, remote.longestStreak),
    lastStudyDate: laterOf(local.lastStudyDate, remote.lastStudyDate),
    questionStatsBySense,
    dailyHistory,
    updatedAt: laterOf(local.updatedAt, remote.updatedAt),
  };
}

export interface CloudBlobs {
  preferences: AiPreferences | null;
  progress: LearningProgress | null;
  stats: DashboardStats | null;
}

export async function readCloudBlobs(
  db: CloudClient,
  uid: string,
  signal?: AbortSignal,
): Promise<CloudBlobs> {
  if (db.uid !== uid) throw new Error("auth/account-changed");
  const { blobs, revision } = await db.request<{ blobs: { progress?: unknown; stats?: unknown; preferences?: unknown }; revision: number }>("/sync/blobs", undefined, signal);
  db.blobRevision = revision;
  return {
    preferences: blobs.preferences ? normalizeCloudPreferences(blobs.preferences, uid) : null,
    progress: blobs.progress ? normalizeCloudProgress(blobs.progress, uid) : null,
    stats: blobs.stats ? normalizeCloudStats(blobs.stats, uid) : null,
  };
}

export async function writeCloudProgress(
  db: CloudClient,
  uid: string,
  progress: LearningProgress,
  signal?: AbortSignal,
): Promise<void> {
  await writeCloudBlob(db, uid, "progress", cloudProgressData(uid, progress), signal);
}

export async function writeCloudStats(
  db: CloudClient,
  uid: string,
  stats: DashboardStats,
  signal?: AbortSignal,
): Promise<void> {
  await writeCloudBlob(db, uid, "stats", cloudStatsData(uid, stats), signal);
}
export async function writeCloudBlob(db: CloudClient, uid: string, kind: "progress" | "stats" | "preferences", data: unknown, signal?: AbortSignal) {
  if (db.uid !== uid) throw new Error("auth/account-changed");
  const result = await db.request<{ revision: number }>("/sync/blobs", { expectedRevision: db.blobRevision, blobs: [{ kind, data }], origin: SYNC_ORIGIN_ID, operationId: randomUUID() }, signal);
  db.blobRevision = result.revision;
}

export function cloudProgressData(uid: string, progress: LearningProgress) {
  assertFits(progress, "學習進度");
  return {
    ...progress,
    ownerId: uid,
    schemaVersion: CLOUD_SCHEMA_VERSION,
  };
}

export function cloudStatsData(uid: string, stats: DashboardStats) {
  assertFits(stats, "學習統計");
  return {
    ...stats,
    ownerId: uid,
    schemaVersion: CLOUD_SCHEMA_VERSION,
  };
}

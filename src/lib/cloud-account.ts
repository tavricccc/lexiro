import type { Firestore } from "firebase/firestore";
import type {
  AiSettings,
  CardProgress,
  DashboardStats,
  FirestoreAiSettingsDoc,
  FirestoreProgressDoc,
  FirestoreStatsDoc,
  LearningProgress,
} from "@/types";
import { getDoc, setDoc } from "firebase/firestore";
import { CLOUD_SCHEMA_VERSION, MAX_CLOUD_DOCUMENT_BYTES } from "@/constants";
import { getShareableAiSettings } from "./ai-provider";
import { cloudDocument, withDeadline } from "./cloud-sync";
import { CloudSyncError } from "./cloud-sync-errors";
import {
  normalizeCloudAiSettings,
  normalizeCloudProgress,
  normalizeCloudStats,
} from "./cloud-sync-schema";
import { prepareFirestoreData } from "./firestore-data";
import { estimateJsonBytes } from "./hash";

/**
 * The three documents that are not records: review schedules, statistics and
 * AI settings.
 *
 * Each is small, read and written whole, and belongs to exactly one account, so
 * splitting them into records would buy nothing. What they do need is a merge.
 * Taking one side wholesale is what loses a day of reviews when the same word
 * was answered on a phone and a laptop, so each document is reconciled field by
 * field on the way in and only then written back.
 */

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
    if (!current || laterOf(card.lastReview, current.lastReview) === (card.lastReview ?? ""))
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
 * wins instead.
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
    ...local.questionStatsBySense,
  };
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
    xp: Math.max(local.xp, remote.xp),
    level: Math.max(local.level, remote.level),
    lastStudyDate: laterOf(local.lastStudyDate, remote.lastStudyDate),
    questionStatsBySense,
    dailyHistory,
    updatedAt: laterOf(local.updatedAt, remote.updatedAt),
  };
}

export interface CloudBlobs {
  progress: LearningProgress | null;
  stats: DashboardStats | null;
  settings: Omit<AiSettings, "apiKey"> | null;
}

/**
 * The three whole documents, read together.
 *
 * `getDoc` is deliberate where the old code forced `getDocFromServer`: the
 * SDK's persistent cache answers instantly when nothing has changed and still
 * serves an answer when the network is gone, which is most of what made a sync
 * feel slow before.
 */
export async function readCloudBlobs(
  db: Firestore,
  uid: string,
  signal?: AbortSignal,
): Promise<CloudBlobs> {
  const [progress, stats, settings] = await withDeadline(
    Promise.all([
      getDoc(cloudDocument(db, uid, "progress", "global")),
      getDoc(cloudDocument(db, uid, "stats", "summary")),
      getDoc(cloudDocument(db, uid, "settings", "ai")),
    ]),
    "Account documents download",
    signal,
  );
  return {
    progress: progress.exists()
      ? normalizeCloudProgress(progress.data(), uid)
      : null,
    stats: stats.exists() ? normalizeCloudStats(stats.data(), uid) : null,
    settings: settings.exists()
      ? normalizeCloudAiSettings(settings.data(), uid)
      : null,
  };
}

export async function writeCloudProgress(
  db: Firestore,
  uid: string,
  progress: LearningProgress,
  signal?: AbortSignal,
): Promise<void> {
  assertFits(progress, "學習進度");
  await withDeadline(
    setDoc(
      cloudDocument(db, uid, "progress", "global"),
      prepareFirestoreData({
        ...progress,
        ownerId: uid,
        schemaVersion: CLOUD_SCHEMA_VERSION,
      } satisfies FirestoreProgressDoc),
    ),
    "Progress upload",
    signal,
  );
}

export async function writeCloudStats(
  db: Firestore,
  uid: string,
  stats: DashboardStats,
  signal?: AbortSignal,
): Promise<void> {
  assertFits(stats, "學習統計");
  await withDeadline(
    setDoc(
      cloudDocument(db, uid, "stats", "summary"),
      prepareFirestoreData({
        ...stats,
        ownerId: uid,
        schemaVersion: CLOUD_SCHEMA_VERSION,
      } satisfies FirestoreStatsDoc),
    ),
    "Stats upload",
    signal,
  );
}

export async function writeCloudAiSettings(
  db: Firestore,
  uid: string,
  settings: AiSettings,
  signal?: AbortSignal,
): Promise<void> {
  await withDeadline(
    setDoc(
      cloudDocument(db, uid, "settings", "ai"),
      prepareFirestoreData({
        ...getShareableAiSettings(settings),
        ownerId: uid,
        schemaVersion: CLOUD_SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
      } satisfies FirestoreAiSettingsDoc),
    ),
    "AI settings upload",
    signal,
  );
}

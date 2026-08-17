import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

import type {
  AiSettings,
  DashboardStats,
  FullBackupPayload,
  LearningProgress,
  LibraryState,
} from "@/types";
import {
  APP_NAME,
  BACKUP_FILE_PREFIX,
  EXPORT_VERSION,
  ZIP_INTERNAL_FILENAME,
} from "@/constants";
import { getShareableAiSettings } from "@/src/lib/ai-provider";
import { mergeLibraryStates } from "@/src/lib/library-merge";
import {
  normalizeDashboardStats,
  normalizeFullBackupPayload,
  normalizeLearningProgress,
  normalizeLibraryState,
} from "@/src/lib/share";
import { isRecord } from "@/src/lib/schema";
import { localDateKey } from "@/src/lib/date";

export interface PreparedBackupImport {
  aiSettings: Omit<AiSettings, "apiKey">;
  cards: number;
  library: LibraryState;
  progress: LearningProgress;
  questions: number;
  sets: number;
  stats: DashboardStats;
}

export function createFullBackup(
  library: LibraryState,
  progress: LearningProgress,
  stats: DashboardStats,
  aiSettings: AiSettings,
): FullBackupPayload {
  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    appName: APP_NAME,
    kind: "full-backup",
    library,
    learning: progress,
    stats,
    aiSettings: getShareableAiSettings(aiSettings),
  };
}

export function downloadFullBackup(payload: FullBackupPayload): void {
  const bytes = zipSync({
    [ZIP_INTERNAL_FILENAME]: strToU8(JSON.stringify(payload)),
  }) as Uint8Array<ArrayBuffer>;
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/zip" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${BACKUP_FILE_PREFIX}${localDateKey()}.zip`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function readFullBackup(file: File): Promise<FullBackupPayload> {
  const archive = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const raw = archive[ZIP_INTERNAL_FILENAME];
  if (!raw) throw new Error(`${ZIP_INTERNAL_FILENAME} missing`);
  const value: unknown = JSON.parse(strFromU8(raw));
  return isSettingsBackupV2(value)
    ? migrateSettingsBackupV2(value)
    : normalizeFullBackupPayload(value);
}

export function prepareBackupImport(
  backup: FullBackupPayload,
  currentLibrary: LibraryState,
  currentProgress: LearningProgress,
  currentStats: DashboardStats,
): PreparedBackupImport {
  const mergedLibrary = mergeLibraryStates(currentLibrary, backup.library);
  const progress: LearningProgress = {
    cards: { ...backup.learning.cards, ...currentProgress.cards },
    updatedAt: new Date().toISOString(),
  };
  const hasLocalActivity =
    currentStats.totalMemoryReviews > 0 ||
    currentStats.totalQuestionReviews > 0 ||
    currentStats.xp > 0 ||
    Object.keys(currentStats.dailyHistory).length > 0;

  return {
    library: mergedLibrary.state,
    progress,
    stats: hasLocalActivity ? currentStats : backup.stats,
    aiSettings: backup.aiSettings,
    sets: mergedLibrary.result.addedSets,
    questions: mergedLibrary.result.addedQuestions,
    cards: Object.keys(backup.learning.cards).filter(
      (senseId) => !currentProgress.cards[senseId],
    ).length,
  };
}

interface SettingsBackupV2 {
  ai?: unknown;
  exportedAt: string;
  library: unknown;
  progress: unknown;
  schemaVersion: 2;
  stats: unknown;
}

function isSettingsBackupV2(value: unknown): value is SettingsBackupV2 {
  return (
    isRecord(value) &&
    value.schemaVersion === 2 &&
    typeof value.exportedAt === "string"
  );
}

function migrateSettingsBackupV2(value: SettingsBackupV2): FullBackupPayload {
  const ai = isRecord(value.ai) ? value.ai : {};
  const provider =
    ai.provider === "anthropic" ||
    ai.provider === "google" ||
    ai.provider === "custom"
      ? ai.provider
      : "openai";
  const batchSize =
    typeof ai.batchSize === "number" && Number.isFinite(ai.batchSize)
      ? Math.min(20, Math.max(5, Math.round(ai.batchSize)))
      : 10;

  return {
    version: EXPORT_VERSION,
    exportedAt: value.exportedAt,
    appName: APP_NAME,
    kind: "full-backup",
    library: normalizeLibraryState(value.library),
    learning: normalizeLearningProgress(value.progress),
    stats: normalizeDashboardStats(value.stats),
    aiSettings: {
      enabled: ai.mode === "api",
      provider,
      baseUrl: typeof ai.endpoint === "string" ? ai.endpoint : "",
      model:
        typeof ai.model === "string" && ai.model.trim()
          ? ai.model.trim()
          : "gpt-4o-mini",
      batchSize,
    },
  };
}

import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

import type {
  DashboardStats,
  FullBackupPayload,
  LearningProgress,
  LibraryState,
} from "@/types";
import {
  APP_NAME,
  BACKUP_FILE_PREFIX,
  FULL_BACKUP_VERSION,
  ZIP_INTERNAL_FILENAME,
} from "@/constants";
import { mergeLibraryStates } from "@/src/lib/library-merge";
import { normalizeFullBackupPayload } from "@/src/lib/share";
import { keysOf } from "@/src/lib/record";
import { localDateKey } from "@/src/lib/date";

export interface PreparedBackupImport {
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
): FullBackupPayload {
  return {
    version: FULL_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    appName: APP_NAME,
    kind: "full-backup",
    library,
    learning: progress,
    stats,
  };
}

export function downloadFullBackup(payload: FullBackupPayload): void {
  const bytes = zipSync({
    [ZIP_INTERNAL_FILENAME]: strToU8(JSON.stringify(payload)),
  }) as Uint8Array<ArrayBuffer>;
  const url = URL.createObjectURL(
    new Blob([bytes], { type: "application/zip" }),
  );
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
  return normalizeFullBackupPayload(JSON.parse(strFromU8(raw)));
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
    sets: mergedLibrary.result.addedSets,
    questions: mergedLibrary.result.addedQuestions,
    cards: keysOf(backup.learning.cards).filter(
      (senseId) => !currentProgress.cards[senseId],
    ).length,
  };
}


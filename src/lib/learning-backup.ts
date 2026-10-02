import type { DashboardStats, LearningProgress } from "@/types";

/** Import missing schedules while retaining this account's existing activity. */
export function mergeBackupLearning(
  currentProgress: LearningProgress,
  currentStats: DashboardStats,
  incomingProgress: LearningProgress,
  incomingStats: DashboardStats,
): { progress: LearningProgress; stats: DashboardStats } {
  const hasLocalActivity =
    currentStats.totalMemoryReviews > 0 ||
    currentStats.totalQuestionReviews > 0 ||
    Object.keys(currentStats.dailyHistory).length > 0;
  return {
    progress: {
      cards: { ...incomingProgress.cards, ...currentProgress.cards },
      updatedAt: new Date().toISOString(),
    },
    stats: hasLocalActivity ? currentStats : incomingStats,
  };
}

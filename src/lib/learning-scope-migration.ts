import type { DashboardStats, LearningProgress } from "@/types";
import { cloneJson } from "./clone";
import type { SenseScopeRemap } from "./library-set-migration";

/** Duplicate historical per-sense state once; aggregate history stays intact. */
export function remapLearningSnapshot(
  progress: LearningProgress,
  stats: DashboardStats,
  remaps: SenseScopeRemap[],
) {
  const cards = { ...progress.cards };
  const bySense = { ...stats.questionStatsBySense };
  const targets = new Set(remaps.map((remap) => remap.newSenseId));
  for (const { oldSenseId, newSenseId } of remaps) {
    if (oldSenseId === newSenseId) continue;
    if (progress.cards[oldSenseId] && !cards[newSenseId])
      cards[newSenseId] = cloneJson(progress.cards[oldSenseId]);
    if (stats.questionStatsBySense[oldSenseId] && !bySense[newSenseId])
      bySense[newSenseId] = cloneJson(stats.questionStatsBySense[oldSenseId]);
  }
  for (const { oldSenseId, newSenseId } of remaps) {
    if (oldSenseId === newSenseId) continue;
    if (!targets.has(oldSenseId)) {
      delete cards[oldSenseId];
      delete bySense[oldSenseId];
    }
  }
  return {
    progress: { ...progress, cards },
    stats: { ...stats, questionStatsBySense: bySense },
  };
}

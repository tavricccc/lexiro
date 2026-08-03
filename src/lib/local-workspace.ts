import type { DashboardStats, LearningProgress, LibraryState } from '@/types'

export function hasLocalWorkspaceData(library: LibraryState, progress: LearningProgress, stats: DashboardStats): boolean {
  return library.sets.length > 0
    || Object.keys(library.words).length > 0
    || Object.keys(progress.cards).length > 0
    || stats.xp > 0
    || stats.totalMemoryReviews > 0
    || stats.totalQuestionReviews > 0
}

import type { CardProgress, ReviewRating } from "@/types";

import { MASTERED_STREAK, LEECH_WRONG_THRESHOLD } from "@/constants";

export function createInitialProgress(): CardProgress {
  return { reviewCount: 0, correctCount: 0, wrongCount: 0, streak: 0 };
}

export function reviewCard(
  progress: CardProgress | null,
  rating: ReviewRating,
  now = new Date(),
): CardProgress {
  const previous = progress ?? createInitialProgress();
  const correct = rating !== "again";
  return {
    reviewCount: previous.reviewCount + 1,
    correctCount: previous.correctCount + (correct ? 1 : 0),
    wrongCount: previous.wrongCount + (correct ? 0 : 1),
    streak: correct ? previous.streak + 1 : 0,
    lastReview: now.toISOString(),
  };
}

/** A sense answered wrong often enough that it deserves focused practice. */
export function isLeech(progress: CardProgress | null): boolean {
  return (progress?.wrongCount ?? 0) >= LEECH_WRONG_THRESHOLD;
}

/** A sense answered right enough times in a row to count as known. */
export function isMastered(progress: CardProgress | null): boolean {
  return (progress?.streak ?? 0) >= MASTERED_STREAK;
}

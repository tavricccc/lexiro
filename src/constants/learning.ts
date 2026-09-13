export const DAILY_WORD_GOAL_OPTIONS = [15, 20, 25] as const
export const DAILY_QUESTION_GOAL_OPTIONS = [5, 10, 15, 20, 25] as const

/**
 * How the streak protects itself.
 *
 * A week of unbroken practice earns one day back, and no more than two are ever
 * held. The point is that one missed day stops being a reason to abandon a long
 * streak; holding an unlimited supply would make the streak mean nothing.
 */
export const STREAK_FREEZE_EARNED_EVERY_DAYS = 7
export const MAX_STREAK_FREEZES = 2

/** Stability, in days, at which a sense counts as learned rather than in progress. */
export const MASTERED_STABILITY_DAYS = 21

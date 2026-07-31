export const DAILY_GOAL_OPTIONS = [15, 20, 25] as const
export const DAILY_WORD_GOAL_OPTIONS = DAILY_GOAL_OPTIONS
export const DAILY_QUESTION_GOAL_OPTIONS = [5, 10, 15, 20, 25] as const

export type DailyGoal = typeof DAILY_GOAL_OPTIONS[number]

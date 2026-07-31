export const DAILY_GOAL_OPTIONS = [15, 20, 25] as const

export type DailyGoal = typeof DAILY_GOAL_OPTIONS[number]

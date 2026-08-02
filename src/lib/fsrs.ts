import type { Card } from 'ts-fsrs'
import type { CardProgress, ReviewRating } from '@/types'
import { createEmptyCard, fsrs, Rating } from 'ts-fsrs'

const scheduler = fsrs({ enable_fuzz: false })

const ratings: Record<ReviewRating, Rating> = {
  again: Rating.Again,
  good: Rating.Good,
}

function cardFromProgress(progress: CardProgress | null, now: Date): Card {
  if (!progress)
    return createEmptyCard(now)

  return {
    due: new Date(progress.due),
    stability: progress.stability,
    difficulty: progress.difficulty,
    elapsed_days: progress.elapsedDays,
    scheduled_days: progress.scheduledDays,
    learning_steps: progress.learningSteps,
    reps: progress.reps,
    lapses: progress.lapses,
    state: progress.state,
    last_review: progress.lastReview ? new Date(progress.lastReview) : undefined,
  }
}

function cardToProgress(card: Card, previous: CardProgress | null, now: Date, rating: ReviewRating): CardProgress {
  const wasCorrect = rating !== 'again'
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    lastReview: card.last_review?.toISOString() ?? now.toISOString(),
    reviewCount: (previous?.reviewCount ?? 0) + 1,
    correctCount: (previous?.correctCount ?? 0) + (wasCorrect ? 1 : 0),
  }
}

export function createInitialProgress(now = new Date()): CardProgress {
  const card = createEmptyCard(now)
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    reviewCount: 0,
    correctCount: 0,
  }
}

export function reviewCard(progress: CardProgress | null, rating: ReviewRating, now = new Date()): CardProgress {
  const result = scheduler.next(cardFromProgress(progress, now), now, ratings[rating] as 1 | 2 | 3 | 4)
  return cardToProgress(result.card, progress, now, rating)
}

export function isDue(progress: CardProgress | null, now = new Date()): boolean {
  return !progress || new Date(progress.due).getTime() <= now.getTime()
}

export function retrievability(progress: CardProgress | null, now = new Date()): number {
  if (!progress)
    return 0
  const card = cardFromProgress(progress, now)
  return scheduler.get_retrievability(card, now, false)
}

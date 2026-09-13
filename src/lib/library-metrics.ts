import type {
  CardProgress,
  LibraryState,
  SenseId,
  WordEntry,
  WordKey,
} from "@/types";

import { MASTERED_STABILITY_DAYS } from "@/constants";
import { isDue } from "@/src/lib/fsrs";

export interface LibrarySetMetrics {
  due: number;
  learned: number;
  questionCount: number;
  senseCount: number;
}

export function countReviewableSenses(
  words: Record<WordKey, WordEntry>,
  cards: Record<SenseId, CardProgress>,
  now = new Date(),
): number {
  let count = 0;
  for (const word of Object.values(words)) {
    for (const sense of word.senses) {
      if (!cards[sense.id] || isDue(cards[sense.id], now)) count += 1;
    }
  }
  return count;
}

export function countQuestionItems(state: LibraryState): number {
  let count = 0;
  for (const question of state.questions) {
    count += question.kind === "reading" ? question.questions.length : 1;
  }
  return count;
}

export function buildLibrarySetMetrics(
  state: LibraryState,
  cards: Record<SenseId, CardProgress>,
  now = new Date(),
): Map<string, LibrarySetMetrics> {
  const metrics = new Map<string, LibrarySetMetrics>();
  const setIdsBySense = new Map<SenseId, Set<string>>();

  for (const set of state.sets) {
    const senseIds = new Set(
      (state.memberships[set.id] ?? []).flatMap(
        (membership) => membership.senseIds,
      ),
    );
    let learned = 0;
    let due = 0;

    for (const senseId of senseIds) {
      const card = cards[senseId];
      if (card) learned += 1;
      if (card && isDue(card, now)) due += 1;

      const setIds = setIdsBySense.get(senseId) ?? new Set<string>();
      setIds.add(set.id);
      setIdsBySense.set(senseId, setIds);
    }

    metrics.set(set.id, {
      due,
      learned,
      questionCount: 0,
      senseCount: senseIds.size,
    });
  }

  for (const question of state.questions) {
    const senseIds =
      question.kind === "reading"
        ? question.questions.map((child) => child.senseId)
        : [question.senseId];
    const affectedSetIds = new Set<string>();
    for (const senseId of senseIds) {
      for (const setId of setIdsBySense.get(senseId) ?? [])
        affectedSetIds.add(setId);
    }
    for (const setId of affectedSetIds) {
      const current = metrics.get(setId);
      if (current) current.questionCount += 1;
    }
  }

  return metrics;
}

export interface MasteryCounts {
  mastered: number;
  learning: number;
  untouched: number;
  total: number;
}

/**
 * How much of the Library is actually known, read straight off the schedule.
 *
 * FSRS already holds the answer: a card's stability is how many days it is
 * expected to stay remembered. A sense the scheduler will not ask about for
 * three weeks is one you know, and that is worth far more than a count of how
 * many times you have tapped a button.
 */
export function countMastery(
  words: Record<WordKey, WordEntry>,
  cards: Record<SenseId, CardProgress>,
): MasteryCounts {
  const counts: MasteryCounts = {
    mastered: 0,
    learning: 0,
    untouched: 0,
    total: 0,
  };
  for (const word of Object.values(words))
    for (const sense of word.senses) {
      counts.total += 1;
      const card = cards[sense.id];
      if (!card) counts.untouched += 1;
      else if (card.stability >= MASTERED_STABILITY_DAYS) counts.mastered += 1;
      else counts.learning += 1;
    }
  return counts;
}

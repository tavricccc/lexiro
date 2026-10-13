import type {
  CardProgress,
  LibraryState,
  SenseId,
  WordEntry,
  WordKey,
} from "@/types";

import { isMastered } from "@/src/lib/card-progress";
import { isExamQuestion } from "./question-ownership";

export interface LibrarySetMetrics {
  learned: number;
  questionCount: number;
  senseCount: number;
}

export function countQuestionItems(state: LibraryState): number {
  let count = 0;
  for (const question of state.questions) {
    if (!isExamQuestion(question)) continue;
    count += question.kind === "reading" ? question.questions.length : 1;
  }
  return count;
}

export function buildLibrarySetMetrics(
  state: LibraryState,
  cards: Record<SenseId, CardProgress>,
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

    for (const senseId of senseIds) {
      if (cards[senseId]) learned += 1;

      const setIds = setIdsBySense.get(senseId) ?? new Set<string>();
      setIds.add(set.id);
      setIdsBySense.set(senseId, setIds);
    }

    metrics.set(set.id, {
      learned,
      questionCount: 0,
      senseCount: senseIds.size,
    });
  }

  for (const question of state.questions) {
    if (!isExamQuestion(question)) continue;
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
 * How much of the Library is actually known.
 *
 * A sense answered correctly several times in a row is one you know; a single
 * wrong answer puts it back to learning.
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
      else if (isMastered(card)) counts.mastered += 1;
      else counts.learning += 1;
    }
  return counts;
}

/** Device-local learning history. Calendar days are supplied by the host. */
export type DailyGoal = 10 | 20 | 30;
export type Familiarity = 0 | 1 | 2 | 3;
export interface AnswerCount {
  answered: number;
  correct: number;
}
export interface SenseRecord extends AnswerCount {
  wordKey: string;
  level: Familiarity;
  lastDay: string;
}
export interface LearningRecord {
  version: 1;
  goal: DailyGoal;
  /** When the goal was last chosen; across devices the latest choice wins. */
  goalUpdatedAt?: string;
  days: Record<string, AnswerCount>;
  senses: Record<string, SenseRecord>;
  kinds: Record<string, AnswerCount>;
}
export interface LearningAnswer {
  day: string;
  senseId: string;
  wordKey: string;
  kind: string;
  correct: boolean;
}
export const emptyLearningRecord = (): LearningRecord => ({
  version: 1,
  goal: 20,
  days: {},
  senses: {},
  kinds: {},
});

export function calendarDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** UTC arithmetic on a date-only key avoids DST and host-timezone changes. */
export function shiftDay(day: string, amount: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
function increment(
  previous: AnswerCount | undefined,
  right: boolean,
): AnswerCount {
  return {
    answered: (previous?.answered ?? 0) + 1,
    correct: (previous?.correct ?? 0) + Number(right),
  };
}
export function recordAnswer(
  record: LearningRecord,
  answer: LearningAnswer,
): LearningRecord {
  const previous = record.senses[answer.senseId];
  const level = Math.max(
    0,
    Math.min(3, (previous?.level ?? 0) + (answer.correct ? 1 : -1)),
  ) as Familiarity;
  return {
    ...record,
    days: {
      ...record.days,
      [answer.day]: increment(record.days[answer.day], answer.correct),
    },
    kinds: {
      ...record.kinds,
      [answer.kind]: increment(record.kinds[answer.kind], answer.correct),
    },
    senses: {
      ...record.senses,
      [answer.senseId]: {
        ...increment(previous, answer.correct),
        wordKey: answer.wordKey,
        level,
        lastDay: answer.day,
      },
    },
  };
}
export function streak(record: LearningRecord, today: string): number {
  let day = record.days[today]?.answered ? today : shiftDay(today, -1);
  let count = 0;
  while (record.days[day]?.answered) {
    count++;
    day = shiftDay(day, -1);
  }
  return count;
}
export function accuracy(count: AnswerCount | undefined): number {
  return count?.answered
    ? Math.round((count.correct / count.answered) * 100)
    : 0;
}
export function recentAccuracy(
  record: LearningRecord,
  today: string,
  days = 7,
): number {
  const total = { answered: 0, correct: 0 };
  for (let i = 0; i < days; i++) {
    const value = record.days[shiftDay(today, -i)];
    total.answered += value?.answered ?? 0;
    total.correct += value?.correct ?? 0;
  }
  return accuracy(total);
}
export function mostMissed(
  record: LearningRecord,
  limit = 10,
): Array<{ wordKey: string; missed: number }> {
  const words = new Map<string, number>();
  for (const sense of Object.values(record.senses)) {
    const missed = sense.answered - sense.correct;
    if (missed)
      words.set(sense.wordKey, (words.get(sense.wordKey) ?? 0) + missed);
  }
  return [...words]
    .map(([wordKey, missed]) => ({ wordKey, missed }))
    .sort((a, b) => b.missed - a.missed || a.wordKey.localeCompare(b.wordKey))
    .slice(0, limit);
}
export function heatMap(record: LearningRecord, today: string, weeks = 12) {
  return Array.from({ length: weeks * 7 }, (_, i) => {
    const day = shiftDay(today, i - weeks * 7 + 1);
    const count = record.days[day]?.answered ?? 0;
    return {
      day,
      count,
      intensity:
        count === 0 ? 0 : Math.min(4, Math.ceil((count / record.goal) * 4)),
    };
  });
}
export function familiarity(
  record: LearningRecord,
  senseIds: readonly string[],
): number {
  return senseIds.length
    ? Math.round(
        (senseIds.reduce(
          (sum, id) => sum + (record.senses[id]?.level ?? 0),
          0,
        ) /
          (senseIds.length * 3)) *
          100,
      )
    : 0;
}

/** Reject damaged data rather than displaying invented progress. */
export function parseLearningRecord(value: unknown): LearningRecord {
  const empty = emptyLearningRecord();
  if (!value || typeof value !== "object") return empty;
  const r = value as LearningRecord;
  const validCount = (v: AnswerCount) =>
    v &&
    Number.isSafeInteger(v.answered) &&
    Number.isSafeInteger(v.correct) &&
    v.answered >= 0 &&
    v.correct >= 0 &&
    v.correct <= v.answered;
  if (
    r.version !== 1 ||
    ![10, 20, 30].includes(r.goal) ||
    (r.goalUpdatedAt !== undefined && typeof r.goalUpdatedAt !== "string") ||
    !r.days ||
    !r.kinds ||
    !r.senses
  )
    return empty;
  if (
    !Object.entries(r.days).every(
      ([key, v]) => /^\d{4}-\d{2}-\d{2}$/.test(key) && validCount(v),
    ) ||
    !Object.values(r.kinds).every(validCount)
  )
    return empty;
  if (
    !Object.values(r.senses).every(
      (v) =>
        validCount(v) &&
        typeof v.wordKey === "string" &&
        typeof v.lastDay === "string" &&
        [0, 1, 2, 3].includes(v.level),
    )
  )
    return empty;
  return r;
}

function addCounts(
  target: Record<string, AnswerCount>,
  source: Record<string, AnswerCount>,
  combine: (a: number, b: number) => number,
) {
  for (const [key, value] of Object.entries(source)) {
    const previous = target[key];
    target[key] = previous
      ? {
          answered: combine(previous.answered, value.answered),
          correct: combine(previous.correct, value.correct),
        }
      : { answered: value.answered, correct: value.correct };
  }
}

function combineRecords(
  records: readonly LearningRecord[],
  combine: (a: number, b: number) => number,
): LearningRecord {
  const result = emptyLearningRecord();
  let goalAt: string | undefined,
    first = true;
  for (const record of records) {
    const at = record.goalUpdatedAt;
    if (first || (at && (!goalAt || at > goalAt))) {
      result.goal = record.goal;
      goalAt = at;
      first = false;
    }
    addCounts(result.days, record.days, combine);
    addCounts(result.kinds, record.kinds, combine);
    for (const [id, sense] of Object.entries(record.senses)) {
      const previous = result.senses[id];
      if (!previous) {
        result.senses[id] = { ...sense };
        continue;
      }
      const newer =
        sense.lastDay > previous.lastDay ||
        (sense.lastDay === previous.lastDay && sense.level > previous.level);
      result.senses[id] = {
        answered: combine(previous.answered, sense.answered),
        correct: combine(previous.correct, sense.correct),
        wordKey: newer ? sense.wordKey : previous.wordKey,
        level: newer ? sense.level : previous.level,
        lastDay: newer ? sense.lastDay : previous.lastDay,
      };
    }
  }
  if (goalAt) result.goalUpdatedAt = goalAt;
  return result;
}

/**
 * The account's history from every device's own record: counts add up, a
 * sense's familiarity is the one answered most recently (the higher on the
 * same day), and the goal is the one chosen last.
 */
export function mergeLearningRecords(
  records: readonly LearningRecord[],
): LearningRecord {
  return combineRecords(records, (a, b) => a + b);
}

/**
 * Folds in a copy that may already be counted (a restored backup): taking the
 * larger count instead of the sum means restoring twice adds nothing.
 */
export function overlayLearningRecord(
  record: LearningRecord,
  copy: LearningRecord,
): LearningRecord {
  return combineRecords([record, copy], Math.max);
}

/**
 * Records an answer in this device's own record. Familiarity moves from the
 * merged level, so answering on a second device does not restart it at zero.
 */
export function recordOwnAnswer(
  own: LearningRecord,
  merged: LearningRecord,
  answer: LearningAnswer,
): LearningRecord {
  return recordAnswer(
    {
      ...own,
      senses: {
        ...own.senses,
        [answer.senseId]: {
          answered: own.senses[answer.senseId]?.answered ?? 0,
          correct: own.senses[answer.senseId]?.correct ?? 0,
          wordKey: answer.wordKey,
          level: merged.senses[answer.senseId]?.level ?? 0,
          lastDay: answer.day,
        },
      },
    },
    answer,
  );
}

/**
 * Keeps a record under the cloud's size limit by dropping the oldest days, then
 * the senses answered longest ago. Totals by question type are kept.
 */
export function trimLearningRecord(
  record: LearningRecord,
  maxBytes: number,
): LearningRecord {
  const size = (value: LearningRecord) => JSON.stringify(value).length;
  if (size(record) <= maxBytes) return record;
  const days = Object.keys(record.days).sort();
  const senses = Object.entries(record.senses).sort((a, b) =>
    a[1].lastDay.localeCompare(b[1].lastDay),
  );
  let result = record;
  while (size(result) > maxBytes && (days.length > 400 || senses.length)) {
    if (days.length > 400) {
      const drop = days.splice(0, days.length - 400);
      const kept = { ...result.days };
      for (const day of drop) delete kept[day];
      result = { ...result, days: kept };
      continue;
    }
    const drop = senses.splice(0, Math.max(1, Math.ceil(senses.length / 10)));
    const kept = { ...result.senses };
    for (const [id] of drop) delete kept[id];
    result = { ...result, senses: kept };
  }
  return result;
}

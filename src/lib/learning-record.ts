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

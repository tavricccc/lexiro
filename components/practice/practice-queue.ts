import type {
  CardProgress,
  GeneratedQuestionKind,
  PracticeCardTask,
  PracticeTask,
  SenseId,
  StudyWord,
  WorkspaceQuestionDifficulty,
} from "@/types";

import type { QuestionItem } from "@/components/practice/practice-content";
import {
  isCardTask,
  PRACTICE_CARD_TASKS,
  PRACTICE_QUESTION_TASKS,
} from "@/constants";
import { isDue, isLeech } from "@/src/lib/fsrs";

/**
 * One thing on screen at a time. A session is a list of these, mixed from every
 * task the setup screen was told to include, so 每日複習 and 詞彙題 arrive
 * shuffled together rather than as two separate sessions.
 */
export type PracticeEntry =
  | { id: string; kind: "card"; task: PracticeCardTask; word: StudyWord }
  | {
      id: string;
      kind: "question";
      task: GeneratedQuestionKind;
      item: QuestionItem;
    };

export function cardEntryId(task: PracticeCardTask, senseId: SenseId): string {
  return `card:${task}:${senseId}`;
}

/** The inverse of `cardEntryId`, for rebuilding an interrupted session. */
export function parseCardEntryId(
  id: string,
): { task: PracticeCardTask; senseId: string } | null {
  const [prefix, task, ...rest] = id.split(":");
  if (prefix !== "card" || !rest.length) return null;
  if (task !== "flashcard" && task !== "spelling") return null;
  return { task, senseId: rest.join(":") };
}

/**
 * Rebuilds a saved queue from its ids. Anything the library no longer contains
 * invalidates the whole session: half a restored session is worse than none.
 */
export function entriesFromIds(
  ids: readonly string[],
  tasks: readonly PracticeTask[],
  studyItems: readonly StudyWord[],
  questionItems: readonly QuestionItem[],
): PracticeEntry[] | null {
  const wordsById = new Map(studyItems.map((word) => [String(word.id), word]));
  const questionsById = new Map(questionItems.map((item) => [item.id, item]));
  const entries: PracticeEntry[] = [];
  for (const id of ids) {
    const card = parseCardEntryId(id);
    if (card) {
      const word = wordsById.get(card.senseId);
      if (!word || !tasks.includes(card.task)) return null;
      entries.push({ id, kind: "card", task: card.task, word });
      continue;
    }
    const item = questionsById.get(id);
    if (!item || !tasks.includes(item.type)) return null;
    entries.push({ id, kind: "question", task: item.type, item });
  }
  return entries;
}

export function shuffleSession<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

export interface QueueInput {
  allowedSenseIds: Set<SenseId>;
  amount: number;
  cards: Record<SenseId, CardProgress>;
  difficulty: WorkspaceQuestionDifficulty;
  leechOnly: boolean;
  questionGroups: QuestionItem[][];
  studyItems: StudyWord[];
  tasks: readonly PracticeTask[];
}

type PoolInput = Pick<QueueInput, "cards" | "leechOnly" | "studyItems">;
type GroupInput = Pick<
  QueueInput,
  "allowedSenseIds" | "difficulty" | "questionGroups"
>;

/**
 * Cards are the scheduled pool: what FSRS says is due, in the order it is due,
 * topped up with words that have never been seen. How a card is asked —
 * 單字卡 or 拼字 — changes the screen, not which words come up, so both card
 * tasks draw from this one pool.
 */
function cardPool({ cards, leechOnly, studyItems }: PoolInput): StudyWord[] {
  const pool = leechOnly
    ? studyItems.filter((item) => isLeech(cards[item.id] ?? null))
    : studyItems;
  const due = pool
    .filter((item) => cards[item.id] && isDue(cards[item.id]))
    .sort(
      (a, b) =>
        new Date(cards[a.id].due).getTime() -
        new Date(cards[b.id].due).getTime(),
    );
  const fresh = pool.filter((item) => !cards[item.id]);
  return [...due, ...fresh];
}

/**
 * Questions stay grouped: a 閱讀測驗 passage carries several items that only
 * make sense next to each other, so a group is the unit that gets drawn, and
 * its items stay contiguous once the queue is shuffled.
 */
function questionPool(
  task: GeneratedQuestionKind,
  { allowedSenseIds, difficulty, questionGroups }: GroupInput,
): QuestionItem[][] {
  const groups = questionGroups
    .map((group) => group.filter((item) => allowedSenseIds.has(item.senseId)))
    .filter(
      (group) =>
        group.length > 0 &&
        group[0]?.type === task &&
        (difficulty === "all" || group[0]?.difficulty === Number(difficulty)),
    );
  // Easy, medium and hard alternate so a short session is not all one level.
  const buckets = [1, 2, 3].map((level) =>
    shuffleSession(groups.filter((group) => group[0]?.difficulty === level)),
  );
  const ordered: QuestionItem[][] = [];
  while (buckets.some((bucket) => bucket.length)) {
    for (const bucket of buckets) {
      const group = bucket.shift();
      if (group) ordered.push(group);
    }
  }
  return ordered;
}

/** How much each task could contribute on its own, for the setup screen. */
export function countTaskAvailability(
  input: PoolInput & GroupInput,
): Record<PracticeTask, number> {
  const counts = {} as Record<PracticeTask, number>;
  const scheduled = cardPool(input).length;
  for (const task of PRACTICE_CARD_TASKS) counts[task] = scheduled;
  for (const task of PRACTICE_QUESTION_TASKS)
    counts[task] = questionPool(task, input).reduce(
      (total, group) => total + group.length,
      0,
    );
  return counts;
}

/**
 * Fills the session one unit at a time, round-robin across the chosen tasks, so
 * every task gets a share of a short session and a task that runs dry hands its
 * slots to the others instead of leaving the session short.
 *
 * A sense is claimed once per session whichever task took it: meeting the same
 * word as a card and again as a question inside ten items reads as a bug.
 */
export function buildPracticeQueue(input: QueueInput): PracticeEntry[] {
  const { amount, tasks } = input;
  // Both card tasks share one cursor position into one pool, so 隨機混合 asks
  // each due word once and only varies how it is asked.
  const scheduled = tasks.some(isCardTask) ? cardPool(input) : [];
  const cardCursors = new Map<
    PracticeCardTask,
    { pool: StudyWord[]; at: number }
  >();
  const questionCursors = new Map<
    GeneratedQuestionKind,
    { pool: QuestionItem[][]; at: number }
  >();
  for (const task of tasks) {
    if (isCardTask(task))
      cardCursors.set(task, { pool: scheduled, at: 0 });
    else questionCursors.set(task, { pool: questionPool(task, input), at: 0 });
  }

  const usedSenses = new Set<SenseId>();
  const units: PracticeEntry[][] = [];
  let taken = 0;

  const nextUnit = (task: PracticeTask): PracticeEntry[] | null => {
    if (isCardTask(task)) {
      const cursor = cardCursors.get(task);
      if (!cursor) return null;
      while (cursor.at < cursor.pool.length) {
        const word = cursor.pool[cursor.at];
        cursor.at += 1;
        if (usedSenses.has(word.id)) continue;
        usedSenses.add(word.id);
        return [{ id: cardEntryId(task, word.id), kind: "card", task, word }];
      }
      return null;
    }
    const cursor = questionCursors.get(task);
    if (!cursor) return null;
    while (cursor.at < cursor.pool.length) {
      const group = cursor.pool[cursor.at];
      cursor.at += 1;
      if (group.some((item) => usedSenses.has(item.senseId))) continue;
      group.forEach((item) => usedSenses.add(item.senseId));
      return group.map(
        (item): PracticeEntry => ({
          id: item.id,
          kind: "question",
          task,
          item,
        }),
      );
    }
    return null;
  };

  let advanced = true;
  while (taken < amount && advanced) {
    advanced = false;
    for (const task of tasks) {
      if (taken >= amount) break;
      const unit = nextUnit(task);
      if (!unit) continue;
      units.push(unit);
      taken += unit.length;
      advanced = true;
    }
  }

  return shuffleSession(units).flat();
}

export function buildWrongContent(
  wrong: number[],
  entries: readonly PracticeEntry[],
  answerChoices: ReadonlyArray<number | null> = [],
): string {
  if (!wrong.length) return "";
  return JSON.stringify(
    {
      items: wrong.map((value) => {
        const entry = entries[value];
        if (!entry) return { type: "unknown" };
        if (entry.kind === "card") {
          const { word } = entry;
          return {
            type: "review",
            word: word.word,
            pos: word.pos,
            meaning: word.meaning,
            example: word.example ?? "",
          };
        }
        const { item } = entry;
        const chosenIndex = answerChoices[value];
        const userAnswer =
          chosenIndex === null || chosenIndex === undefined
            ? "跳過，未作答"
            : (item.options[chosenIndex] ?? "未保存的選項");
        return {
          type: "question",
          questionType: item.type,
          difficulty: item.difficulty,
          prompt: item.prompt,
          options: item.options,
          userAnswer,
          correctAnswer: item.options[item.answerIndex] ?? "",
          meaning: item.meaning,
          ...(item.question.kind === "reading"
            ? { passage: item.question.passage }
            : {}),
        };
      }),
    },
    null,
    2,
  );
}

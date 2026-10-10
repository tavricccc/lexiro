import type {
  CardProgress,
  PracticeQuestionTask,
  PracticeTask,
  SenseId,
  StudyWord,
  WordKey,
  WorkspaceQuestionDifficulty,
} from "@/types";

import type { QuestionItem } from "@/components/practice/practice-content";
import { PRACTICE_QUESTION_TASKS } from "@/constants";
import { buildMeaningQuestionGroups } from "./meaning-questions";

/**
 * One thing on screen at a time. A session is a list of these, mixed from every
 * task the setup screen was told to include, so 每日複習 and 詞彙題 arrive
 * shuffled together rather than as two separate sessions.
 */
export type PracticeEntry = {
  id: string;
  kind: "question";
  task: PracticeQuestionTask;
  item: QuestionItem;
};

/**
 * Rebuilds a saved queue from its ids. Anything the library no longer contains
 * invalidates the whole session: half a restored session is worse than none.
 */
export function entriesFromIds(
  ids: readonly string[],
  tasks: readonly PracticeTask[],
  studyItems: readonly StudyWord[],
  questionItems: readonly QuestionItem[],
  meaningChoices: Record<
    string,
    { options: string[]; answerIndex: number }
  > = {},
): PracticeEntry[] | null {
  const questionsById = new Map(questionItems.map((item) => [item.id, item]));
  const studyById = new Map<string, StudyWord>(
    studyItems.map((word) => [word.id, word]),
  );
  const entries: PracticeEntry[] = [];
  for (const id of ids) {
    const choices = meaningChoices[id];
    let item = questionsById.get(id);
    if (id.startsWith("meaning:")) {
      const word = studyById.get(id.slice("meaning:".length));
      if (!word || !choices) return null;
      const acceptedMeanings = [
        ...new Set(
          studyItems
            .filter((entry) => entry.wordKey === word.wordKey)
            .map((entry) => entry.meaning.trim()),
        ),
      ];
      item = {
        id,
        question: null,
        prompt: word.word,
        wordKey: word.wordKey,
        senseId: word.id,
        type: "meaning",
        difficulty: 1,
        meaning: acceptedMeanings.join("；"),
        acceptedMeanings,
        ...choices,
      };
    }
    if (!item || !tasks.includes(item.type)) return null;
    entries.push({
      id,
      kind: "question",
      task: item.type,
      item: choices
        ? {
            ...item,
            ...choices,
            ...(item.optionBank ? { optionBank: choices.options } : {}),
          }
        : item,
    });
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
  oneSensePerWord: boolean;
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
 * Questions stay grouped: a 閱讀測驗 passage carries several items that
 * share context. Items from one passage stay contiguous when drawn.
 */
function questionPool(
  task: PracticeQuestionTask,
  { allowedSenseIds, difficulty, questionGroups }: GroupInput,
): QuestionItem[][] {
  const groups = questionGroups
    .map((group) => group.filter((item) => allowedSenseIds.has(item.senseId)))
    .filter(
      (group) =>
        group.length > 0 &&
        group[0]?.type === task &&
        (task === "meaning" ||
          difficulty === "all" ||
          group[0]?.difficulty === Number(difficulty)),
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
  const groups = withMeaningQuestions(input);
  for (const task of PRACTICE_QUESTION_TASKS)
    counts[task] =
      task === "meaning"
        ? new Set(
            questionPool(task, groups)
              .flat()
              .map((item) => item.wordKey),
          ).size
        : questionPool(task, groups).reduce(
            (total, group) => total + group.length,
            0,
          );
  return counts;
}

/** The slider counts the questions the current choice can actually draw. */
export function countQuestionAvailability(
  input: GroupInput & PoolInput & Pick<QueueInput, "oneSensePerWord" | "tasks">,
): number {
  const groups = withMeaningQuestions(input);
  const items = input.tasks.flatMap((task) =>
    questionPool(task, groups).flat(),
  );
  if (input.oneSensePerWord)
    return new Set(items.map((item) => item.wordKey)).size;
  return (
    items.filter((item) => item.type !== "meaning").length +
    new Set(
      items
        .filter((item) => item.type === "meaning")
        .map((item) => item.wordKey),
    ).size
  );
}

function withMeaningQuestions<
  T extends GroupInput & { studyItems: StudyWord[] },
>(input: T): T {
  return input.questionGroups.some((group) => group[0]?.type === "meaning")
    ? input
    : {
        ...input,
        questionGroups: [
          ...buildMeaningQuestionGroups(input.studyItems),
          ...input.questionGroups,
        ],
      };
}

/**
 * Fills the session one unit at a time, round-robin across the chosen tasks, so
 * every task gets a share of a short session and a task that runs dry hands its
 * slots to the others instead of leaving the session short.
 *
 * Card practice sees each sense once. Question practice can include different
 * saved questions for the same sense, so its full bank stays available.
 */
export function buildPracticeQueue(input: QueueInput): PracticeEntry[] {
  const { amount, oneSensePerWord, tasks } = input;
  const questionCursors = new Map<
    PracticeQuestionTask,
    { pool: QuestionItem[][]; at: number }
  >();
  for (const task of tasks) {
    questionCursors.set(task, {
      pool: questionPool(task, withMeaningQuestions(input)),
      at: 0,
    });
  }

  const usedWords = new Set<WordKey>();
  const units: PracticeEntry[][] = [];
  let taken = 0;

  const nextUnit = (task: PracticeTask): PracticeEntry[] | null => {
    const cursor = questionCursors.get(task);
    if (!cursor) return null;
    while (cursor.at < cursor.pool.length) {
      const group = cursor.pool[cursor.at];
      cursor.at += 1;
      const withinGroup = new Set<WordKey>();
      const eligible =
        oneSensePerWord || task === "meaning"
          ? group.filter((item) => {
              if (usedWords.has(item.wordKey) || withinGroup.has(item.wordKey))
                return false;
              withinGroup.add(item.wordKey);
              return true;
            })
          : group;
      if (!eligible.length) continue;
      if (oneSensePerWord || task === "meaning")
        eligible.forEach((item) => usedWords.add(item.wordKey));
      return eligible.map((item): PracticeEntry => ({
        id: item.id,
        kind: "question",
        task,
        item,
      }));
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
      const remaining = unit.slice(0, amount - taken);
      units.push(remaining);
      taken += remaining.length;
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
          ...(item.question?.kind === "reading"
            ? { passage: item.question.passage }
            : {}),
        };
      }),
    },
    null,
    2,
  );
}

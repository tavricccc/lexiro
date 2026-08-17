import type { LibraryQuestion, StudyWord, WordEntry, WorkspacePracticeMode, WorkspaceQuestionDifficulty, WorkspaceQuestionType } from "@/types";

import { allocateDailyQuestionQuotas } from "@/src/lib/question-distribution";

export interface QuestionItem {
  id: string;
  question: LibraryQuestion;
  prompt: string;
  options: string[];
  answerIndex: number;
  senseId: string;
  type: "standard" | "fillBlank" | "reading";
  difficulty: 1 | 2 | 3;
  meaning: string;
}

export function buildQuestionGroups(questions: LibraryQuestion[], words: Record<string, WordEntry>): QuestionItem[][] {
  return questions.map((question): QuestionItem[] => {
    if (question.kind === "reading") {
      return question.questions.map((child) => ({
        id: `reading:${question.id}:${child.id}`,
        question,
        prompt: child.prompt,
        options: child.options,
        answerIndex: child.answerIndex,
        senseId: child.senseId,
        type: "reading",
        difficulty: question.difficulty,
        meaning: findMeaning(words, child.senseId),
      }));
    }
    return [{
      id: `question:${question.id}`,
      question,
      prompt: question.prompt,
      options: question.options,
      answerIndex: question.answerIndex,
      senseId: question.senseId,
      type: question.questionStyle,
      difficulty: question.difficulty,
      meaning: findMeaning(words, question.senseId),
    }];
  });
}

export function selectQuestionItems(
  allQuestionGroups: QuestionItem[][],
  allowedSenseIds: Set<string>,
  amount: number,
  questionType: WorkspaceQuestionType,
  difficulty: WorkspaceQuestionDifficulty,
): QuestionItem[] {
  const groups = allQuestionGroups
    .map((group) => group.filter((item) => allowedSenseIds.has(item.senseId)))
    .filter((group) => group.length > 0
      && (questionType === "all" || group[0]?.type === questionType)
      && (difficulty === "all" || group[0]?.difficulty === Number(difficulty)));
  const buckets = [1, 2, 3].map((level) => groups.filter((group) => group[0]?.difficulty === level));
  const orderedGroups: QuestionItem[][] = [];
  while (buckets.some((bucket) => bucket.length)) {
    for (const bucket of buckets) {
      const group = bucket.shift();
      if (group) orderedGroups.push(group);
    }
  }

  const result: QuestionItem[] = [];
  const usedSenses = new Set<string>();
  const usedGroups = new Set<QuestionItem[]>();
  const take = (group: QuestionItem[], target = amount) => {
    if (usedGroups.has(group) || result.length >= target) return false;
    usedGroups.add(group);
    result.push(...group);
    group.forEach((item) => usedSenses.add(item.senseId));
    return true;
  };
  const takeGroups = (candidates: QuestionItem[][], target: number) => {
    const end = result.length + target;
    for (const group of candidates) {
      if (!group.some((item) => usedSenses.has(item.senseId))) take(group, end);
      if (result.length >= end) break;
    }
    for (const group of candidates) {
      if (result.length >= end) break;
      take(group, end);
    }
  };

  if (questionType === "all") {
    const [standard, fillBlank, reading] = allocateDailyQuestionQuotas(amount);
    takeGroups(orderedGroups.filter((group) => group[0]?.type === "standard"), standard);
    takeGroups(orderedGroups.filter((group) => group[0]?.type === "fillBlank"), fillBlank);
    takeGroups(orderedGroups.filter((group) => group[0]?.type === "reading"), reading);
    if (result.length < amount) takeGroups(orderedGroups, amount - result.length);
  } else {
    takeGroups(orderedGroups, amount);
  }
  return result;
}

export function buildWrongContent(
  mode: WorkspacePracticeMode,
  wrong: number[],
  activeReviews: StudyWord[],
  activeQuestions: QuestionItem[],
): string {
  if (!wrong.length) return "";
  return JSON.stringify({
    items: wrong.map((value) => {
      if (mode === "review") {
        const item = activeReviews[value];
        return { type: "review", word: item?.word ?? "", pos: item?.pos ?? "", meaning: item?.meaning ?? "", example: item?.example ?? "" };
      }
      const item = activeQuestions[value];
      return {
        type: "question",
        questionType: item?.type ?? "standard",
        difficulty: item?.difficulty ?? 2,
        prompt: item?.prompt ?? "",
        options: item?.options ?? [],
        userAnswer: "答錯或跳過，未保存選項",
        correctAnswer: item?.options[item.answerIndex] ?? "",
        meaning: item?.meaning ?? "",
        ...(item?.question.kind === "reading" ? { passage: item.question.passage } : {}),
      };
    }),
  }, null, 2);
}

function findMeaning(words: Record<string, WordEntry>, senseId: string) {
  return Object.values(words).flatMap((word) => word.senses).find((sense) => sense.id === senseId)?.meaningZh ?? "";
}

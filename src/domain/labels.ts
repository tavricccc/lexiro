import type { PracticeTask, QuestionKind } from "@lexiro/contract";

export const KIND_LABELS: Record<QuestionKind, string> = {
  vocabulary: "詞彙題",
  cloze: "綜合測驗",
  wordBank: "文意選填",
  discourse: "篇章結構",
  reading: "閱讀測驗",
};

export const TASK_LABELS: Record<PracticeTask, string> = {
  meaning: "看單字選意思",
  reverse: "看意思選單字",
  ...KIND_LABELS,
};

export const TASK_HINTS: Record<PracticeTask, string> = {
  meaning: "從四個中文意思選出正確的一個",
  reverse: "從四個英文單字選出符合意思的一個",
  vocabulary: "一句一格，四選一",
  cloze: "一篇短文數格，每格四選一",
  wordBank: "一篇短文十格，共用十個選項",
  discourse: "一篇短文四格，五個句子選四",
  reading: "讀一篇文章，回答理解題",
};

export const FAMILIARITY_LABELS = ["新單字", "見過", "熟悉", "精熟"] as const;

import type {
  GeneratedQuestionKind,
  LibraryQuestion,
  QuestionDifficulty,
  WordEntry,
} from "@/types";
import type { AiTaskStep } from "@/src/types/ai";
import type { GenerationInput } from "@lexiro/ai-contract";
import { isRecord } from "../schema";
import { assembleGeneratedQuestions } from "../question-assembly";
import {
  generatedQuestionItemIssue,
  generatedQuestionQualityIssue,
  sharedQuestionBankIssue,
} from "../question-quality";
import { extractJsonText } from "./json";
import { discourseStructureIssue } from "../question-discourse";
import { sourceWordFormIssue } from "../question-word-forms";

/** Keep the article and good children; every replacement request produces one child. */
export function passageRepairs({
  text,
  kind,
  difficulty,
  words,
  input,
  parentId,
  parse,
}: {
  text: string;
  kind: GeneratedQuestionKind;
  difficulty: QuestionDifficulty;
  words: WordEntry[];
  input: GenerationInput;
  parentId: string;
  parse: (text: string) => LibraryQuestion[];
}) {
  const draft: unknown = JSON.parse(extractJsonText(text));
  const field =
    kind === "cloze" || kind === "wordBank"
      ? "blanks"
      : kind === "discourse"
        ? "removals"
        : "items";
  if (
    !isRecord(draft) ||
    typeof draft.passage !== "string" ||
    !draft.passage.trim() ||
    !Array.isArray(draft[field]) ||
    !draft[field].length
  )
    return null;
  if (sharedQuestionBankIssue(draft, kind)) return null;
  if (kind === "discourse" && discourseStructureIssue(draft)) return null;
  const items = draft[field] as unknown[];
  if (kind === "wordBank") {
    const sources = words.flatMap((word) =>
      word.senses.map((sense) => ({ word: word.word, pos: sense.pos })),
    );
    if (
      items.some(
        (item, index) =>
          isRecord(item) &&
          typeof item.answer === "string" &&
          sources[index] &&
          sourceWordFormIssue(
            sources[index].word,
            sources[index].pos,
            item.answer,
          ),
      )
    )
      return null; // A new answer also needs new prose and a new shared bank.
  }
  const issue = (index: number) => {
    const value = items[index];
    const quality = generatedQuestionItemIssue(draft, kind, difficulty, index);
    if (quality) return quality;
    if (!isRecord(value)) return "子題資料不完整";
    if (kind === "reading") {
      return (
        assembleGeneratedQuestions(
          { ...draft, items: [value] },
          kind,
          difficulty,
          words,
        ).dropped[0] ?? null
      );
    }
    const answer = kind === "discourse" ? value.sentence : value.answer;
    if (
      typeof answer !== "string" ||
      !answer.trim() ||
      (draft.passage as string).split(answer).length !== 2
    )
      return "答案必須在既有文章中恰好出現一次";
    if (
      items
        .slice(0, index)
        .some(
          (item) =>
            isRecord(item) &&
            (kind === "discourse" ? item.sentence : item.answer) === answer,
        )
    )
      return "子題答案重複";
    if (
      kind === "cloze" &&
      (!Array.isArray(value.distractors) ||
        value.distractors.length !== 3 ||
        new Set(
          [answer, ...value.distractors].map((entry) =>
            String(entry).toLowerCase(),
          ),
        ).size !== 4)
    )
      return "干擾選項不足或重複";
    return null;
  };
  let bad = items.map((_, index) => index).filter((index) => issue(index));
  const groupIssue = generatedQuestionQualityIssue(draft, kind, difficulty);
  if (groupIssue?.startsWith("文章")) return null;
  if (!bad.length && kind === "reading" && groupIssue) {
    const index = groupIssue.includes("mainIdea")
      ? 0
      : items.findIndex((item) => isRecord(item) && item.skill !== "mainIdea");
    bad = [index >= 0 ? index : items.length - 1];
  }
  if (!bad.length) return null;
  const remaining = bad.map((index, position): AiTaskStep<LibraryQuestion> => {
    const payload = () =>
      JSON.stringify({
        ...input,
        itemRepair: {
          index,
          passage: draft.passage,
          items: items.map((item) => {
            if (!isRecord(item)) return item;
            const {
              explanation: _explanation,
              whyWrong: _whyWrong,
              ...content
            } = item;
            return content;
          }),
          ...(kind === "wordBank" || kind === "discourse"
            ? {
                extraOptions: (draft.options as string[]).filter(
                  (option) =>
                    !items.some(
                      (item) =>
                        isRecord(item) &&
                        (kind === "discourse" ? item.sentence : item.answer) ===
                          option,
                    ),
                ),
              }
            : {}),
        },
      });
    return {
      id: `${parentId}:item:${index}`,
      get context() {
        return payload();
      },
      get prompt() {
        return payload();
      },
      count: position === bad.length - 1 ? 1 : 0,
      get stagedQuestions() {
        return items.filter((_, at) => !issue(at)).length;
      },
      parse: (response) => {
        const value: unknown = JSON.parse(extractJsonText(response));
        if (
          !isRecord(value) ||
          !Array.isArray(value.items) ||
          value.items.length !== 1
        )
          throw new Error("重新生成必須只回傳一個子題");
        const previous = items[index];
        items[index] = value.items[0];
        const error = issue(index);
        if (error) {
          items[index] = previous;
          throw new Error(`第 ${index + 1} 題：${error}`);
        }
        return position === bad.length - 1 ? parse(JSON.stringify(draft)) : [];
      },
    };
  });
  return { items: [] as LibraryQuestion[], completed: 0, remaining };
}

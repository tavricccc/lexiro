import type { ReadingPack, PassageFormat, WordEntry, WordKey } from "@/types";
import { t } from "@/lib/i18n";
import { parseSenseKey, senseKey } from "@/src/lib/library";
import { randomUUID } from "@/src/lib/id";
import type { ReadingChildDraft } from "./reading-child-editor";

export interface ReadingFormDraft {
  title: string;
  passage: string;
  difficulty: 1 | 2 | 3;
  format: PassageFormat;
  optionBank?: string[];
  explanation?: string;
  children: ReadingChildDraft[];
}

export const emptyReadingChild = (): ReadingChildDraft => ({
  answerIndex: 0,
  options: ["", "", "", ""],
  prompt: "",
  source: "",
});

export function readingFormFromPack(pack?: ReadingPack): ReadingFormDraft {
  return pack
    ? {
        title: pack.title,
        passage: pack.passage,
        difficulty: pack.difficulty,
        format: pack.format,
        optionBank: pack.optionBank ? [...pack.optionBank] : undefined,
        explanation: pack.explanation,
        children: pack.questions.map((child) => ({
          id: child.id,
          blank: child.blank,
          answerIndex: child.answerIndex,
          options: [...child.options],
          prompt: child.prompt,
          source: senseKey(child.wordKey, child.senseId),
          explanation: child.explanation,
          whyWrong: child.whyWrong,
        })),
      }
    : {
        title: "",
        passage: "",
        difficulty: 2,
        format: "reading",
        children: [
          emptyReadingChild(),
          emptyReadingChild(),
          emptyReadingChild(),
        ],
      };
}

/** Old editor drafts omitted the original passage format and shared bank. */
export function migrateReadingFormDraft(
  draft:
    | ReadingFormDraft
    | Omit<ReadingFormDraft, "format" | "optionBank" | "explanation">,
  initial: ReadingFormDraft,
): ReadingFormDraft {
  if ("format" in draft) return draft;
  return {
    ...draft,
    format: initial.format,
    optionBank: initial.optionBank,
    explanation: initial.explanation,
    children: draft.children.map((child) => {
      const original = initial.children.find((entry) => entry.id === child.id);
      return original
        ? {
            ...child,
            blank: original.blank,
            explanation: original.explanation,
            whyWrong: original.whyWrong,
          }
        : child;
    }),
  };
}

export function readingPackFromForm(
  draft: ReadingFormDraft,
  words: Record<WordKey, WordEntry>,
  current?: ReadingPack,
): ReadingPack {
  const timestamp = new Date().toISOString();
  const bank = draft.optionBank?.map((option) => option.trim());
  const questions = draft.children.map((child) => {
    const source = parseSenseKey(child.source, words);
    if (!source) throw new Error(t("questions.unknownSense"));
    return {
      id: child.id ?? randomUUID(),
      kind: "multipleChoice" as const,
      ...(draft.format === "reading" ? {} : { blank: child.blank }),
      prompt: child.prompt.trim(),
      options: bank ?? child.options.map((option) => option.trim()),
      answerIndex: child.answerIndex,
      wordKey: source.wordKey,
      senseId: source.senseId,
      explanation: child.explanation?.trim() || undefined,
      whyWrong: child.whyWrong,
    };
  });
  return {
    id: current?.id ?? randomUUID(),
    fingerprint: current?.fingerprint ?? "pending",
    kind: "reading",
    format: draft.format,
    title: draft.title.trim(),
    passage: draft.passage.trim(),
    difficulty: draft.difficulty,
    ...(bank ? { optionBank: bank } : {}),
    explanation: draft.explanation?.trim() || undefined,
    questions,
    wordKeys: [...new Set(questions.map((child) => child.wordKey))],
    createdAt: current?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}

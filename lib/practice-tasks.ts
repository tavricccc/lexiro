import type { PracticeCardTask, PracticeTask } from "@/types";

import { isCardTask } from "@/constants";
import { t, type TranslationKey } from "@/lib/i18n";
import {
  questionFormatHint,
  questionFormatLabel,
} from "@/lib/question-options";

/**
 * The card tasks read the same way the question formats do, so the setup
 * screen, the session header and the result screen can name any task through
 * one pair of functions without knowing which half it came from.
 */
const CARD_TASK_KEYS = {
  flashcard: ["practice.taskFlashcard", "practice.taskFlashcardHint"],
  spelling: ["practice.taskSpelling", "practice.taskSpellingHint"],
} as const satisfies Record<
  PracticeCardTask,
  readonly [TranslationKey, TranslationKey]
>;

export function practiceTaskLabel(task: PracticeTask): string {
  return isCardTask(task)
    ? t(CARD_TASK_KEYS[task][0])
    : questionFormatLabel(task);
}

export function practiceTaskHint(task: PracticeTask): string {
  return isCardTask(task)
    ? t(CARD_TASK_KEYS[task][1])
    : questionFormatHint(task);
}

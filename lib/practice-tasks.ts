import type { PracticeTask } from "@/types";

import { t } from "@/lib/i18n";
import {
  questionFormatHint,
  questionFormatLabel,
} from "@/lib/question-options";

/**
 * The card tasks read the same way the question formats do, so the setup
 * screen, the session header and the result screen can name any task through
 * one pair of functions without knowing which half it came from.
 */
export function practiceTaskLabel(task: PracticeTask): string {
  if (task === "meaning") return t("practice.taskMeaning");
  return questionFormatLabel(task);
}

export function practiceTaskHint(task: PracticeTask): string {
  if (task === "meaning") return t("practice.taskMeaningHint");
  return questionFormatHint(task);
}

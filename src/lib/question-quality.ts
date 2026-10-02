import { countEnglishWords, questionLengthRange } from "@lexiro/ai-contract";
import type { GeneratedQuestionKind, QuestionDifficulty } from "@/types";
import { isPassageKind } from "./question-formats";
import { isRecord } from "./schema";

/** Validate newly generated prose; existing saved and manually authored work stays editable. */
export function generatedQuestionLengthIssue(
  value: unknown,
  kind: GeneratedQuestionKind,
  difficulty: QuestionDifficulty,
): string | null {
  if (!isRecord(value)) return null; // Assembly reports malformed replies.
  const range = questionLengthRange(kind, difficulty);
  const check = (prose: unknown, label: string) => {
    if (typeof prose !== "string") return null;
    const count = countEnglishWords(prose);
    return count < range.min || count > range.max
      ? `${label}長度為 ${count} 個英文單字，這個題型與難度需要 ${range.min}–${range.max} 字；請重寫完整語境，不要填充重複句子`
      : null;
  };
  if (isPassageKind(kind)) return check(value.passage, "文章");
  if (!Array.isArray(value.items)) return null;
  for (const [index, item] of value.items.entries()) {
    if (!isRecord(item)) continue;
    const issue = check(item.sentence, `第 ${index + 1} 題`);
    if (issue) return issue;
  }
  return null;
}

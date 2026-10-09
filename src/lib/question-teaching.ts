import { isRecord } from "./schema";
import { containsHan } from "./validation";

/** Model explanations name the actual option; display shuffling is independent. */
export function optionTeachingIssue(
  item: Record<string, unknown>,
  distractors: string[],
): string | null {
  if (typeof item.explanation !== "string" || !item.explanation.trim())
    return "缺少作答解說";
  if (!containsHan(item.explanation)) return "作答解說必須以中文說明";
  if (
    !Array.isArray(item.whyWrong) ||
    item.whyWrong.length !== distractors.length
  )
    return `必須逐一說明 ${distractors.length} 個干擾選項為何不成立`;
  const expected = new Set(distractors);
  const explained = new Set<string>();
  for (const reason of item.whyWrong) {
    if (
      !isRecord(reason) ||
      typeof reason.option !== "string" ||
      typeof reason.reason !== "string" ||
      !reason.reason.trim()
    )
      return "錯項解說必須包含實際選項 option 與理由 reason";
    const option = reason.option.trim();
    if (!containsHan(reason.reason))
      return `錯項「${option}」必須以中文說明理由`;
    if (!expected.has(option))
      return `錯項解說引用了不屬於本題干擾選項的「${option}」`;
    if (explained.has(option)) return `錯項「${option}」的解說重複`;
    explained.add(option);
  }
  return null;
}

export function assembleOptionTeaching(
  item: Record<string, unknown> | undefined,
  distractors: string[],
): { explanation?: string; whyWrong?: Record<string, string> } {
  // Assembly can also build bare structural fixtures; generated admission checks teaching.
  if (!item || (item.explanation === undefined && item.whyWrong === undefined))
    return {};
  const issue = optionTeachingIssue(item, distractors);
  if (issue) throw new Error(issue);
  return {
    explanation: (item.explanation as string).trim(),
    whyWrong: Object.fromEntries(
      (item.whyWrong as Array<{ option: string; reason: string }>).map(
        ({ option, reason }) => [option.trim(), reason.trim()],
      ),
    ),
  };
}

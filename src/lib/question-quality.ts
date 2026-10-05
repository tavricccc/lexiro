import {
  countEnglishWords,
  questionLengthRange,
  READING_SKILLS,
} from "@lexiro/ai-contract";
import type { GeneratedQuestionKind, QuestionDifficulty } from "@/types";
import { isPassageKind } from "./question-formats";
import { isRecord } from "./schema";

/** Validate new prose and reading audits; existing saved and manual work stays editable. */
export function generatedQuestionQualityIssue(
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
  if (isPassageKind(kind)) {
    const lengthIssue = check(value.passage, "文章");
    if (lengthIssue) return lengthIssue;
    const evidenceIssue = kind === "reading" ? readingEvidenceIssue(value, difficulty) : null;
    return evidenceIssue ?? teachingIssue(value, kind);
  }
  if (!Array.isArray(value.items)) return null;
  for (const [index, item] of value.items.entries()) {
    if (!isRecord(item)) continue;
    const issue = check(item.sentence, `第 ${index + 1} 題`);
    if (issue) return issue;
  }
  return teachingIssue(value, kind);
}

function teachingIssue(value: Record<string, unknown>, kind: GeneratedQuestionKind): string | null {
  const items = kind === "discourse" ? value.removals
    : kind === "cloze" || kind === "wordBank" ? value.blanks : value.items;
  if (!Array.isArray(items)) return null;
  const reasons = kind === "wordBank" ? 9 : kind === "discourse" ? 4 : 3;
  for (const [index, item] of items.entries()) {
    if (!isRecord(item) || typeof item.explanation !== "string" || !item.explanation.trim())
      return `第 ${index + 1} 題缺少作答解說`;
    if (!Array.isArray(item.whyWrong) || item.whyWrong.length !== reasons || item.whyWrong.some((reason) => typeof reason !== "string" || !reason.trim()))
      return `第 ${index + 1} 題必須逐一說明 ${reasons} 個干擾選項為何不成立`;
  }
  return null;
}

/** The evidence is a generation audit; it is not persisted as a second question model. */
function readingEvidenceIssue(
  value: Record<string, unknown>,
  difficulty: QuestionDifficulty,
  checkGroup = true,
): string | null {
  if (typeof value.passage !== "string" || !Array.isArray(value.items))
    return null;
  const passage = value.passage;
  const skills = new Set<string>();
  for (const [index, item] of value.items.entries()) {
    if (!isRecord(item)) continue;
    if (
      typeof item.skill !== "string" ||
      !(READING_SKILLS as readonly string[]).includes(item.skill)
    )
      return `閱讀第 ${index + 1} 題缺少有效的閱讀任務 skill`;
    skills.add(item.skill);
    if (
      !Array.isArray(item.evidence) ||
      !item.evidence.length ||
      item.evidence.some(
        (span) =>
          typeof span !== "string" || !span.trim() || !passage.includes(span),
      )
    )
      return `閱讀第 ${index + 1} 題 evidence 必須逐字引用文章的作答依據`;
    if (item.skill !== "inference") continue;
    const spans = [...new Set(item.evidence as string[])];
    const positions = spans
      .map((span) => ({
        at: passage.indexOf(span),
        end: passage.indexOf(span) + span.length,
      }))
      .sort((a, b) => a.at - b.at);
    const independent = positions.some((first, i) =>
      positions
        .slice(i + 1)
        .some(
          (second) =>
            first.end <= second.at &&
            /[.!?](?:\s|$)/.test(passage.slice(first.at, second.at)),
        ),
    );
    if (!independent)
      return `閱讀第 ${index + 1} 題推論需要兩處不同句子的原文依據；不能將原句查找標成 inference`;
  }
  if (!checkGroup) return null;
  if (!skills.has("mainIdea")) return "閱讀測驗至少需要一題全篇主旨題 mainIdea";
  if (skills.size < 2) return "閱讀測驗至少需要兩種不同的閱讀任務";
  if (difficulty >= 2 && !skills.has("inference"))
    return "中等與進階閱讀至少需要一題結合兩處線索的推論題 inference";
  return null;
}

export function generatedQuestionItemIssue(value: Record<string, unknown>, kind: GeneratedQuestionKind, difficulty: QuestionDifficulty, index: number): string | null {
  const field = kind === "cloze" || kind === "wordBank" ? "blanks" : kind === "discourse" ? "removals" : "items";
  const items = value[field];
  if (!Array.isArray(items) || !isRecord(items[index])) return "子題資料不完整";
  const isolated = { ...value, [field]: [items[index]] };
  return (kind === "reading" ? readingEvidenceIssue(isolated, difficulty, false) : null) ?? teachingIssue(isolated, kind);
}

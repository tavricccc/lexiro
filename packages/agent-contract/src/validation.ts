import { z } from "zod";
import type { LibraryQuestion } from "@/types";
import { canonicalHash } from "@/src/lib/hash";
import { isRecord } from "@/src/lib/schema";
import type { AgentQuestionDiagnostic, AgentQuestionReport, AgentQuestionWriteMode, AgentSetSnapshot } from "./public";

export class AgentQuestionError extends Error {
  constructor(public code: string, public field: string, message: string, public sourceId?: string) { super(message); }
}

export function questionSourceIds(question: LibraryQuestion): string[] {
  return question.kind === "reading" ? [...new Set(question.questions.map(q => q.senseId))] : [question.senseId];
}

export function validateQuestionItems(
  snapshot: AgentSetSnapshot,
  items: unknown[],
  mode: AgentQuestionWriteMode,
  requestedSenseIds: string[],
  parse: (value: unknown) => LibraryQuestion[],
  warnings: (value: unknown) => Omit<AgentQuestionDiagnostic, "itemId" | "sourceIndex" | "sourceId" | "sourceWord">[] = () => [],
) {
  const questions: LibraryQuestion[] = [];
  const report: AgentQuestionReport = {
    status: "success", mode, submittedCount: items.length, validCount: 0, savedCount: 0, failedCount: 0,
    errors: [], warnings: [], items: [], requestedSenseIds: [...new Set(requestedSenseIds)], usedSenseIds: [], unusedSenseIds: [],
  };
  const sources = new Map(snapshot.words.flatMap(w => w.senses.map(s => [s.id as string, w.word] as const)));
  if (!items.length || items.length > 200) {
    report.status = "rejected";
    report.errors.push({ itemId: "batch", sourceIndex: 0, severity: "error", code: "invalid_batch_size", field: "items", message: "每次請提交 1–200 個獨立題目或題組。" });
    return { questions, report };
  }
  items.forEach((value, sourceIndex) => {
    const itemId = isRecord(value) && typeof value.itemId === "string" ? value.itemId : `item-${canonicalHash(value ?? null)}`;
    let sourceId = isRecord(value) && typeof value.senseId === "string" ? value.senseId : undefined;
    try {
      const parsed = parse(value);
      const sourceIds = [...new Set(parsed.flatMap(questionSourceIds))];
      sourceId ??= sourceIds[0];
      const context = { itemId, sourceIndex, ...(sourceId ? { sourceId, sourceWord: sources.get(sourceId) } : {}) };
      report.warnings.push(...warnings(value).map(warning => ({ ...context, ...warning })));
      for (const question of parsed) if (snapshot.questions.some(old => old.fingerprint === question.fingerprint)) {
        report.warnings.push({ ...context, severity: "warning", code: "matching_question", field: "content", message: "本集已有完全相同內容的題目，可依使用者要求保留或調整。" });
      }
      questions.push(...parsed);
      report.validCount++;
      report.items.push({ itemId, sourceIds, questionIds: parsed.map(q => q.id), valid: true });
    } catch (reason) {
      sourceId ??= reason instanceof AgentQuestionError ? reason.sourceId : undefined;
      const code = reason instanceof AgentQuestionError ? reason.code : "invalid_question_structure";
      const field = reason instanceof AgentQuestionError ? reason.field
        : reason instanceof z.ZodError ? reason.issues[0]?.path.join(".") || "output" : "output";
      report.errors.push({ itemId, sourceIndex, ...(sourceId ? { sourceId, sourceWord: sources.get(sourceId) } : {}), severity: "error", code, field,
        message: reason instanceof Error ? reason.message : "題目格式錯誤" });
      report.failedCount++;
      report.items.push({ itemId, sourceIds: sourceId ? [sourceId] : [], questionIds: [], valid: false });
    }
  });
  report.usedSenseIds = [...new Set(questions.flatMap(questionSourceIds))];
  report.unusedSenseIds = report.requestedSenseIds.filter(id => !report.usedSenseIds.includes(id));
  report.status = report.failedCount ? report.validCount && mode === "partial" ? "partial_success" : "rejected" : "success";
  return { questions: report.status === "rejected" ? [] : questions, report };
}

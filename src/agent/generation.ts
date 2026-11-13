/**
 * Agent question generation. The Agent writes prose with the answers left in
 * and names each answer span; the legacy contract locates the spans, checks
 * word forms and cuts the blanks. That pipeline is kept as it is, frozen in
 * vendor/lexiro-agent-contract, and this module translates between it and
 * the library's own shapes.
 */
import {
  agentGenerationBrief,
  collectAgentGeneratedQuestions,
  createAgentSet,
  type LegacyQuestion,
  type LegacyReport,
  type LegacySnapshot,
} from "./legacy/generation.js";
import type { QuestionInput, QuestionKind, Difficulty } from "../contract";
import type { SetContent } from "../library/repository";

type Legacy = LegacyQuestion;
export type GenerationReport = LegacyReport;

/** The legacy snapshot of a set: word ids stand in for word keys. */
export function legacySnapshot(content: SetContent): LegacySnapshot {
  const words = content.words.map((word) => ({
    wordKey: word.id,
    word: word.word,
    starred: word.starred,
    updatedAt: word.updatedAt,
    senses: word.senses.map((sense) => ({
      id: sense.id, pos: sense.pos, meaningZh: sense.meaning, examples: sense.examples, supplementary: sense.supplementary,
      ...(sense.description ? { description: sense.description } : {}),
    })),
  }));
  return {
    set: { id: content.set.id, setName: content.set.name, folderId: content.set.folderId ?? "__uncategorized__", createdAt: content.set.createdAt, updatedAt: content.set.updatedAt },
    words: words,
    memberships: words.map((word) => ({ wordKey: word.wordKey, senseIds: word.senses.map((sense) => sense.id) })),
    questions: [],
  };
}

const reasons = (value: Record<string, string> | undefined) => (value && Object.keys(value).length ? value : undefined);

/** A legacy stored question in the library's question format. */
export function fromLegacy(question: Legacy): QuestionInput {
  if (question.kind === "multipleChoice")
    return {
      kind: "vocabulary", difficulty: question.difficulty, prompt: question.prompt, options: question.options,
      answer: question.answerIndex, senseId: question.senseId, explanation: question.explanation, whyWrong: reasons(question.whyWrong),
    };
  const bank = question.optionBank?.length ? question.optionBank : undefined;
  return {
    kind: question.format, difficulty: question.difficulty, title: question.title || undefined, passage: question.passage, bank,
    explanation: question.explanation,
    items: question.questions.map((item) => ({
      ...(item.blank ? { blank: item.blank } : {}),
      ...(question.format === "reading" ? { prompt: item.prompt } : {}),
      ...(bank ? {} : { options: item.options }),
      answer: item.answerIndex, senseId: item.senseId, explanation: item.explanation, whyWrong: reasons(item.whyWrong),
    })),
  };
}

/** Checks generated output; the questions are in library format, ready to save. */
export function assembleGenerated(
  content: SetContent,
  input: { kind: QuestionKind; difficulty: Difficulty; senseIds?: string[]; output: unknown; mode: "atomic" | "partial" },
): { questions: QuestionInput[]; report: GenerationReport } {
  const { questions, report } = collectAgentGeneratedQuestions(legacySnapshot(content), input.kind, input.difficulty, input.senseIds, input.output, input.mode);
  return { questions: questions.map(fromLegacy), report };
}

/** The sources and output schema an Agent generates one batch from. */
export function generationBrief(content: SetContent, kind: QuestionKind, difficulty: Difficulty, senseIds?: string[]) {
  return agentGenerationBrief(legacySnapshot(content), kind, difficulty, senseIds);
}

/** The output schema of a kind, without any set. */
export function outputSchema(kind: QuestionKind, difficulty: Difficulty) {
  return agentGenerationBrief(createAgentSet(crypto.randomUUID(), "format"), kind, difficulty).outputSchema;
}

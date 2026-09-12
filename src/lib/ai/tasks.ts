import type {
  LibraryQuestion,
  WordDraft,
  WordEntry,
  GeneratedQuestionKind,
  QuestionDifficulty,
} from "@/types";
import type { AiTask, AiTaskStep } from "@/src/types/ai";
import {
  parseWordGenerationJson,
  type WordGenerationSource,
} from "../word-generation";
import {
  normalizeQuestionGenerationJson,
  getQuestionSourceRefs,
  splitGenerationBatches,
  generatedQuestionCoverageIssue,
} from "../question-generation";
import { parseLibraryImport } from "../library-import";
import { isPassageKind } from "../question-formats";
import { senseKey } from "../library";
import { extractJsonText } from "./json";
import { t } from "@/lib/i18n";
import { isRecord } from "../schema";

export function chunks<T>(items: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, (i + 1) * size),
  );
}
const wordInput = (sources: WordGenerationSource[]) => JSON.stringify({ kind: "words", raw: sources.map((source) => source.raw).join("\n") });

export function wordTask(
  _raw: string,
  sources: WordGenerationSource[],
  size: number,
): AiTask<WordDraft> {
  const make = (batch: WordGenerationSource[]): AiTaskStep<WordDraft> => ({
    id: batch.map((s) => s.sourceRef).join(","),
    count: batch.length,
    context: wordInput(batch),
    prompt: wordInput(batch),
    parse: (text) => {
      return parseWordGenerationJson(text, batch);
    },
    recover: (text) => {
      const data: unknown = JSON.parse(extractJsonText(text));
      if (!isRecord(data) || !Array.isArray(data.items)) return null;
      const rawItems = data.items;
      const items: WordDraft[] = [],
        remaining: WordGenerationSource[] = [];
      batch.forEach((source, index) => {
        try {
          const item = rawItems[index];
          if (!item) throw new Error();
          const single = { items: [item] };
          items.push(
            ...parseWordGenerationJson(JSON.stringify(single), [source]),
          );
        } catch {
          remaining.push(source);
        }
      });
      return items.length && remaining.length
        ? {
            items,
            completed: batch.length - remaining.length,
            remaining: make(remaining),
          }
        : null;
    },
    ...(batch.length > 1
      ? { split: () => chunks(batch, Math.ceil(batch.length / 2)).map(make) }
      : {}),
  });
  return {
    id: "words",
    kind: "words",
    billableCount: sources.length,
    context: wordInput(sources),
    steps: chunks(sources, size).map(make),
  };
}

export function questionTask(
  words: WordEntry[],
  pool: WordEntry[],
  kind: GeneratedQuestionKind,
  difficulty: QuestionDifficulty,
): AiTask<LibraryQuestion> {
  const globalRefs = new Map(
    words
      .flatMap((w) => w.senses.map((s) => senseKey(w.wordKey, s.id)))
      .map((key, i) => [key, `s${i + 1}`]),
  );
  const input = (batch: WordEntry[]) => JSON.stringify({ kind, difficulty, sources: batch.flatMap((word) => word.senses.map((sense) => ({ ref: globalRefs.get(senseKey(word.wordKey, sense.id))!, word: word.word, pos: sense.pos, meaningZh: sense.meaningZh, ...(sense.examples.length ? { knownExample: sense.examples[0] } : {}) }))) });
  const make = (batch: WordEntry[]): AiTaskStep<LibraryQuestion> => {
    const refs = batch.flatMap((w) =>
      w.senses.map((s) => globalRefs.get(senseKey(w.wordKey, s.id))!),
    );
    const passage = isPassageKind(kind);
    const step: AiTaskStep<LibraryQuestion> = {
      id: refs.join(","),
      count: passage ? 1 : refs.length,
      context: input(batch),
      prompt: input(batch),
      parse: (text) => {
        const data: unknown = JSON.parse(extractJsonText(text));
        const normalized = normalizeQuestionGenerationJson(
          JSON.stringify(data),
          kind,
          difficulty,
          batch,
          pool,
        );
        const parsed = parseLibraryImport(normalized, {
          allowedDifficulty: difficulty,
          expectedQuestionKind: passage ? "reading" : "multipleChoice",
          expectedQuestionStyle: passage ? undefined : kind,
          questionSources: getQuestionSourceRefs(batch),
          requireEnglish: true,
        });
        if (!parsed.valid) throw new Error(parsed.error);
        if (parsed.data.kind !== "questions")
          throw new Error(t("ai.invalidReply"));
        const questions = parsed.data.questions;
        const issue = generatedQuestionCoverageIssue(questions, batch, kind);
        if (issue || (!passage && questions.length !== refs.length))
          throw new Error(issue || t("ai.missingItems"));
        return questions;
      },
      ...(!passage && refs.length > 1
        ? {
            split: () => {
              const units = batch.flatMap((w) =>
                w.senses.map((s) => ({ ...w, senses: [s] })),
              );
              return chunks(units, Math.ceil(units.length / 2)).map(make);
            },
          }
        : {}),
    };
    if (!passage)
      step.recover = (text) => {
        const data: unknown = JSON.parse(extractJsonText(text));
        if (!isRecord(data) || !Array.isArray(data.items)) return null;
        const rawItems = data.items;
        const units = batch.flatMap((w) =>
          w.senses.map((s) => ({ ...w, senses: [s] })),
        );
        const items: LibraryQuestion[] = [],
          remaining: WordEntry[] = [];
        units.forEach((unit, i) => {
          try {
            const item = rawItems[i];
            if (!isRecord(item)) throw new Error();
            items.push(
              ...make([unit]).parse(JSON.stringify({ items: [item] })),
            );
          } catch {
            remaining.push(unit);
          }
        });
        return items.length && remaining.length
          ? {
              items,
              completed: units.length - remaining.length,
              remaining: make(remaining),
            }
          : null;
      };
    return step;
  };
  const batches = splitGenerationBatches(words, kind);
  const context = input(words);
  return {
    id: `questions-${kind}`,
    kind,
    billableCount: kind === "discourse" || kind === "reading" ? batches.length : globalRefs.size,
    context,
    steps: batches.map(make),
    key: (q) => q.fingerprint || q.id,
  };
}

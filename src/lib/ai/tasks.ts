import type {
  LibraryQuestion,
  WordDraft,
  WordEntry,
  GeneratedQuestionKind,
  QuestionDifficulty,
} from "@/types";
import type { AiTask, AiTaskStep } from "@/src/types/ai";
import { buildImportPrompt } from "../importPrompt";
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
import {
  buildQuestionPrompt,
  questionTurnInstruction,
  type QuestionPrompt,
} from "../question-prompts";
import { senseKey } from "../library";
import { extractJsonText } from "./json";
import { wordOutput, questionOutput, jsonSchema } from "./schemas";
import { t } from "@/lib/i18n";
import { isRecord } from "../schema";

export function chunks<T>(items: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, (i + 1) * size),
  );
}
const instruction = (refs: string[]) =>
  `本輪 activeRefs：${JSON.stringify(refs)}。words 恰好 ${refs.length} 筆，每個指定 sourceRef 恰好一次，保持清單順序。只回覆本輪完整 JSON。`;
const questionContext = (prompt: QuestionPrompt) =>
  `${prompt.instructions}\n\n完整來源資料：${prompt.sources}`;

export function wordTask(
  raw: string,
  sources: WordGenerationSource[],
  examples: boolean,
  size: number,
): AiTask<WordDraft> {
  const make = (batch: WordGenerationSource[]): AiTaskStep<WordDraft> => ({
    id: batch.map((s) => s.sourceRef).join(","),
    count: batch.length,
    context: buildImportPrompt(raw, batch, examples),
    prompt: instruction(batch.map((s) => s.sourceRef)),
    parse: (text) => {
      wordOutput.parse(JSON.parse(extractJsonText(text)));
      return parseWordGenerationJson(text, batch, examples);
    },
    recover: (text) => {
      const data: unknown = JSON.parse(extractJsonText(text));
      if (!isRecord(data) || !Array.isArray(data.words)) return null;
      const items: WordDraft[] = [],
        remaining: WordGenerationSource[] = [];
      for (const source of batch) {
        const matches = data.words.filter(
          (w) => isRecord(w) && w.sourceRef === source.sourceRef,
        );
        try {
          if (matches.length !== 1) throw new Error();
          const single = wordOutput.parse({ words: matches });
          items.push(
            ...parseWordGenerationJson(
              JSON.stringify(single),
              [source],
              examples,
            ),
          );
        } catch {
          remaining.push(source);
        }
      }
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
    context: buildImportPrompt(raw, sources, examples),
    schema: jsonSchema(wordOutput),
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
  const schema = questionOutput(kind);
  const make = (batch: WordEntry[]): AiTaskStep<LibraryQuestion> => {
    const refs = batch.flatMap((w) =>
      w.senses.map((s) => globalRefs.get(senseKey(w.wordKey, s.id))!),
    );
    const passage = isPassageKind(kind);
    const mapRefs = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(mapRefs);
      if (!value || typeof value !== "object") return value;
      return Object.fromEntries(
        Object.entries(value).map(([key, v]) => {
          if (key !== "ref") return [key, mapRefs(v)];
          const index = refs.indexOf(String(v));
          if (index < 0) throw new Error(t("ai.unknownSource"));
          return [key, `s${index + 1}`];
        }),
      );
    };
    const step: AiTaskStep<LibraryQuestion> = {
      id: refs.join(","),
      count: passage ? 1 : refs.length,
      context: questionContext(
        buildQuestionPrompt(kind, batch, difficulty, { refs }),
      ),
      prompt: questionTurnInstruction(refs, kind),
      parse: (text) => {
        const data = schema.parse(JSON.parse(extractJsonText(text)));
        const normalized = normalizeQuestionGenerationJson(
          JSON.stringify(mapRefs(data)),
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
          const matches = rawItems.filter(
            (item) => isRecord(item) && item.ref === refs[i],
          );
          try {
            if (matches.length !== 1) throw new Error();
            items.push(
              ...make([unit]).parse(JSON.stringify({ items: matches })),
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
  const context = questionContext(buildQuestionPrompt(kind, words, difficulty));
  return {
    id: `questions-${kind}`,
    context,
    schema: jsonSchema(schema),
    steps: batches.map(make),
    key: (q) => q.fingerprint || q.id,
  };
}

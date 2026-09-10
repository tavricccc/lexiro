"use client";

import type { LibraryQuestion, WordEntry } from "@/types";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AiRunPanel } from "@/components/ai/ai-run-panel";
import { useAiGeneration } from "@/components/ai/use-ai-generation";
import {
  GenerationScopePicker,
  type GenerationSense,
} from "@/components/questions/generation-scope-picker";
import { QuestionPreview } from "@/components/questions/question-preview";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { SelectField } from "@/components/ui/select-field";
import { t } from "@/lib/i18n";
import {
  difficultyOptions,
  questionFormatOptions,
} from "@/lib/question-options";
import { useLibraryStore } from "@/stores/library-store";
import { generateWithSavedAi } from "@/src/lib/ai-provider";
import { parseLibraryImport } from "@/src/lib/library-import";
import {
  buildQuestionGenerationPrompt,
  generationSenseKey,
  getQuestionSourceRefs,
  getSelectedGenerationWords,
  normalizeQuestionGenerationJson,
  splitGenerationBatches,
  type GeneratedQuestionDifficulty,
  type GeneratedQuestionKind,
} from "@/src/lib/question-generation";
import { isPassageKind } from "@/src/lib/question-formats";
import { buildLibraryQuestions } from "@/src/lib/question-builders";

export function QuestionGenerator({ setId }: { setId?: string }) {
  const { state, saveQuestion } = useLibraryStore();
  const [selected, setSelected] = useState<string[]>([]);
  const [scopeReady, setScopeReady] = useState(false);
  const [kind, setKind] = useState<GeneratedQuestionKind>("vocabulary");
  const [difficulty, setDifficulty] = useState<GeneratedQuestionDifficulty>(2);
  const [saved, setSaved] = useState(false);
  const [manualError, setManualError] = useState("");

  const allowedSenseIds = useMemo(
    () =>
      setId
        ? new Set(
            (state.memberships[setId] ?? []).flatMap((entry) => entry.senseIds),
          )
        : null,
    [setId, state.memberships],
  );

  const coveredSenseKeys = useMemo(() => {
    const covered = new Set<string>();
    for (const question of state.questions) {
      if (question.kind === "reading") {
        for (const child of question.questions)
          covered.add(generationSenseKey(child.wordKey, child.senseId));
      } else {
        covered.add(generationSenseKey(question.wordKey, question.senseId));
      }
    }
    return covered;
  }, [state.questions]);

  const senses = useMemo<GenerationSense[]>(
    () =>
      Object.values(state.words).flatMap((word) =>
        word.senses
          .filter((sense) => !allowedSenseIds || allowedSenseIds.has(sense.id))
          .map((sense) => {
            const key = generationSenseKey(word.wordKey, sense.id);
            return {
              covered: coveredSenseKeys.has(key),
              key,
              meaning: sense.meaningZh,
              pos: sense.pos,
              word: word.word,
            };
          }),
      ),
    [allowedSenseIds, coveredSenseKeys, state.words],
  );

  // Everything in scope is selected the first time the list arrives, so the
  // common case needs no ticking at all.
  useEffect(() => {
    if (scopeReady || !senses.length) return;
    setSelected(senses.map((sense) => sense.key));
    setScopeReady(true);
  }, [scopeReady, senses]);

  const words = useMemo(
    () => getSelectedGenerationWords(Object.values(state.words), selected),
    [selected, state.words],
  );
  const pool = useMemo(() => Object.values(state.words), [state.words]);

  /**
   * 詞彙題 that can be built from the learner's own example sentences are built
   * here and never sent anywhere: the sentence is theirs, the answer is the word
   * they chose, and the distractors are their own same-part-of-speech words.
   * Only what is left over costs a request.
   */
  const prebuilt = useMemo(
    () => (kind === "vocabulary" ? buildLibraryQuestions(words, pool, difficulty) : null),
    [difficulty, kind, pool, words],
  );
  const aiWords = prebuilt ? prebuilt.remaining : words;

  const batches = useMemo(
    () => splitGenerationBatches(aiWords, kind),
    [aiWords, kind],
  );
  const prompts = useMemo(
    () =>
      batches.map((batch) =>
        buildQuestionGenerationPrompt(batch, kind, difficulty),
      ),
    [batches, difficulty, kind],
  );

  const parseBatch = useCallback(
    (batch: WordEntry[], response: string): LibraryQuestion[] => {
      // The whole library is the distractor pool: for a plain base-form answer
      // the wrong options come from the learner's own same-part-of-speech
      // words, the way a 段考 paper draws them from the same unit.
      const normalized = normalizeQuestionGenerationJson(
        response,
        kind,
        difficulty,
        batch,
        pool,
      );
      const parsed = parseLibraryImport(normalized, {
        allowedDifficulty: difficulty,
        expectedQuestionKind: isPassageKind(kind) ? "reading" : "multipleChoice",
        expectedQuestionStyle: isPassageKind(kind) ? undefined : kind,
        questionSources: getQuestionSourceRefs(batch),
        requireEnglish: true,
      });
      if (!parsed.valid) throw new Error(parsed.error);
      if (parsed.data.kind !== "questions") throw new Error("questions expected");
      return parsed.data.questions;
    },
    [difficulty, kind],
  );

  const generation = useAiGeneration<WordEntry[], LibraryQuestion>({
    merge: (items) => {
      const byId = new Map<string, LibraryQuestion>();
      for (const item of items) byId.set(item.fingerprint || item.id, item);
      return [...byId.values()];
    },
    run: async (batch, signal) =>
      parseBatch(
        batch,
        await generateWithSavedAi(
          buildQuestionGenerationPrompt(batch, kind, difficulty),
          { signal },
        ),
      ),
  });

  const { reset, setItems, state: run } = generation;

  useEffect(() => {
    reset();
    setSaved(false);
    setManualError("");
  }, [difficulty, kind, reset, selected]);

  const applyManual = (response: string, batchIndex: number) => {
    setManualError("");
    try {
      const produced = parseBatch(batches[batchIndex], response);
      setItems([...run.items, ...produced]);
    } catch (reason) {
      setManualError(
        t("questions.invalidResponse", {
          message: reason instanceof Error ? reason.message : String(reason),
        }),
      );
    }
  };

  const addAll = async () => {
    let saved = 0;
    for (const question of run.items) {
      if ((await saveQuestion(question)) === "saved") saved += 1;
    }
    setSaved(true);
    const duplicates = run.items.length - saved;
    toast.success(duplicates > 0
      ? t("questions.savedCountWithDuplicates", { count: saved, duplicates })
      : t("questions.savedCount", { count: saved }));
  };

  const senseCount = words.reduce((count, word) => count + word.senses.length, 0);

  return (
    <div>
      <PageHeader
        title={t("questions.generateTitle")}
        description={t("questions.generateDescription")}
        back={
          <Button asChild variant="ghost" size="sm">
            <Link href="/questions">
              <Icons.back />
              {t("questions.title")}
            </Link>
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-8">
        <div className="grid content-start gap-4">
          <SelectField
            label={t("questions.type")}
            onValueChange={(value) =>
              setKind(value as GeneratedQuestionKind)
            }
            options={questionFormatOptions()}
            value={kind}
          />
          <SelectField
            label={t("practice.difficulty")}
            onValueChange={(value) =>
              setDifficulty(Number(value) as GeneratedQuestionDifficulty)
            }
            options={difficultyOptions()}
            value={String(difficulty)}
          />
          <GenerationScopePicker
            onSelectedChange={setSelected}
            selected={selected}
            senses={senses}
          />
        </div>

        <div className="grid content-start gap-6">
          <AiRunPanel
            actionLabel={t("questions.generate")}
            configured={generation.configured}
            manualError={manualError}
            onCancel={generation.cancel}
            onManualResponse={applyManual}
            onRetryFailed={generation.retryFailed}
            onStart={() => generation.start(batches, prebuilt?.built ?? [])}
            prompts={prompts}
            localCount={prebuilt?.built.length ?? 0}
            scopeSummary={t("questions.scopeSummary", { count: senseCount })}
            state={run}
          />

          {run.items.length > 0 && (
            <section>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-lexical text-xl font-medium">
                  {t("questions.generatedCount", { count: run.items.length })}
                </h2>
                {saved ? (
                  <Button asChild>
                    <Link href="/practice?mode=questions&start=1">
                      <Icons.start />
                      {t("questions.startGenerated")}
                    </Link>
                  </Button>
                ) : (
                  <Button onClick={() => void addAll()}>
                    <Icons.success />
                    {t("questions.addAll")}
                  </Button>
                )}
              </div>
              <ol className="mt-4 divide-y border-y">
                {run.items.map((question) => (
                  <li className="py-5" key={question.id}>
                    <QuestionPreview question={question} />
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

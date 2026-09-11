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
import { ChoiceList } from "@/components/ui/choice-list";
import { Icons } from "@/components/ui/icons";
import { SelectField } from "@/components/ui/select-field";
import { StepFrame, StepRecap } from "@/components/ui/step-frame";
import { t } from "@/lib/i18n";
import {
  difficultyLabel,
  difficultyOptions,
  questionFormatHint,
  questionFormatLabel,
  PASSAGE_FORMAT_VALUES,
  SENTENCE_STYLES,
} from "@/lib/question-options";
import { useLibraryStore } from "@/stores/library-store";
import { generateWithSavedAi } from "@/src/lib/ai-provider";
import { parseLibraryImport } from "@/src/lib/library-import";
import { senseKey } from "@/src/lib/library";
import {
  buildQuestionGenerationPrompt,
  getQuestionSourceRefs,
  getSelectedGenerationWords,
  normalizeQuestionGenerationJson,
  splitGenerationBatches,
  type GeneratedQuestionDifficulty,
  type GeneratedQuestionKind,
} from "@/src/lib/question-generation";
import { isPassageKind } from "@/src/lib/question-formats";
import { buildLibraryQuestions } from "@/src/lib/question-builders";

type Step = "format" | "scope" | "run";

const FORMATS: GeneratedQuestionKind[] = [
  ...SENTENCE_STYLES,
  ...PASSAGE_FORMAT_VALUES,
];

/**
 * Generating a batch of questions is three decisions, and they are asked in the
 * order they constrain each other: what kind of paper, which words, then run it.
 * Putting the format picker beside the run panel — as this screen used to —
 * meant the first press a newcomer made was as likely to be the last step as
 * the first.
 */
export function QuestionGenerator({ setId }: { setId?: string }) {
  const { state, saveQuestion } = useLibraryStore();
  const [step, setStep] = useState<Step>("format");
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
          covered.add(senseKey(child.wordKey, child.senseId));
      } else {
        covered.add(senseKey(question.wordKey, question.senseId));
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
            const key = senseKey(word.wordKey, sense.id);
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
    [difficulty, kind, pool],
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
    let stored = 0;
    for (const question of run.items) {
      if ((await saveQuestion(question)) === "saved") stored += 1;
    }
    setSaved(true);
    const duplicates = run.items.length - stored;
    toast.success(duplicates > 0
      ? t("questions.savedCountWithDuplicates", { count: stored, duplicates })
      : t("questions.savedCount", { count: stored }));
  };

  const senseCount = words.reduce((count, word) => count + word.senses.length, 0);
  const back = (
    <Button asChild size="sm" variant="ghost">
      <Link href="/questions">
        <Icons.back />
        {t("questions.title")}
      </Link>
    </Button>
  );

  if (step === "format") {
    return (
      <StepFrame
        current={1}
        description={t("questions.stepFormatHint")}
        title={t("questions.stepFormat")}
        total={3}
      >
        <ChoiceList
          onSelect={(value) => {
            setKind(value as GeneratedQuestionKind);
            setStep("scope");
          }}
          options={FORMATS.map((format) => ({
            description: questionFormatHint(format),
            icon: isPassageKind(format) ? Icons.reading : Icons.question,
            label: questionFormatLabel(format),
            value: format,
          }))}
        />
        <p className="mt-6 text-center">{back}</p>
      </StepFrame>
    );
  }

  const recap = (
    <StepRecap
      items={[
        t("questions.formatChosen", { name: questionFormatLabel(kind) }),
        t("questions.difficultyChosen", { name: difficultyLabel(difficulty) }),
        ...(step === "run"
          ? [t("questions.scopeChosen", { count: senseCount })]
          : []),
      ]}
      onEdit={() => setStep("format")}
    />
  );

  if (step === "scope") {
    return (
      <StepFrame
        current={2}
        description={t("questions.stepScopeHint")}
        footer={
          <Button
            className="w-full"
            disabled={!senseCount}
            onClick={() => setStep("run")}
            size="lg"
          >
            <Icons.next />
            {t("questions.next")}
          </Button>
        }
        onBack={() => setStep("format")}
        recap={recap}
        title={t("questions.stepScope")}
        total={3}
      >
        <div className="grid gap-4">
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
      </StepFrame>
    );
  }

  return (
    <StepFrame
      current={3}
      description={t("questions.stepRunHint")}
      onBack={() => setStep("scope")}
      recap={recap}
      title={t("questions.stepRun")}
      total={3}
      width="wide"
    >
      <AiRunPanel
        actionLabel={t("questions.generate")}
        configured={generation.configured}
        localCount={prebuilt?.built.length ?? 0}
        manualError={manualError}
        onCancel={generation.cancel}
        onManualResponse={applyManual}
        onRetryFailed={generation.retryFailed}
        onStart={() => generation.start(batches, prebuilt?.built ?? [])}
        prompts={prompts}
        scopeSummary={t("questions.scopeSummary", { count: senseCount })}
        state={run}
      />

      {run.items.length > 0 && (
        <section className="section-gap">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="type-section">
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
          <ol className="mt-4 rule-card rule-list">
            {run.items.map((question) => (
              <li className="py-5" key={question.id}>
                <QuestionPreview question={question} />
              </li>
            ))}
          </ol>
        </section>
      )}
    </StepFrame>
  );
}

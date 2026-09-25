"use client";

import type { LibraryQuestion } from "@/types";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AiRunPanel } from "@/components/ai/ai-run-panel";
import {
  useAiGeneration,
  useReviewHandoff,
} from "@/components/ai/use-ai-generation";
import { GeneratedQuestionResults } from "./generated-question-results";
import { useSaveGeneratedQuestions } from "./use-save-generated-questions";
import { BackControl } from "@/components/ui/back-control";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { FinishPanel } from "@/components/ui/finish-panel";
import { EmptyState } from "@/components/ui/page-state";
import {
  ListChoiceGroup,
  ListPicker,
  ListRow,
  ListSection,
} from "@/components/ui/list";
import { StepActions } from "@/components/ui/step-actions";
import { StepFrame, StepRecap } from "@/components/ui/step-frame";
import { t } from "@/lib/i18n";
import { LIBRARY_QUESTIONS_HREF } from "@/lib/routes";
import {
  difficultyLabel,
  difficultyOptions,
  questionFormatHint,
  questionFormatLabel,
  PASSAGE_FORMAT_VALUES,
  SENTENCE_STYLES,
} from "@/lib/question-options";
import { useLibraryStore } from "@/stores/library-store";
import { questionTask } from "@/src/lib/ai/tasks";
import {
  getSetGenerationWords,
  type GeneratedQuestionDifficulty,
  type GeneratedQuestionKind,
} from "@/src/lib/question-generation";
import { isPassageKind } from "@/src/lib/question-formats";
import { buildLibraryQuestions } from "@/src/lib/question-builders";

type Step = "configure" | "run" | "review" | "done";
const FORMATS: GeneratedQuestionKind[] = [
  ...SENTENCE_STYLES,
  ...PASSAGE_FORMAT_VALUES,
];

/** Generate from every sense in one set, without individual word selection. */
export function QuestionGenerator({ setId }: { setId?: string }) {
  const { state } = useLibraryStore();
  const [step, setStep] = useState<Step>("configure");
  const [chosenSetId, setChosenSetId] = useState("");
  const [kind, setKind] = useState<GeneratedQuestionKind>("vocabulary");
  const [difficulty, setDifficulty] = useState<GeneratedQuestionDifficulty>(2);
  const { saving, save: storeAll } = useSaveGeneratedQuestions(() =>
    setStep("done"),
  );

  const defaultSetId =
    state.sets.find((entry) =>
      (state.memberships[entry.id] ?? []).some(
        (membership) => membership.senseIds.length > 0,
      ),
    )?.id ??
    state.sets[0]?.id ??
    "";
  const selectedSetId = setId ?? (chosenSetId || defaultSetId);
  const selectedSet = state.sets.find((entry) => entry.id === selectedSetId);
  const pool = useMemo(() => Object.values(state.words), [state.words]);
  const words = useMemo(
    () => getSetGenerationWords(pool, state.memberships[selectedSetId] ?? []),
    [pool, selectedSetId, state.memberships],
  );
  const senseCount = words.reduce(
    (count, word) => count + word.senses.length,
    0,
  );
  const prebuilt = useMemo(
    () =>
      kind === "vocabulary"
        ? buildLibraryQuestions(words, pool, difficulty)
        : null,
    [difficulty, kind, pool, words],
  );
  const aiWords = prebuilt ? prebuilt.remaining : words;
  const task = useMemo(
    () => questionTask(aiWords, pool, kind, difficulty),
    [aiWords, pool, kind, difficulty],
  );
  const moreTask = useMemo(
    () => questionTask(words, pool, kind, difficulty),
    [words, pool, kind, difficulty],
  );
  const generation = useAiGeneration<LibraryQuestion>({
    merge: (items) => {
      const byId = new Map<string, LibraryQuestion>();
      for (const item of items) byId.set(item.fingerprint || item.id, item);
      return [...byId.values()];
    },
  });
  const { reset, state: run } = generation;
  useReviewHandoff(run.status, () => setStep("review"));
  useEffect(() => {
    reset();
  }, [difficulty, kind, reset, selectedSetId]);

  const back = (
    <BackControl href={setId ? `/sets/${setId}` : LIBRARY_QUESTIONS_HREF} />
  );
  const recap = (
    <StepRecap
      items={[
        selectedSet?.setName ?? "",
        t("questions.scopeChosen", { count: senseCount }),
        t("questions.formatChosen", { name: questionFormatLabel(kind) }),
        t("questions.difficultyChosen", { name: difficultyLabel(difficulty) }),
      ]}
      onEdit={() => {
        if (!saving) {
          generation.cancel();
          setStep("configure");
        }
      }}
    />
  );

  if (step === "configure")
    return (
      <StepFrame
        back={back}
        current={1}
        total={3}
        title={t("questions.generateTitle")}
        footer={
          senseCount ? (
            <Button className="w-full" onClick={() => setStep("run")} size="lg">
              <Icons.next />
              {t("questions.next")}
            </Button>
          ) : (
            <Button asChild className="w-full" size="lg">
              <Link href={selectedSet ? `/sets/${selectedSetId}` : "/sets/new"}>
                <Icons.create />
                {t(
                  selectedSet
                    ? "questions.addWordsFirst"
                    : "practice.addWordsFirst",
                )}
              </Link>
            </Button>
          )
        }
      >
        <div className="space-y-6">
          {selectedSet && (
            <ListSection>
              {setId ? (
                <ListRow
                  label={t("practice.set")}
                  value={selectedSet.setName}
                />
              ) : (
                <ListPicker
                  label={t("practice.set")}
                  onChange={setChosenSetId}
                  options={state.sets.map((entry) => ({
                    label: entry.setName,
                    value: entry.id,
                  }))}
                  value={selectedSetId}
                />
              )}
              <ListRow
                label={t("questions.scopeTitle")}
                value={t("questions.scopeSummary", { count: senseCount })}
              />
            </ListSection>
          )}
          {!senseCount && (
            <EmptyState
              variant="filtered"
              title={t(
                selectedSet ? "questions.noSetWords" : "questions.noSets",
              )}
              description={t(
                selectedSet
                  ? "questions.noSetWordsHint"
                  : "questions.noSetsHint",
              )}
            />
          )}
          {senseCount > 0 && (
            <>
              <ListSection header={t("questions.stepFormat")}>
                <ListChoiceGroup
                  label={t("questions.stepFormat")}
                  onSelect={setKind}
                  options={FORMATS.map((format) => ({
                    detail: questionFormatHint(format),
                    id: format,
                    label: questionFormatLabel(format),
                  }))}
                  value={kind}
                />
              </ListSection>
              <ListSection>
                <ListPicker
                  label={t("practice.difficulty")}
                  onChange={(value) =>
                    setDifficulty(Number(value) as GeneratedQuestionDifficulty)
                  }
                  options={difficultyOptions()}
                  value={String(difficulty)}
                />
              </ListSection>
            </>
          )}
        </div>
      </StepFrame>
    );

  if (step === "review")
    return (
      <StepFrame
        current={3}
        total={3}
        title={t("questions.stepReview")}
        width="wide"
        onBack={() => {
          if (!saving) setStep("run");
        }}
        recap={recap}
      >
        <fieldset disabled={saving} className="min-w-0 space-y-7">
          <GeneratedQuestionResults items={run.items} />
          <p className="type-hint">{t("ai.savedHint")}</p>
          <StepActions width="wide">
            <Button
              className="w-full"
              disabled={saving || !run.items.length}
              onClick={() => void storeAll(run.items)}
              size="lg"
              type="button"
            >
              <Icons.success />
              {t("ai.applyQuestions")}
            </Button>
            <Button
              disabled={saving}
              onClick={() => setStep("run")}
              type="button"
              variant="ghost"
            >
              <Icons.back />
              {t("ai.reviewBack")}
            </Button>
          </StepActions>
        </fieldset>
      </StepFrame>
    );

  if (step === "done")
    return (
      <FinishPanel
        description={t("questions.generatedDescription")}
        finishHref={setId ? `/sets/${setId}` : LIBRARY_QUESTIONS_HREF}
        moreIcon={Icons.generate}
        moreLabel={t("questions.generateMore")}
        onMore={() => {
          reset();
          setStep("configure");
        }}
        title={t("questions.generatedCount", { count: run.items.length })}
      />
    );

  return (
    <StepFrame
      current={2}
      total={3}
      title={t("questions.stepRun")}
      width="wide"
      onBack={() => {
        if (!saving) {
          generation.cancel();
          setStep("configure");
        }
      }}
      recap={recap}
    >
      <fieldset disabled={saving} className="min-w-0">
        <AiRunPanel
          actionLabel={t("questions.generate")}
          configured={generation.configured}
          ready={generation.ready}
          localCount={prebuilt?.built.length ?? 0}
          onCancel={generation.cancel}
          onResume={generation.resume}
          onAppend={
            moreTask.steps.length
              ? () => generation.append(moreTask)
              : undefined
          }
          onReview={
            run.items.length && run.status !== "running"
              ? () => setStep("review")
              : undefined
          }
          onStart={() => generation.start(task, prebuilt?.built ?? [])}
          kind={task.kind}
          billableCount={task.billableCount}
          appendBillableCount={moreTask.billableCount}
          tier={generation.tier}
          onTierChange={generation.setTier}
          state={run}
          unit={t(isPassageKind(kind) ? "ai.packsUnit" : "ai.questionsUnit")}
        />
      </fieldset>
    </StepFrame>
  );
}

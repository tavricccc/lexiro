"use client";

import type { LibraryQuestion } from "@/types";
import { useEffect, useMemo, useState } from "react";

import { AiRunPanel } from "@/components/ai/ai-run-panel";
import { useAiGeneration } from "@/components/ai/use-ai-generation";
import {
  GenerationScopePicker,
  type GenerationSense,
} from "@/components/questions/generation-scope-picker";
import { GeneratedQuestionResults } from "./generated-question-results";
import { useSaveGeneratedQuestions } from "./use-save-generated-questions";
import { BackControl } from "@/components/ui/back-control";
import { Button } from "@/components/ui/button";
import { ChoiceList } from "@/components/ui/choice-list";
import { Icons } from "@/components/ui/icons";
import { FinishPanel } from "@/components/ui/finish-panel";
import { ListPicker, ListSection } from "@/components/ui/list";
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
import { senseKey } from "@/src/lib/library";
import {
  getSelectedGenerationWords,
  type GeneratedQuestionDifficulty,
  type GeneratedQuestionKind,
} from "@/src/lib/question-generation";
import { isPassageKind } from "@/src/lib/question-formats";
import { buildLibraryQuestions } from "@/src/lib/question-builders";

type Step = "format" | "scope" | "run" | "done";

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
  const { state } = useLibraryStore();
  const [step, setStep] = useState<Step>("format");
  const [selected, setSelected] = useState<string[]>([]);
  const [scopeReady, setScopeReady] = useState(false);
  const [kind, setKind] = useState<GeneratedQuestionKind>("vocabulary");
  const [difficulty, setDifficulty] = useState<GeneratedQuestionDifficulty>(2);
  const { saving, save: storeAll } = useSaveGeneratedQuestions(() =>
    setStep("done"),
  );

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

  useEffect(() => {
    reset();
  }, [difficulty, kind, reset, selected]);

  const senseCount = words.reduce(
    (count, word) => count + word.senses.length,
    0,
  );
  const back = (
    <BackControl href={setId ? `/sets/${setId}` : LIBRARY_QUESTIONS_HREF} />
  );

  if (step === "format") {
    return (
      <StepFrame
        back={back}
        current={1}
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
      onEdit={() => {
        if (!saving) {
          generation.cancel();
          setStep("format");
        }
      }}
    />
  );

  if (step === "scope") {
    return (
      <StepFrame
        current={2}
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
        <div className="grid gap-7">
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
          <GenerationScopePicker
            onSelectedChange={setSelected}
            selected={selected}
            senses={senses}
          />
        </div>
      </StepFrame>
    );
  }

  const generated = <GeneratedQuestionResults items={run.items} />;

  if (step === "done") {
    return (
      <FinishPanel
        description={t("questions.generatedDescription")}
        finishHref={setId ? `/sets/${setId}` : LIBRARY_QUESTIONS_HREF}
        moreIcon={Icons.generate}
        moreLabel={t("questions.generateMore")}
        onMore={() => {
          reset();
          setStep("format");
        }}
        title={t("questions.generatedCount", { count: run.items.length })}
      />
    );
  }

  return (
    <StepFrame
      current={3}
      onBack={() => {
        if (!saving) {
          generation.cancel();
          setStep("scope");
        }
      }}
      recap={recap}
      title={t("questions.stepRun")}
      total={3}
      width="wide"
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

      {run.items.length > 0 && (
        <section className="section-gap">
          <h2 className="type-section">
            {t("questions.previewCount", { count: run.items.length })}
          </h2>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              disabled={run.status === "running" || saving}
              onClick={() => void storeAll(run.items)}
            >
              <Icons.success />
              {t("ai.applyQuestions")}
            </Button>
            <p className="text-xs text-muted-foreground">{t("ai.savedHint")}</p>
          </div>
          {generated}
        </section>
      )}
    </StepFrame>
  );
}

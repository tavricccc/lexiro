"use client";

import type {
  LibrarySet,
  PracticeCardTask,
  PracticeTask,
  PracticeTrack,
  WorkspaceQuestionDifficulty,
} from "@/types";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ChoiceChecklist } from "@/components/ui/choice-checklist";
import { ChoiceList } from "@/components/ui/choice-list";
import { Icons } from "@/components/ui/icons";
import { SelectField } from "@/components/ui/select-field";
import { StepFrame, StepRecap } from "@/components/ui/step-frame";
import { Switch } from "@/components/ui/switch";
import { PRACTICE_CARD_TASKS, PRACTICE_QUESTION_TASKS } from "@/constants";
import { t } from "@/lib/i18n";
import { LIBRARY_QUESTIONS_HREF } from "@/lib/routes";
import { practiceTaskHint, practiceTaskLabel } from "@/lib/practice-tasks";
import { difficultyOptions } from "@/lib/question-options";
import { isPassageKind } from "@/src/lib/question-formats";

const AMOUNTS = [5, 10, 20, 30];

/** 隨機混合 is both card tasks at once, so it needs no separate stored value. */
const CARD_STYLES = ["flashcard", "spelling", "mixed"] as const;
type CardStyle = (typeof CARD_STYLES)[number];

function styleOfTasks(tasks: PracticeTask[]): CardStyle {
  const chosen = PRACTICE_CARD_TASKS.filter((task) => tasks.includes(task));
  if (chosen.length > 1) return "mixed";
  return (chosen[0] ?? "flashcard") as CardStyle;
}

function tasksOfStyle(style: CardStyle): PracticeCardTask[] {
  return style === "mixed" ? [...PRACTICE_CARD_TASKS] : [style];
}

/**
 * Starting a session is a short questionnaire, one question per screen.
 *
 * First the track — the words FSRS has scheduled, or the question bank — since
 * the two draw on different material. Then the range and the length, which both
 * tracks share and neither used to ask up front. 每日複習 ends there, with how a
 * due word should be asked folded into the same screen because it is one
 * three-way choice. 做題目 takes one more screen for the formats, which is a
 * list of six that only makes sense once the range has decided how many of each
 * there are.
 */
export function PracticeSetup({
  amount,
  cardCount,
  counts,
  difficulty,
  hasWords,
  leechOnly,
  onAmountChange,
  onBegin,
  onDifficultyChange,
  onLeechOnlyChange,
  onSetChange,
  onTasksChange,
  queueLength,
  setId,
  sets,
  tasks,
  trackPreset,
}: {
  amount: number;
  /** Everything FSRS has scheduled in range, however it ends up being asked. */
  cardCount: number;
  counts: Record<PracticeTask, number>;
  difficulty: WorkspaceQuestionDifficulty;
  hasWords: boolean;
  leechOnly: boolean;
  onAmountChange: (amount: number) => void;
  onBegin: () => void;
  onDifficultyChange: (difficulty: WorkspaceQuestionDifficulty) => void;
  onLeechOnlyChange: (leechOnly: boolean) => void;
  onSetChange: (setId: string) => void;
  onTasksChange: (tasks: PracticeTask[]) => void;
  queueLength: number;
  setId: string;
  sets: LibrarySet[];
  tasks: PracticeTask[];
  /** The track arrived in the link, so the branch step is already answered. */
  trackPreset?: PracticeTrack;
}) {
  const [track, setTrack] = useState<PracticeTrack | null>(trackPreset ?? null);
  const [step, setStep] = useState<"scope" | "formats">("scope");
  const questionCount = PRACTICE_QUESTION_TASKS.reduce(
    (total, task) => total + counts[task],
    0,
  );
  // A format nothing in range was written in is not a choice, so it is not
  // offered; the range step above is what changes this list.
  const availableFormats = PRACTICE_QUESTION_TASKS.filter(
    (task) => counts[task] > 0,
  );

  const trackSteps = track === "questions" ? 2 : 1;
  const total = (trackPreset ? 0 : 1) + trackSteps;
  const current = (trackPreset ? 0 : 1) + (step === "formats" ? 2 : 1);

  if (!track) {
    return (
      <StepFrame
        current={1}
        title={t("practice.chooseTitle")}
        total={2}
      >
        <ChoiceList
          onSelect={(value) => {
            const chosen = value as PracticeTrack;
            setTrack(chosen);
            setStep("scope");
            onTasksChange(
              chosen === "fsrs"
                ? tasksOfStyle(styleOfTasks(tasks))
                : PRACTICE_QUESTION_TASKS.filter((task) => tasks.includes(task)),
            );
          }}
          options={[
            {
              description: t("practice.reviewSummary"),
              icon: Icons.review,
              label: t("practice.review"),
              meta: cardCount
                ? t("practice.reviewReady", { count: cardCount })
                : t("practice.reviewNone"),
              metaEmpty: !cardCount,
              value: "fsrs",
            },
            {
              description: t("practice.questionsSummary"),
              icon: Icons.practice,
              label: t("practice.questions"),
              meta: questionCount
                ? t("practice.questionsReady", { count: questionCount })
                : t("practice.questionsNone"),
              metaEmpty: !questionCount,
              value: "questions",
            },
          ]}
        />
      </StepFrame>
    );
  }

  const fsrs = track === "fsrs";
  const availableCount = fsrs ? cardCount : questionCount;
  const empty = !availableCount;
  const emptyHref = !hasWords
    ? "/sets/new"
    : fsrs
      ? "/library"
      : "/questions/generate";
  const EmptyIcon = !hasWords
    ? Icons.create
    : fsrs
      ? Icons.library
      : Icons.generate;
  const emptyLabel = !hasWords
    ? t("practice.addWordsFirst")
    : fsrs
      ? t("home.openLibrary")
      : t("practice.generateFirst");

  const goBack = () => {
    if (step === "formats") return setStep("scope");
    if (!trackPreset) return setTrack(null);
    return undefined;
  };

  const recap = (
    <StepRecap
      items={[
        availableCount
          ? t(fsrs ? "practice.readyReview" : "practice.readyQuestions", {
              count: availableCount,
            })
          : t("practice.noContent"),
        ...(step === "formats"
          ? [
              t("practice.scopeChosen", {
                name:
                  sets.find((entry) => entry.id === setId)?.setName ??
                  t("practice.allSets"),
                count: amount,
              }),
            ]
          : []),
      ]}
      onEdit={
        step === "formats"
          ? () => setStep("scope")
          : trackPreset
            ? undefined
            : () => setTrack(null)
      }
    />
  );

  const emptyFooter = (
    <Button asChild className="w-full" size="lg">
      <Link href={emptyHref}>
        <EmptyIcon />
        {emptyLabel}
      </Link>
    </Button>
  );

  const beginFooter = (
    <>
      <Button
        className="w-full"
        disabled={!queueLength}
        onClick={onBegin}
        size="lg"
      >
        <Icons.start />
        {queueLength
          ? t("practice.beginCount", { count: queueLength })
          : t("practice.noSelection")}
      </Button>
      {!fsrs && (
        <p className="mt-4 text-center">
          <Link
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            href={LIBRARY_QUESTIONS_HREF}
          >
            {t("practice.manageQuestions")}
          </Link>
        </p>
      )}
    </>
  );

  if (!fsrs && step === "formats") {
    return (
      <StepFrame
        current={current}
        footer={empty ? emptyFooter : beginFooter}
        onBack={goBack}
        recap={recap}
        title={t("practice.formatsTitle")}
        total={total}
      >
        <ChoiceChecklist
          onToggle={(value, checked) =>
            onTasksChange(
              PRACTICE_QUESTION_TASKS.filter((entry) =>
                entry === value ? checked : tasks.includes(entry),
              ),
            )
          }
          options={availableFormats.map((task) => ({
            description: practiceTaskHint(task),
            icon: isPassageKind(task) ? Icons.reading : Icons.question,
            label: practiceTaskLabel(task),
            meta: t("practice.formatReady", { count: counts[task] }),
            value: task,
          }))}
          selected={tasks}
        />

        <div className="mt-5">
          <SelectField
            label={t("practice.difficulty")}
            onValueChange={(value) =>
              onDifficultyChange(value as WorkspaceQuestionDifficulty)
            }
            options={difficultyOptions(t("practice.allDifficulties"))}
            value={String(difficulty)}
          />
        </div>
      </StepFrame>
    );
  }

  return (
    <StepFrame
      current={current}
      footer={
        empty ? (
          emptyFooter
        ) : fsrs ? (
          beginFooter
        ) : (
          <Button
            className="w-full"
            onClick={() => setStep("formats")}
            size="lg"
          >
            <Icons.next />
            {t("questions.next")}
          </Button>
        )
      }
      onBack={trackPreset ? undefined : goBack}
      recap={recap}
      title={t("practice.scopeTitle")}
      total={total}
    >
      <div className="grid gap-6">
        <section className="rule-card py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label={t("practice.set")}
              onValueChange={(value) =>
                onSetChange(value === "all" ? "" : value)
              }
              options={[
                { label: t("practice.allSets"), value: "all" },
                ...sets.map((entry) => ({
                  label: entry.setName,
                  value: entry.id,
                })),
              ]}
              value={setId || "all"}
            />
            <SelectField
              label={t("practice.amount")}
              onValueChange={(value) => onAmountChange(Number(value))}
              options={AMOUNTS.map((value) => ({
                label: String(value),
                value: String(value),
              }))}
              value={String(amount)}
            />
          </div>
        </section>

        {fsrs && (
          <section className="rule-card py-4">
            <h2 className="type-subsection">{t("practice.cardStyleTitle")}</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {t("practice.cardStyleHint")}
            </p>
            <div className="mt-4 rule-list">
              {CARD_STYLES.map((style) => (
                <label
                  className="flex cursor-pointer items-start gap-3 py-3"
                  key={style}
                >
                  <input
                    checked={styleOfTasks(tasks) === style}
                    className="mt-0.5 size-4 shrink-0 accent-brand-600"
                    name="card-style"
                    onChange={() => onTasksChange(tasksOfStyle(style))}
                    type="radio"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">
                      {style === "mixed"
                        ? t("practice.cardStyleMixed")
                        : practiceTaskLabel(style)}
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                      {style === "mixed"
                        ? t("practice.cardStyleMixedHint")
                        : practiceTaskHint(style)}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <label className="mt-1 flex cursor-pointer items-start justify-between gap-5 rule-t pt-4">
              <span className="min-w-0">
                <span className="block text-sm font-medium">
                  {t("practice.leechOnly")}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                  {t("practice.leechOnlyHint")}
                </span>
              </span>
              <Switch
                aria-label={t("practice.leechOnly")}
                checked={leechOnly}
                className="mt-0.5 shrink-0"
                onCheckedChange={onLeechOnlyChange}
                size="sm"
              />
            </label>
          </section>
        )}
      </div>
    </StepFrame>
  );
}

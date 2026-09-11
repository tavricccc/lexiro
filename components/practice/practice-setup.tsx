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
import { Checkbox } from "@/components/ui/checkbox";
import { ChoiceList } from "@/components/ui/choice-list";
import { Icons } from "@/components/ui/icons";
import { SelectField } from "@/components/ui/select-field";
import { StepFrame, StepRecap } from "@/components/ui/step-frame";
import { Switch } from "@/components/ui/switch";
import {
  PRACTICE_CARD_TASKS,
  PRACTICE_QUESTION_TASKS,
} from "@/constants";
import { t } from "@/lib/i18n";
import { LIBRARY_QUESTIONS_HREF } from "@/lib/routes";
import { practiceTaskHint, practiceTaskLabel } from "@/lib/practice-tasks";
import { difficultyOptions } from "@/lib/question-options";

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
 * Starting a session is two questions.
 *
 * Step one is the branch — the words FSRS has scheduled, or the question bank —
 * because the two draw on different material and mixing them in one queue would
 * make "how many" mean two things at once. Step two opens with the range and
 * the length, which both branches share, and then asks only what its own branch
 * needs: how a card should be asked, or which formats to include.
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
  const questionCount = PRACTICE_QUESTION_TASKS.reduce(
    (total, task) => total + counts[task],
    0,
  );

  if (!track) {
    return (
      <StepFrame
        current={1}
        description={t("practice.chooseDescription")}
        title={t("practice.chooseTitle")}
        total={2}
      >
        <ChoiceList
          onSelect={(value) => {
            const chosen = value as PracticeTrack;
            setTrack(chosen);
            onTasksChange(
              chosen === "fsrs"
                ? tasksOfStyle(styleOfTasks(tasks))
                : PRACTICE_QUESTION_TASKS.filter(
                    (task) => tasks.includes(task) || tasks.length === 0,
                  ),
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
  const emptyHref = !hasWords ? "/sets/new" : fsrs ? "/library" : "/questions/generate";
  const EmptyIcon = !hasWords ? Icons.create : fsrs ? Icons.library : Icons.generate;
  const emptyLabel = !hasWords
    ? t("practice.addWordsFirst")
    : fsrs
      ? t("home.openLibrary")
      : t("practice.generateFirst");

  const toggleQuestionTask = (task: PracticeTask, checked: boolean) => {
    const next = PRACTICE_QUESTION_TASKS.filter((entry) =>
      entry === task ? checked : tasks.includes(entry),
    );
    onTasksChange(next);
  };

  return (
    <StepFrame
      current={2}
      footer={
        availableCount ? (
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
        ) : (
          <Button asChild className="w-full" size="lg">
            <Link href={emptyHref}>
              <EmptyIcon />
              {emptyLabel}
            </Link>
          </Button>
        )
      }
      onBack={trackPreset ? undefined : () => setTrack(null)}
      recap={
        <StepRecap
          items={[
            availableCount
              ? t(fsrs ? "practice.readyReview" : "practice.readyQuestions", {
                  count: availableCount,
                })
              : t("practice.noContent"),
          ]}
          onEdit={trackPreset ? undefined : () => setTrack(null)}
        />
      }
      title={t(fsrs ? "practice.review" : "practice.questions")}
      total={2}
    >
      <div className="grid gap-6">
        <section className="rule-card py-4">
          <h2 className="type-subsection">{t("practice.scopeTitle")}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <SelectField
              label={t("practice.set")}
              onValueChange={(value) => onSetChange(value === "all" ? "" : value)}
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

        {fsrs ? (
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
        ) : (
          <section className="rule-card py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="type-subsection">{t("practice.formatsTitle")}</h2>
              <button
                className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                onClick={() =>
                  onTasksChange(
                    tasks.length === PRACTICE_QUESTION_TASKS.length
                      ? []
                      : [...PRACTICE_QUESTION_TASKS],
                  )
                }
                type="button"
              >
                {t(
                  tasks.length === PRACTICE_QUESTION_TASKS.length
                    ? "practice.clearFormats"
                    : "practice.allFormats",
                )}
              </button>
            </div>
            <div className="mt-3 rule-list">
              {PRACTICE_QUESTION_TASKS.map((task) => (
                <label
                  className="flex cursor-pointer items-start gap-3 py-3"
                  key={task}
                >
                  <Checkbox
                    checked={tasks.includes(task)}
                    className="mt-0.5"
                    disabled={!counts[task]}
                    onCheckedChange={(checked) =>
                      toggleQuestionTask(task, checked === true)
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium">
                        {practiceTaskLabel(task)}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {counts[task]}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                      {practiceTaskHint(task)}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-1 rule-t pt-4">
              <SelectField
                label={t("practice.difficulty")}
                onValueChange={(value) =>
                  onDifficultyChange(value as WorkspaceQuestionDifficulty)
                }
                options={difficultyOptions(t("practice.allDifficulties"))}
                value={String(difficulty)}
              />
            </div>
          </section>
        )}
      </div>
    </StepFrame>
  );
}

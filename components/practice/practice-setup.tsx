"use client";

import type {
  LibrarySet,
  WorkspacePracticeMode,
  WorkspaceQuestionDifficulty,
  WorkspaceQuestionType,
} from "@/types";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ChoiceList } from "@/components/ui/choice-list";
import { Icons } from "@/components/ui/icons";
import { SelectField } from "@/components/ui/select-field";
import { StepFrame, StepRecap } from "@/components/ui/step-frame";
import { Switch } from "@/components/ui/switch";
import { t } from "@/lib/i18n";
import {
  difficultyOptions,
  questionFormatOptions,
} from "@/lib/question-options";

const AMOUNTS = [5, 10, 20, 30];

/**
 * Starting a session is two questions, asked one at a time.
 *
 * Step one is the branch: 背單字 or 做題目, each with what it is and how much is
 * waiting. Step two shows only what that branch needs, behind one press —
 * because the answer for almost every session is "yes, start", and the settings
 * exist for the sessions where it is not.
 */
export function PracticeSetup({
  amount,
  difficulty,
  hasWords,
  leechOnly,
  mode,
  modePreset,
  onAmountChange,
  onBegin,
  onDifficultyChange,
  onLeechOnlyChange,
  onModeChange,
  onQuestionTypeChange,
  onSetChange,
  onTypingModeChange,
  questionCount,
  questionType,
  reviewCount,
  setId,
  sets,
  typingMode,
}: {
  amount: number;
  difficulty: WorkspaceQuestionDifficulty;
  hasWords: boolean;
  leechOnly: boolean;
  mode: WorkspacePracticeMode;
  /** The mode arrived in the link, so the branch step is already answered. */
  modePreset: boolean;
  onAmountChange: (amount: number) => void;
  onBegin: () => void;
  onDifficultyChange: (difficulty: WorkspaceQuestionDifficulty) => void;
  onLeechOnlyChange: (leechOnly: boolean) => void;
  onModeChange: (mode: WorkspacePracticeMode) => void;
  onQuestionTypeChange: (type: WorkspaceQuestionType) => void;
  onSetChange: (setId: string) => void;
  onTypingModeChange: (typingMode: boolean) => void;
  questionCount: number;
  questionType: WorkspaceQuestionType;
  reviewCount: number;
  setId: string;
  sets: LibrarySet[];
  typingMode: boolean;
}) {
  const [chosen, setChosen] = useState(modePreset);
  const [tuning, setTuning] = useState(false);

  if (!chosen) {
    return (
      <StepFrame
        current={1}
        description={t("practice.chooseDescription")}
        title={t("practice.chooseTitle")}
        total={2}
      >
        <ChoiceList
          onSelect={(value) => {
            onModeChange(value as WorkspacePracticeMode);
            setChosen(true);
          }}
          options={[
            {
              description: t("practice.reviewSummary"),
              icon: Icons.review,
              label: t("practice.review"),
              meta: reviewCount
                ? t("practice.reviewReady", { count: reviewCount })
                : t("practice.reviewNone"),
              metaEmpty: !reviewCount,
              value: "review",
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

  const review = mode === "review";
  const availableCount = review ? reviewCount : questionCount;
  const emptyHref = !hasWords
    ? "/sets/new"
    : review
      ? "/library"
      : "/questions/generate";
  const EmptyIcon = !hasWords
    ? Icons.create
    : review
      ? Icons.library
      : Icons.generate;
  const emptyLabel = !hasWords
    ? t("practice.addWordsFirst")
    : review
      ? t("home.openLibrary")
      : t("practice.generateFirst");

  return (
    <StepFrame
      current={2}
      footer={
        availableCount ? (
          <>
            <Button className="w-full" onClick={onBegin} size="lg">
              <Icons.start />
              {t(review ? "practice.beginReview" : "practice.beginQuestions")}
            </Button>
            {!review && (
              <p className="mt-4 text-center">
                <Link
                  className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  href="/questions"
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
      onBack={modePreset ? undefined : () => setChosen(false)}
      recap={
        <StepRecap
          items={[
            availableCount
              ? t(review ? "practice.readyReview" : "practice.readyQuestions", {
                  count: availableCount,
                })
              : t("practice.noContent"),
          ]}
          onEdit={() => setChosen(false)}
        />
      }
      title={t(review ? "practice.review" : "practice.questions")}
      total={2}
    >
      <details
        className="group rounded-[var(--radius-card)] border px-4 py-3.5 open:bg-[var(--surface-inset)] sm:px-5"
        onToggle={(event) => setTuning(event.currentTarget.open)}
        open={tuning}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium marker:content-none">
          {t("practice.tune")}
          <span className="text-xs font-normal text-muted-foreground group-open:hidden">
            {t("practice.tuneHint")}
          </span>
          <Icons.open
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground transition-transform duration-[var(--motion-control)] group-open:rotate-90"
          />
        </summary>

        <div className="mt-5 grid gap-4 rule-t pt-5">
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

          {review ? (
            <div className="grid gap-2">
              <Toggle
                checked={leechOnly}
                description={t("practice.leechOnlyHint")}
                label={t("practice.leechOnly")}
                onCheckedChange={onLeechOnlyChange}
              />
              <Toggle
                checked={typingMode}
                description={t("practice.typingModeHint")}
                label={t("practice.typingMode")}
                onCheckedChange={onTypingModeChange}
              />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label={t("practice.questionType")}
                onValueChange={(value) =>
                  onQuestionTypeChange(value as WorkspaceQuestionType)
                }
                options={questionFormatOptions(t("practice.allQuestionTypes"))}
                value={questionType}
              />
              <SelectField
                label={t("practice.difficulty")}
                onValueChange={(value) =>
                  onDifficultyChange(value as WorkspaceQuestionDifficulty)
                }
                options={difficultyOptions(t("practice.allDifficulties"))}
                value={String(difficulty)}
              />
            </div>
          )}
        </div>
      </details>
    </StepFrame>
  );
}

function Toggle({
  checked,
  description,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  description: string;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-5 rounded-[var(--radius-card)] border bg-card px-4 py-3.5">
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
          {description}
        </span>
      </span>
      <Switch
        aria-label={label}
        checked={checked}
        className="mt-0.5 shrink-0"
        onCheckedChange={onCheckedChange}
        size="sm"
      />
    </label>
  );
}

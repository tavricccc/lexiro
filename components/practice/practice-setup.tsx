"use client";

import type {
  LibrarySet,
  WorkspacePracticeMode,
  WorkspaceQuestionDifficulty,
  WorkspaceQuestionType,
} from "@/types";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Icons } from "@/components/ui/icons";
import { LiquidTabs } from "@/components/ui/liquid-tabs";
import { PageHeader } from "@/components/ui/page-header";
import { SelectField } from "@/components/ui/select-field";
import { Switch } from "@/components/ui/switch";
import { t } from "@/lib/i18n";
import {
  difficultyOptions,
  questionFormatOptions,
} from "@/lib/question-options";

const AMOUNTS = [5, 10, 20, 30];

export function PracticeSetup({
  mode,
  setId,
  amount,
  questionType,
  difficulty,
  leechOnly,
  typingMode,
  sets,
  availableCount,
  hasWords,
  onModeChange,
  onSetChange,
  onAmountChange,
  onQuestionTypeChange,
  onDifficultyChange,
  onLeechOnlyChange,
  onTypingModeChange,
  onBegin,
}: {
  mode: WorkspacePracticeMode;
  setId: string;
  amount: number;
  questionType: WorkspaceQuestionType;
  difficulty: WorkspaceQuestionDifficulty;
  leechOnly: boolean;
  typingMode: boolean;
  sets: LibrarySet[];
  availableCount: number;
  hasWords: boolean;
  onModeChange: (mode: WorkspacePracticeMode) => void;
  onSetChange: (setId: string) => void;
  onAmountChange: (amount: number) => void;
  onQuestionTypeChange: (type: WorkspaceQuestionType) => void;
  onDifficultyChange: (difficulty: WorkspaceQuestionDifficulty) => void;
  onLeechOnlyChange: (leechOnly: boolean) => void;
  onTypingModeChange: (typingMode: boolean) => void;
  onBegin: () => void;
}) {
  const emptyHref = !hasWords
    ? "/sets/new"
    : mode === "questions"
      ? "/questions/generate"
      : "/library";
  const EmptyIcon = !hasWords
    ? Icons.create
    : mode === "questions"
      ? Icons.generate
      : Icons.library;
  const emptyLabel = !hasWords
    ? t("practice.addWordsFirst")
    : mode === "questions"
      ? t("practice.generateFirst")
      : t("home.openLibrary");

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title={t(mode === "review" ? "practice.review" : "practice.questions")}
        description={t("practice.description")}
        actions={
          mode === "questions" ? (
            <>
              <Button asChild variant="ghost">
                <Link href="/questions">
                  <Icons.question />
                  {t("practice.manageQuestions")}
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/questions/generate">
                  <Icons.generate />
                  {t("questions.generate")}
                </Link>
              </Button>
            </>
          ) : undefined
        }
      />

      <div>
        <LiquidTabs
          ariaLabel={t("practice.title")}
          value={mode}
          onValueChange={(value) =>
            onModeChange(value as WorkspacePracticeMode)
          }
          options={[
            { value: "review", label: t("practice.review") },
            { value: "questions", label: t("practice.questions") },
          ]}
        />

        <div className="mt-5 grid gap-4">
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

          {mode === "questions" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label={t("practice.questionType")}
                onValueChange={(value) =>
                  onQuestionTypeChange(value as WorkspaceQuestionType)
                }
                options={questionFormatOptions(
                  t("practice.allQuestionTypes"),
                )}
                value={questionType}
              />
              <SelectField
                label={t("practice.difficulty")}
                onValueChange={(value) =>
                  onDifficultyChange(value as WorkspaceQuestionDifficulty)
                }
                options={difficultyOptions(
                  t("practice.allDifficulties"),
                )}
                value={String(difficulty)}
              />
            </div>
          )}

          <SelectField
            label={t("practice.amount")}
            onValueChange={(value) => onAmountChange(Number(value))}
            options={AMOUNTS.map((value) => ({
              label: String(value),
              value: String(value),
            }))}
            value={String(amount)}
          />

          {mode === "review" && (
            <div className="grid gap-2">
              <Toggle
                checked={leechOnly}
                label={t("practice.leechOnly")}
                onCheckedChange={onLeechOnlyChange}
              />
              <Toggle
                checked={typingMode}
                label={t("practice.typingMode")}
                onCheckedChange={onTypingModeChange}
              />
            </div>
          )}
        </div>

        <div className="mt-7 border-t pt-6">
          <p className="text-center text-sm text-muted-foreground">
            {availableCount
              ? t(
                  mode === "review"
                    ? "practice.availableWords"
                    : "practice.available",
                  { count: availableCount },
                )
              : t("practice.noContent")}
          </p>
          {availableCount ? (
            <Button className="mt-4 w-full" size="lg" onClick={onBegin}>
              <Icons.start />
              {t("practice.begin")}
            </Button>
          ) : (
            <Button asChild className="mt-4 w-full" size="lg">
              <Link href={emptyHref}>
                <EmptyIcon />
                {emptyLabel}
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Toggle({
  checked,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <Field
      className="rounded-[var(--radius-card)] border bg-card px-4 py-3"
      layout="row"
      label={label}
    >
      <span className="flex sm:justify-end">
        <Switch
          size="sm"
          checked={checked}
          onCheckedChange={onCheckedChange}
          aria-label={label}
        />
      </span>
    </Field>
  );
}

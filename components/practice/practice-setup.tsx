"use client";

import type { LibrarySet, WorkspacePracticeMode, WorkspaceQuestionDifficulty, WorkspaceQuestionType } from "@/types";
import { ListChecks, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

export function PracticeSetup({
  mode,
  setId,
  amount,
  questionType,
  difficulty,
  sets,
  availableCount,
  hasWords,
  onModeChange,
  onSetChange,
  onAmountChange,
  onQuestionTypeChange,
  onDifficultyChange,
  onBegin,
}: {
  mode: WorkspacePracticeMode;
  setId: string;
  amount: number;
  questionType: WorkspaceQuestionType;
  difficulty: WorkspaceQuestionDifficulty;
  sets: LibrarySet[];
  availableCount: number;
  hasWords: boolean;
  onModeChange: (mode: WorkspacePracticeMode) => void;
  onSetChange: (setId: string) => void;
  onAmountChange: (amount: number) => void;
  onQuestionTypeChange: (type: WorkspaceQuestionType) => void;
  onDifficultyChange: (difficulty: WorkspaceQuestionDifficulty) => void;
  onBegin: () => void;
}) {
  const emptyHref = !hasWords ? "/sets/new" : mode === "questions" ? "/questions/generate" : "/library";
  const emptyLabel = !hasWords ? t("practice.addWordsFirst") : mode === "questions" ? t("practice.generateFirst") : t("home.openLibrary");

  return (
    <div>
      <PageHeader
        title={t(mode === "review" ? "practice.review" : "practice.questions")}
        description={t("practice.description")}
        actions={mode === "questions" ? (
          <>
            <Button asChild variant="ghost"><Link href="/questions"><ListChecks className="size-4" />{t("practice.manageQuestions")}</Link></Button>
            <Button asChild variant="secondary"><Link href="/questions/generate"><Sparkles className="size-4" />{t("questions.generate")}</Link></Button>
          </>
        ) : undefined}
      />
      <div className="mx-auto max-w-xl">
        <section className="rounded-2xl bg-muted/70 p-5 sm:p-6">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-card/70 p-1">
            <Choice active={mode === "review"} onClick={() => onModeChange("review")} label={t("practice.review")} />
            <Choice active={mode === "questions"} onClick={() => onModeChange("questions")} label={t("practice.questions")} />
          </div>
          <FieldLabel label={t("practice.set")} className="mt-6">
            <select value={setId} onChange={(event) => onSetChange(event.target.value)} className="h-11 w-full rounded-xl border bg-card px-3 text-sm">
              <option value="">{t("practice.allSets")}</option>
              {sets.map((entry) => <option key={entry.id} value={entry.id}>{entry.setName}</option>)}
            </select>
          </FieldLabel>
          {mode === "questions" && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <FieldLabel label={t("practice.questionType")}>
                <select value={questionType} onChange={(event) => onQuestionTypeChange(event.target.value as WorkspaceQuestionType)} className="h-11 w-full rounded-xl border bg-card px-3 text-sm">
                  <option value="all">{t("practice.allQuestionTypes")}</option>
                  <option value="standard">{t("questions.standard")}</option>
                  <option value="fillBlank">{t("questions.fillBlank")}</option>
                  <option value="reading">{t("questions.reading")}</option>
                </select>
              </FieldLabel>
              <FieldLabel label={t("practice.difficulty")}>
                <select value={difficulty} onChange={(event) => onDifficultyChange(event.target.value as WorkspaceQuestionDifficulty)} className="h-11 w-full rounded-xl border bg-card px-3 text-sm">
                  <option value="all">{t("practice.allDifficulties")}</option>
                  {[1, 2, 3].map((value) => <option key={value} value={value}>{t("questions.difficulty", { level: value })}</option>)}
                </select>
              </FieldLabel>
            </div>
          )}
          <FieldLabel label={t("practice.amount")} className="mt-4">
            <select value={amount} onChange={(event) => onAmountChange(Number(event.target.value))} className="h-11 w-full rounded-xl border bg-card px-3 text-sm">
              {[5, 10, 20, 30].map((value) => <option key={value}>{value}</option>)}
            </select>
          </FieldLabel>
          <div className="mt-6 border-t pt-5">
            <p className="text-center text-sm text-muted-foreground">
              {availableCount ? t(mode === "review" ? "practice.availableWords" : "practice.available", { count: availableCount }) : t("practice.noContent")}
            </p>
            {availableCount ? (
              <Button className="mt-3 h-10 w-full" onClick={onBegin}>{t("practice.begin")}</Button>
            ) : (
              <Button asChild className="mt-3 h-10 w-full">
                <Link href={emptyHref}>{!hasWords && <Plus className="size-4" />}{mode === "questions" && hasWords && <Sparkles className="size-4" />}{emptyLabel}</Link>
              </Button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function FieldLabel({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return <label className={`block ${className}`}><span className="mb-2 block text-xs font-semibold text-muted-foreground">{label}</span>{children}</label>;
}

function Choice({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[.98] ${active ? "bg-card text-foreground shadow-[var(--shadow-control)]" : "text-muted-foreground hover:text-foreground"}`}
    >
      {label}
    </button>
  );
}

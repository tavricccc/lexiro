"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { StaggerItem, StaggerList } from "@/components/motion/stagger";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icons } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/page-state";
import { QuestionListSkeleton } from "@/components/ui/workspace-skeleton";
import { SelectField } from "@/components/ui/select-field";
import { t } from "@/lib/i18n";
import {
  difficultyOptions,
  questionFormatLabel,
  questionFormatOptions,
} from "@/lib/question-options";
import { useLibraryStore } from "@/stores/library-store";

export function questionEditHref(question: { id: string; kind: string }) {
  return question.kind === "reading"
    ? `/questions/reading/${question.id}/edit`
    : `/questions/${question.id}/edit`;
}

/**
 * The question bank, as a section of 我的單字 rather than a page of its own.
 *
 * Questions are made of the learner's own words and only make sense beside
 * them, so they are a second view of the same library instead of a fifth
 * destination competing for a slot in the navigation.
 */
export function QuestionList() {
  const { state, status, deleteQuestion } = useLibraryStore();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const questions = useMemo(
    () =>
      state.questions.filter((question) => {
        const type =
          question.kind === "reading"
            ? question.format
            : question.questionStyle;
        if (kind !== "all" && type !== kind) return false;
        if (difficulty !== "all" && question.difficulty !== Number(difficulty))
          return false;
        const text =
          question.kind === "reading"
            ? `${question.title} ${question.passage}`
            : question.prompt;
        return text
          .toLocaleLowerCase()
          .includes(query.trim().toLocaleLowerCase());
      }),
    [difficulty, kind, query, state.questions],
  );

  // Only the formats the bank actually holds are worth offering: a filter that
  // can only ever return nothing is not a choice.
  const presentFormats = useMemo(
    () =>
      new Set<string>(
        state.questions.map((question) =>
          question.kind === "reading"
            ? question.format
            : question.questionStyle,
        ),
      ),
    [state.questions],
  );
  useEffect(() => {
    if (kind !== "all" && !presentFormats.has(kind)) setKind("all");
  }, [kind, presentFormats]);

  const filtering =
    Boolean(query.trim()) || kind !== "all" || difficulty !== "all";

  return (
    <div>
      {state.questions.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_9rem]">
          <label className="relative block">
            <Icons.search
              aria-hidden
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              className="pl-10"
              placeholder={t("questions.search")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <SelectField
            ariaLabel={t("questions.type")}
            onValueChange={setKind}
            options={questionFormatOptions(t("questions.allTypes"), presentFormats)}
            value={kind}
          />
          <SelectField
            ariaLabel={t("practice.difficulty")}
            onValueChange={setDifficulty}
            options={difficultyOptions(t("practice.allDifficulties"))}
            value={difficulty}
          />
        </div>
      )}

      <div className="mt-5">
        {status === "loading" && <QuestionListSkeleton />}
        {status === "ready" &&
          questions.length === 0 &&
          (filtering ? (
            <EmptyState
              variant="filtered"
              title={t("questions.noResults")}
              description={t("questions.noResultsDescription")}
            />
          ) : (
            <EmptyState
              headword="quiz"
              pos="n."
              title={t("questions.empty")}
              description={t("questions.emptyDescription")}
              action={
                <Button asChild>
                  <Link href="/questions/generate">
                    <Icons.generate />
                    {t("questions.generate")}
                  </Link>
                </Button>
              }
            />
          ))}
        {questions.length > 0 && (
          <StaggerList
            as="ul"
            className="rule-card rule-list"
            data-resize-motion=""
          >
            {questions.map((question) => {
              const type = questionFormatLabel(
                question.kind === "reading"
                  ? question.format
                  : question.questionStyle,
              );
              return (
                <StaggerItem
                  as="li"
                  className="flex items-start gap-4 py-5"
                  key={question.id}
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {type}
                      </span>
                      <span>
                        {t("questions.difficulty", {
                          level: question.difficulty,
                        })}
                      </span>
                    </p>
                    <Link
                      className="mt-1.5 block font-medium leading-6 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                      href={questionEditHref(question)}
                    >
                      {question.kind === "reading"
                        ? question.title
                        : question.prompt}
                    </Link>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("questions.delete")}
                    onClick={() => setDeleteTarget(question.id)}
                  >
                    <Icons.delete />
                  </Button>
                </StaggerItem>
              );
            })}
          </StaggerList>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={t("questions.delete")}
        description={t("questions.deleteConfirm")}
        confirmLabel={t("questions.delete")}
        onConfirm={async () => {
          if (deleteTarget) await deleteQuestion(deleteTarget);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icons } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { Menu } from "@/components/ui/menu";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, LoadingState } from "@/components/ui/page-state";
import { SelectField } from "@/components/ui/select-field";
import { t } from "@/lib/i18n";
import {
  difficultyOptions,
  questionFormatLabel,
  questionFormatOptions,
} from "@/lib/question-options";
import { useLibraryStore } from "@/stores/library-store";

export function QuestionsPage() {
  const router = useRouter();
  const { state, status, deleteQuestion } = useLibraryStore();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const questions = useMemo(
    () =>
      state.questions.filter((question) => {
        const type =
          question.kind === "reading" ? question.format : question.questionStyle;
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

  const filtering = Boolean(query.trim()) || kind !== "all" || difficulty !== "all";

  return (
    <div>
      <PageHeader
        title={t("questions.title")}
        description={t("questions.description")}
        actions={
          <>
            <Button asChild>
              <Link href="/questions/generate">
                <Icons.generate />
                {t("questions.generate")}
              </Link>
            </Button>
            <Menu
              actions={[
                {
                  icon: Icons.create,
                  label: t("questions.manualAddSingle"),
                  onSelect: () => router.push("/questions/new"),
                },
                {
                  icon: Icons.reading,
                  label: t("questions.manualAddReading"),
                  onSelect: () => router.push("/questions/reading/new"),
                },
              ]}
              label={t("questions.manualAdd")}
            />
          </>
        }
      />

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
          options={questionFormatOptions(t("questions.allTypes"))}
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

      <div className="mt-6">
        {status === "loading" && <LoadingState />}
        {status === "ready" && questions.length === 0 && (
          filtering ? (
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
          )
        )}
        {questions.length > 0 && (
          <ul className="divide-y border-y">
            {questions.map((question) => {
              const type = questionFormatLabel(
                question.kind === "reading"
                  ? question.format
                  : question.questionStyle,
              );
              return (
                <li className="flex items-start gap-4 py-5" key={question.id}>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{type}</span>
                      <span>
                        {t("questions.difficulty", {
                          level: question.difficulty,
                        })}
                      </span>
                    </p>
                    <Link
                      className="mt-1.5 block font-medium leading-6 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                      href={
                        question.kind === "reading"
                          ? `/questions/reading/${question.id}/edit`
                          : `/questions/${question.id}/edit`
                      }
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
                </li>
              );
            })}
          </ul>
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

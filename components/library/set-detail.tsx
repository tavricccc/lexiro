"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { WordEntry, type EntrySense } from "@/components/library/word-entry";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icons } from "@/components/ui/icons";
import { LiquidTabs } from "@/components/ui/liquid-tabs";
import { Menu } from "@/components/ui/menu";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, LoadingState } from "@/components/ui/page-state";
import { t } from "@/lib/i18n";
import { useLibraryStore } from "@/stores/library-store";
import { useLearningStore } from "@/stores/learning-store";
import { UNCATEGORIZED_FOLDER_ID } from "@/src/lib/folders";
import { isDue, isLeech } from "@/src/lib/fsrs";
import { questionBelongsToMemberships } from "@/src/lib/question-ownership";
import { createSetSharePayload, downloadSetShare } from "@/src/lib/set-share";

type WordFilter = "all" | "due" | "leech";

export function SetDetail({ setId }: { setId: string }) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [wordFilter, setWordFilter] = useState<WordFilter>("all");
  const { state, status, deleteSet } = useLibraryStore();
  const progress = useLearningStore((store) => store.progress);
  const current = state.sets.find((entry) => entry.id === setId);

  const entries = useMemo(() => {
    return (state.memberships[setId] ?? []).flatMap((membership) => {
      const word = state.words[membership.wordKey];
      if (!word) return [];
      const senses = membership.senseIds.flatMap((senseId) => {
        const sense = word.senses.find((entry) => entry.id === senseId);
        if (!sense) return [];
        const card = progress.cards[sense.id] ?? null;
        return [
          {
            citation: sense.examples[0],
            due: Boolean(card && isDue(card)),
            id: sense.id,
            leech: isLeech(card),
            learned: Boolean(card),
            meaning: sense.meaningZh,
            pos: sense.pos,
          },
        ];
      });
      return senses.length ? [{ headword: word.word, senses }] : [];
    });
  }, [progress.cards, setId, state.memberships, state.words]);

  const allSenses = entries.flatMap((entry) => entry.senses);
  const learned = allSenses.filter((sense) => sense.learned).length;
  const due = allSenses.filter((sense) => sense.due).length;
  const leeches = allSenses.filter((sense) => sense.leech).length;

  const memberships = state.memberships[setId] ?? [];
  const questions = state.questions.filter((question) =>
    questionBelongsToMemberships(question, memberships),
  );

  const filtered = entries
    .map((entry) => ({
      ...entry,
      senses: entry.senses.filter((sense) =>
        wordFilter === "due"
          ? sense.due
          : wordFilter === "leech"
            ? sense.leech
            : true,
      ),
    }))
    .filter((entry) => entry.senses.length > 0);

  const libraryHref =
    current?.folderId && current.folderId !== UNCATEGORIZED_FOLDER_ID
      ? `/library?folderId=${encodeURIComponent(current.folderId)}`
      : "/library";

  if (status === "loading") return <LoadingState />;
  if (!current)
    return (
      <EmptyState
        title={t("setDetail.notFound")}
        description={t("setDetail.notFoundDescription")}
        action={
          <Button asChild>
            <Link href={libraryHref}>
              <Icons.back />
              {t("setDetail.back")}
            </Link>
          </Button>
        }
      />
    );

  const remove = async () => {
    setDeleting(true);
    await deleteSet(setId);
    router.push(libraryHref);
  };

  return (
    <div>
      <PageHeader
        title={current.setName}
        back={
          <Button asChild variant="ghost" size="sm">
            <Link href={libraryHref}>
              <Icons.back />
              {t("setDetail.back")}
            </Link>
          </Button>
        }
        actions={
          <>
            <Button asChild>
              <Link href={`/practice?mode=review&set=${setId}&start=1`}>
                <Icons.start />
                {t("setDetail.start")}
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={`/sets/${setId}/edit`}>
                <Icons.edit />
                {t("setDetail.edit")}
              </Link>
            </Button>
            <Menu
              actions={[
                {
                  icon: Icons.export,
                  label: t("setDetail.share"),
                  onSelect: () =>
                    downloadSetShare(createSetSharePayload(state, setId)),
                },
                {
                  icon: Icons.delete,
                  label: t("setDetail.delete"),
                  onSelect: () => setConfirmDelete(true),
                  tone: "destructive",
                },
              ]}
            />
          </>
        }
      />

      <dl className="rule-card grid max-w-lg grid-cols-2 gap-x-10 gap-y-4 py-5 sm:grid-cols-4">
        <Stat label={t("setDetail.senses")} value={allSenses.length} />
        <Stat label={t("setDetail.learned")} value={learned} />
        <Stat label={t("setDetail.due")} value={due} />
        <Stat label={t("setDetail.questions")} value={questions.length} />
      </dl>

      {entries.length === 0 ? (
        <EmptyState
          headword="lexicon"
          pos="n."
          title={t("setDetail.emptyWords")}
          description={t("setDetail.emptyWordsDescription")}
          action={
            <Button asChild>
              <Link href={`/sets/${setId}/edit`}>
                <Icons.create />
                {t("setEditor.addWord")}
              </Link>
            </Button>
          }
        />
      ) : (
        <section className="section-gap">
          <LiquidTabs
            ariaLabel={t("setDetail.words")}
            value={wordFilter}
            onValueChange={(value) => setWordFilter(value as WordFilter)}
            options={[
              { value: "all", label: t("setDetail.filterAll") },
              { value: "due", label: t("setDetail.filterDue") },
              {
                value: "leech",
                label: leeches
                  ? `${t("setDetail.filterLeech")} ${leeches}`
                  : t("setDetail.filterLeech"),
              },
            ]}
          />
          {filtered.length === 0 ? (
            <EmptyState
              variant="filtered"
              title={t("setDetail.filterEmpty")}
              description={t("setDetail.filterEmptyDescription")}
            />
          ) : (
            <div className="rule-card rule-list">
              {filtered.map((entry) => (
                <WordEntry
                  headword={entry.headword}
                  key={entry.headword}
                  senses={entry.senses as EntrySense[]}
                />
              ))}
            </div>
          )}
        </section>
      )}

      <section className="section-gap">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="type-section">
            {t("setDetail.questions")}
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href={`/questions/generate?set=${setId}`}>
                <Icons.generate />
                {t("setDetail.generateQuestions")}
              </Link>
            </Button>
            {questions.length > 0 && (
              <Button asChild variant="secondary" size="sm">
                <Link href={`/practice?mode=questions&set=${setId}&start=1`}>
                  <Icons.start />
                  {t("setDetail.startQuestions")}
                </Link>
              </Button>
            )}
          </div>
        </div>
        {questions.length ? (
          <ul className="mt-4 rule-card rule-list">
            {questions.map((question) => (
              <li key={question.id}>
                <Link
                  className="t-row block py-4 text-sm leading-6 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
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
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            variant="filtered"
            title={t("questions.empty")}
            description={t("setDetail.noQuestionsDescription")}
          />
        )}
      </section>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("setDetail.delete")}
        description={t("setDetail.deleteConfirm", { name: current.setName })}
        confirmLabel={t("setDetail.delete")}
        busy={deleting}
        onConfirm={remove}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-2xl font-medium tabular-nums">
        {value}
      </dd>
    </div>
  );
}

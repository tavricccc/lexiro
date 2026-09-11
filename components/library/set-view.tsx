"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { questionEditHref } from "@/components/questions/question-list";
import { StaggerItem, StaggerList } from "@/components/motion/stagger";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icons } from "@/components/ui/icons";
import { LiquidTabs } from "@/components/ui/liquid-tabs";
import { Menu } from "@/components/ui/menu";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/page-state";
import { LibraryListSkeleton } from "@/components/ui/workspace-skeleton";
import { t } from "@/lib/i18n";
import { questionFormatLabel } from "@/lib/question-options";
import { useLearningStore } from "@/stores/learning-store";
import { useLibraryStore } from "@/stores/library-store";
import { UNCATEGORIZED_FOLDER_ID } from "@/src/lib/folders";
import { isDue, isLeech } from "@/src/lib/fsrs";
import { questionBelongsToMemberships } from "@/src/lib/question-ownership";
import { createSetSharePayload, downloadSetShare } from "@/src/lib/set-share";
import type { CardProgress, SenseId, WordSense } from "@/types";

type SetTab = "words" | "questions";

interface ViewWord {
  wordKey: string;
  word: string;
  senses: WordSense[];
}

/**
 * A saved set is something you read before it is something you change.
 *
 * The page used to be the edit form itself, so every visit opened twenty input
 * fields whether or not anything needed fixing. Reading and editing are now two
 * states with one address between them: this is the quiet one, and 編輯 is a
 * deliberate step out of it.
 *
 * The questions built from the set sit in a tab beside the words rather than in
 * a section below them — they are the other half of the same material, not an
 * appendix to the word list.
 */
export function SetView({ setId }: { setId: string }) {
  const router = useRouter();
  const { state, status, deleteSet } = useLibraryStore();
  const cards = useLearningStore((store) => store.progress.cards);
  const [tab, setTab] = useState<SetTab>("words");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const current = state.sets.find((entry) => entry.id === setId);

  const words = useMemo<ViewWord[]>(
    () =>
      (state.memberships[setId] ?? []).flatMap((membership) => {
        const word = state.words[membership.wordKey];
        if (!word) return [];
        const senses = membership.senseIds.flatMap((senseId) => {
          const sense = word.senses.find((entry) => entry.id === senseId);
          return sense ? [sense] : [];
        });
        return senses.length
          ? [{ senses, word: word.word, wordKey: word.wordKey }]
          : [];
      }),
    [setId, state.memberships, state.words],
  );

  const senseIds = useMemo(
    () => words.flatMap((entry) => entry.senses.map((sense) => sense.id)),
    [words],
  );
  const learned = senseIds.filter((id) => cards[id]).length;
  const due = senseIds.filter((id) => {
    const card = cards[id];
    return card && isDue(card);
  }).length;

  const questions = useMemo(
    () =>
      state.questions.filter((question) =>
        questionBelongsToMemberships(question, state.memberships[setId] ?? []),
      ),
    [setId, state.memberships, state.questions],
  );

  const homeFolderId = current?.folderId;
  const libraryHref =
    homeFolderId && homeFolderId !== UNCATEGORIZED_FOLDER_ID
      ? `/library?folderId=${encodeURIComponent(homeFolderId)}`
      : "/library";

  if (status !== "ready") return <LibraryListSkeleton />;

  if (!current) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader back={<BackLink href={libraryHref} />} title={t("setDetail.missingTitle")} />
        <EmptyState
          variant="filtered"
          title={t("setDetail.missingTitle")}
          description={t("setDetail.missingDescription")}
        />
      </div>
    );
  }

  const removeSet = async () => {
    setDeleting(true);
    await deleteSet(setId);
    router.push(libraryHref);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        actions={
          <>
            <Button asChild>
              {/* The same two-way choice the home canvas offers, with this set
                  already filled in as the range. Starting from a set says which
                  material, not which kind of session. */}
              <Link href={`/practice?set=${setId}`}>
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
        back={<BackLink href={libraryHref} />}
        title={current.setName}
      />

      <dl className="mb-7 grid max-w-lg grid-cols-2 gap-x-10 gap-y-4 sm:grid-cols-4">
        <Stat label={t("setDetail.senses")} value={senseIds.length} />
        <Stat label={t("setDetail.learned")} value={learned} />
        <Stat label={t("setDetail.due")} value={due} />
        <Stat label={t("setDetail.questions")} value={questions.length} />
      </dl>

      <LiquidTabs
        ariaLabel={current.setName}
        className="mb-5"
        onValueChange={(value) => setTab(value as SetTab)}
        options={[
          {
            label: senseIds.length
              ? `${t("setDetail.wordsTab")} ${senseIds.length}`
              : t("setDetail.wordsTab"),
            value: "words",
          },
          {
            label: questions.length
              ? `${t("library.questionsTab")} ${questions.length}`
              : t("library.questionsTab"),
            value: "questions",
          },
        ]}
        value={tab}
      />

      {tab === "words" ? (
        words.length ? (
          <StaggerList as="ul" className="rule-card rule-list">
            {words.map((entry) => (
              <StaggerItem as="li" className="py-5" key={entry.wordKey}>
                <WordBlock cards={cards} entry={entry} />
              </StaggerItem>
            ))}
          </StaggerList>
        ) : (
          <EmptyState
            variant="filtered"
            title={t("setDetail.noWords")}
            description={t("setDetail.noWordsDescription")}
          />
        )
      ) : (
        <>
          {/* Making questions is what you come to this tab to do when it is
              empty and the obvious next step when it is not, so it is a control
              on the tab rather than a line in the page's overflow menu. */}
          <div className="mb-4 flex flex-wrap gap-2">
            <Button asChild size="sm" variant={questions.length ? "secondary" : "default"}>
              <Link href={`/questions/generate?set=${setId}`}>
                <Icons.generate />
                {t("setDetail.generateQuestions")}
              </Link>
            </Button>
            {questions.length > 0 && (
              <Button asChild size="sm" variant="ghost">
                <Link href={`/practice?track=questions&set=${setId}`}>
                  <Icons.start />
                  {t("setDetail.startQuestions")}
                </Link>
              </Button>
            )}
          </div>

          {questions.length ? (
            <StaggerList as="ul" className="rule-card rule-list">
              {questions.map((question) => (
                <StaggerItem as="li" className="py-5" key={question.id}>
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {questionFormatLabel(
                        question.kind === "reading"
                          ? question.format
                          : question.questionStyle,
                      )}
                    </span>
                    <span>
                      {t("questions.difficulty", { level: question.difficulty })}
                    </span>
                  </p>
                  <Link
                    className="mt-1.5 block font-medium leading-6 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                    href={questionEditHref(question)}
                  >
                    {question.kind === "reading" ? question.title : question.prompt}
                  </Link>
                </StaggerItem>
              ))}
            </StaggerList>
          ) : (
            <EmptyState
              variant="filtered"
              title={t("questions.empty")}
              description={t("setDetail.noQuestionsDescription")}
            />
          )}
        </>
      )}

      <ConfirmDialog
        busy={deleting}
        confirmLabel={t("setDetail.delete")}
        description={t("setDetail.deleteConfirm", { name: current.setName })}
        onConfirm={removeSet}
        onOpenChange={setConfirmDelete}
        open={confirmDelete}
        title={t("setDetail.delete")}
      />
    </div>
  );
}

function BackLink({ href }: { href: string }) {
  return (
    <Button asChild size="sm" variant="ghost">
      <Link href={href}>
        <Icons.back />
        {t("setDetail.back")}
      </Link>
    </Button>
  );
}

/**
 * One word, with every sense the set carries for it. Grouping by word is what
 * the form cannot do — it edits flat rows — and it is how the material is
 * actually shaped: one spelling, several meanings.
 */
function WordBlock({
  cards,
  entry,
}: {
  cards: Record<SenseId, CardProgress>;
  entry: ViewWord;
}) {
  return (
    <div>
      <h3 className="text-base font-medium">{entry.word}</h3>
      <dl className="mt-2 grid gap-3">
        {entry.senses.map((sense) => {
          const card = cards[sense.id] ?? null;
          return (
            <div key={sense.id}>
              <dt className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-sm">
                <span className="text-muted-foreground">{sense.pos}</span>
                <span className="font-medium">{sense.meaningZh}</span>
                {card && isDue(card) && (
                  <span className="text-xs text-brand-600">
                    {t("setDetail.dueBadge")}
                  </span>
                )}
                {isLeech(card) && (
                  <span className="text-xs text-destructive">
                    {t("setDetail.leechBadge")}
                  </span>
                )}
              </dt>
              {sense.examples.length > 0 && (
                <dd className="mt-1.5 grid gap-1">
                  {sense.examples.map((example) => (
                    <p className="type-lead" key={example}>
                      {example}
                    </p>
                  ))}
                </dd>
              )}
            </div>
          );
        })}
      </dl>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-2xl font-medium tabular-nums">{value}</dd>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { questionEditHref } from "@/components/questions/question-list";
import { StaggerItem, StaggerList } from "@/components/motion/stagger";
import { BackControl } from "@/components/ui/back-control";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icons } from "@/components/ui/icons";
import { LiquidTabs } from "@/components/ui/liquid-tabs";
import { ListNavRow, ListSection } from "@/components/ui/list";
import { Menu } from "@/components/ui/menu";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/page-state";
import { LibraryListSkeleton } from "@/components/ui/workspace-skeleton";
import { t } from "@/lib/i18n";
import { questionFormatLabel } from "@/lib/question-options";
import { useLearningStore } from "@/stores/learning-store";
import { useLibraryStore } from "@/stores/library-store";
import { UNCATEGORIZED_FOLDER_ID } from "@/src/lib/folders";
import { isDue } from "@/src/lib/fsrs";
import { questionBelongsToMemberships } from "@/src/lib/question-ownership";
import { createSetSharePayload, downloadSetShare } from "@/src/lib/set-share";
import { SetWordRow, type ViewWord } from "@/components/library/set-word-row";
import { SetTools } from "@/components/library/set-tools";

type SetTab = "words" | "questions";


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
        <PageHeader
          back={<BackControl href={libraryHref} label={t("setDetail.back")} />}
          title={t("setDetail.missingTitle")}
        />
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
        back={<BackControl href={libraryHref} label={t("setDetail.back")} />}
        title={current.setName}
      />

      {/* Four big numbers were a dashboard on top of a word list. They are the
          page's subtitle, so they read as one line of it. */}
      <p className="-mt-2 mb-6 text-sm tabular-nums text-muted-foreground">
        {t("setDetail.summary", {
          senses: senseIds.length,
          learned,
          due,
          questions: questions.length,
        })}
      </p>

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
        <div className="space-y-7">
          {words.length ? (
            <StaggerList as="ul" className="rule-card rule-list">
              {words.map((entry) => (
                <StaggerItem as="li" className="py-5" key={entry.wordKey}>
                  <SetWordRow cards={cards} entry={entry} setId={setId} />
                </StaggerItem>
              ))}
            </StaggerList>
          ) : (
            <EmptyState
              variant="filtered"
              title={t("setDetail.noWords")}
              description={t("setDetail.noWordsDescription")}
            />
          )}
          <SetTools setId={setId} />
        </div>
      ) : (
        <>
          {/* Making questions is what you come to this tab to do when it is
              empty and the obvious next step when it is not, so it is a control
              on the tab rather than a line in the page's overflow menu. */}
          <ListSection className="mb-5">
            {questions.length > 0 && (
              <ListNavRow
                href={`/practice?track=questions&set=${setId}`}
                icon={Icons.start}
                label={t("setDetail.startQuestions")}
                value={t("home.questionCount", { count: questions.length })}
              />
            )}
            <ListNavRow
              href={`/questions/generate?set=${setId}`}
              icon={Icons.generate}
              label={t("setDetail.generateQuestions")}
            />
          </ListSection>

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

import Link from "@/components/ui/app-link";
import { useAppRouter as useRouter } from "@/lib/use-app-router";
import { useEffect, useMemo, useState } from "react";

import { ClearQuestionsControl } from "@/components/questions/clear-questions-control";
import { BackControl } from "@/components/ui/back-control";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { LiquidTabs } from "@/components/ui/liquid-tabs";
import { Menu } from "@/components/ui/menu";
import { useSetActions } from "@/components/library/set-actions";
import { PageHeader } from "@/components/ui/page-header";
import { SearchField } from "@/components/ui/search-field";
import { EmptyState } from "@/components/ui/page-state";
import { LibraryListSkeleton } from "@/components/ui/workspace-skeleton";
import { t } from "@/lib/i18n";
import { useLibraryStore } from "@/stores/library-store";
import { UNCATEGORIZED_FOLDER_ID } from "@/src/lib/folders";
import { compareWords } from "@/src/lib/library";
import {
  isExamQuestion,
  questionBelongsToMemberships,
} from "@/src/lib/question-ownership";
import type { ViewWord } from "@/components/library/set-word-row";
import {
  SetQuestionList,
  SetWordList,
} from "@/components/library/set-content-list";
import {
  questionMatchesQuery,
  wordMatchesQuery,
} from "@/src/lib/library-search";
import { SetTools } from "@/components/library/set-tools";
import { ContentTransition } from "@/components/motion/state-transition";
import { replaceBrowseHref, setBrowseHref } from "@/lib/browse-routes";

type SetTab = "words" | "questions" | "tools";

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
export function SetView({
  setId,
  returnTo,
  initialTab = "words",
  initialQuery = "",
}: {
  setId: string;
  returnTo?: string;
  initialTab?: string;
  initialQuery?: string;
}) {
  const router = useRouter();
  // Called once the set is gone, so the page it leaves is already known.
  const { actionsFor, dialogs } = useSetActions(() =>
    router.push(libraryHref),
  );
  const { state, status } = useLibraryStore();
  const [tab, setTab] = useState<SetTab>(
    initialTab === "questions" || initialTab === "tools" ? initialTab : "words",
  );
  const [query, setQuery] = useState(initialQuery);

  const current = state.sets.find((entry) => entry.id === setId);

  const words = useMemo<ViewWord[]>(
    () =>
      (state.memberships[setId] ?? [])
        .flatMap((membership) => {
          const word = state.words[membership.wordKey];
          if (!word) return [];
          const senses = membership.senseIds.flatMap((senseId) => {
            const sense = word.senses.find((entry) => entry.id === senseId);
            return sense ? [sense] : [];
          });
          return senses.length
            ? [{ senses, word: word.word, wordKey: word.wordKey }]
            : [];
        })
        .sort((a, b) => compareWords(a.word, b.word)),
    [setId, state.memberships, state.words],
  );

  const senseIds = useMemo(
    () => words.flatMap((entry) => entry.senses.map((sense) => sense.id)),
    [words],
  );

  const savedQuestions = useMemo(
    () =>
      state.questions.filter((question) =>
        questionBelongsToMemberships(question, state.memberships[setId] ?? []),
      ),
    [setId, state.memberships, state.questions],
  );
  const questions = useMemo(
    () => savedQuestions.filter(isExamQuestion),
    [savedQuestions],
  );
  const needle = query.trim().toLocaleLowerCase();
  const visibleWords = useMemo(
    () => words.filter((word) => wordMatchesQuery(word, needle)),
    [words, needle],
  );
  const visibleQuestions = useMemo(
    () =>
      questions.filter((question) => questionMatchesQuery(question, needle)),
    [questions, needle],
  );
  const filtering = Boolean(needle);

  const homeFolderId = current?.folderId;
  const libraryHref =
    returnTo ??
    (homeFolderId && homeFolderId !== UNCATEGORIZED_FOLDER_ID
      ? `/app/library?folderId=${encodeURIComponent(homeFolderId)}`
      : "/app/library");
  const browseHref = setBrowseHref(setId, tab, returnTo, query);
  useEffect(() => {
    if (status === "ready") replaceBrowseHref(browseHref);
  }, [browseHref, status]);

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

  return (
    <div className="set-workspace mx-auto max-w-3xl">
      <PageHeader
        actions={
          <>
            <Menu actions={actionsFor(setId)} />
          </>
        }
        back={<BackControl href={libraryHref} label={t("setDetail.back")} />}
        title={current.setName}
      />

      {/* The set's size on the answer card's green, with the way in, as in the app. */}
      <section className="relative mb-5 grid gap-[1.125rem] overflow-hidden rounded-[var(--radius-stage)] bg-[#7cc49c] p-[1.375rem] text-[#13201a]">
        <span
          aria-hidden
          className="absolute -right-[5.25rem] -top-14 h-[7.5rem] w-[11.25rem] rounded-full bg-[#13201a]"
        />
        <div className="relative flex gap-8">
          {[
            [senseIds.length, t("library.senseUnit")],
            [questions.length, t("library.questionsTab")],
          ].map(([value, label]) => (
            <p key={label} className="grid">
              <span className="text-[3.5rem] font-extrabold leading-[3.625rem] tracking-[-0.045em] tabular-nums">
                {value}
              </span>
              <span className="type-section">{label}</span>
            </p>
          ))}
        </div>
        <div className="relative flex gap-2.5">
          <Button
            asChild
            size="lg"
            className="flex-1 bg-[#13201a]/10 text-[#13201a] hover:bg-[#13201a]/15"
          >
            <Link href={`/app/sets/${setId}/add`}>
              <Icons.create />
              {t("setEditor.addWord")}
            </Link>
          </Button>
          {senseIds.length > 0 ? (
            <Button
              asChild
              size="lg"
              className="flex-1 bg-[#13201a] text-[#f4f8f5] hover:bg-[#13201a]/90"
            >
              <Link href={`/app/practice?set=${setId}`}>
                <Icons.start />
                {t("setDetail.start")}
              </Link>
            </Button>
          ) : (
            <Button
              size="lg"
              disabled
              className="flex-1 bg-[#13201a] text-[#f4f8f5]"
            >
              <Icons.start />
              {t("setDetail.start")}
            </Button>
          )}
        </div>
      </section>

      <LiquidTabs
        ariaLabel={current.setName}
        className="workspace-tabs workspace-tabs-scroll mb-4"
        onValueChange={(value) => setTab(value as SetTab)}
        options={[
          {
            label: `${t("setDetail.wordsTab")} ${words.length}`,
            value: "words",
          },
          {
            label: `${t("library.questionsTab")} ${questions.length}`,
            value: "questions",
          },
          { label: t("workspace.toolsTab"), value: "tools" },
        ]}
        value={tab}
      />

      <ContentTransition identity={tab}>
        {tab !== "tools" && (
          <div className="mb-4 space-y-2">
            <SearchField
              label={t(
                tab === "words"
                  ? "setDetail.searchWords"
                  : "setDetail.searchQuestions",
              )}
              value={query}
              onValueChange={setQuery}
            />
            {filtering && (
              <p
                className="text-sm tabular-nums text-muted-foreground"
                role="status"
              >
                {t(
                  tab === "words"
                    ? "setDetail.wordSearchCount"
                    : "setDetail.questionSearchCount",
                  {
                    count:
                      tab === "words"
                        ? visibleWords.length
                        : visibleQuestions.length,
                    total: tab === "words" ? words.length : questions.length,
                  },
                )}
              </p>
            )}
          </div>
        )}
        {tab === "words" ? (
          <SetWordList
            words={visibleWords}
            setId={setId}
            returnTo={browseHref}
            filtering={filtering && words.length > 0}
            onClear={() => setQuery("")}
          />
        ) : tab === "tools" ? (
          <SetTools setId={setId} />
        ) : (
          <>
            <ClearQuestionsControl
              key={setId}
              questions={savedQuestions}
              setId={setId}
              setName={current.setName}
            />
            <SetQuestionList
              questions={visibleQuestions}
              setId={setId}
              returnTo={browseHref}
              filtering={filtering && questions.length > 0}
              onClear={() => setQuery("")}
            />
          </>
        )}
      </ContentTransition>

      {dialogs}
    </div>
  );
}

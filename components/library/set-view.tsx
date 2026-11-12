import { CopyToSetSheet } from "@/components/library/copy-to-set-sheet";
import type { WordKey } from "@/types";
import { PracticeLaunch } from "@/components/redesign/practice-launch";
import Link from "@/components/ui/app-link";
import { useAppRouter as useRouter } from "@/lib/use-app-router";
import { useEffect, useMemo, useState } from "react";

import { ClearQuestionsControl } from "@/components/questions/clear-questions-control";
import { BackControl } from "@/components/ui/back-control";
import { Icons } from "@/components/ui/icons";

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

import { ContentTransition } from "@/components/motion/state-transition";
import { replaceBrowseHref, setBrowseHref } from "@/lib/browse-routes";

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
  const [launch, setLaunch] = useState(false);
  // Called once the set is gone, so the page it leaves is already known.
  const { actionsFor, dialogs } = useSetActions(() => router.push(libraryHref));
  const { state, status } = useLibraryStore();
  const [tab, setTab] = useState<SetTab>(
    initialTab === "questions" ? initialTab : "words",
  );
  const [query, setQuery] = useState(initialQuery);
  const [starredOnly, setStarredOnly] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<WordKey>>(new Set());
  const [copyOpen, setCopyOpen] = useState(false);
  const setWordsStarred = useLibraryStore((s) => s.setWordsStarred);

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
    () =>
      words.filter(
        (word) =>
          wordMatchesQuery(word, needle) &&
          (!starredOnly || state.words[word.wordKey]?.starred),
      ),
    [words, needle, starredOnly, state.words],
  );
  const starCount = words.filter(
    (word) => state.words[word.wordKey]?.starred,
  ).length;
  const toggleSelect = (wordKey: WordKey) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(wordKey)) next.delete(wordKey);
      else next.add(wordKey);
      return next;
    });
  const endSelect = () => {
    setSelecting(false);
    setSelected(new Set());
  };
  const allVisibleSelected =
    visibleWords.length > 0 &&
    visibleWords.every((word) => selected.has(word.wordKey));
  const visibleQuestions = useMemo(
    () =>
      questions.filter((question) => questionMatchesQuery(question, needle)),
    [questions, needle],
  );
  const filtering = Boolean(needle) || starredOnly;

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
        title=""
      />

      <section className={`cover hue-${current.hue ?? "mint"}`}>
        <div className="between">
          <h1>{current.setName}</h1>
        </div>
        <div className="facts">
          {[
            [words.length, t("redesign.words")],
            [questions.length, t("library.questionsTab")],
            [starCount, t("setDetail.starred")],
          ].map(([n, label]) => (
            <div key={label}>
              <b>{n}</b>
              <span>{label}</span>
            </div>
          ))}
        </div>
        <div className="hero-acts">
          <Link
            className="btn btn-lg btn-ink"
            href={`/app/practice?set=${setId}`}
            onClick={(e) => {
              e.preventDefault();
              setLaunch(true);
            }}
          >
            <Icons.start />
            {t("setDetail.start")}
          </Link>
          <Link className="btn btn-lg btn-veil" href={`/app/sets/${setId}/add`}>
            <Icons.create />
            {t("setEditor.addWord")}
          </Link>
        </div>
      </section>
      <PracticeLaunch
        open={launch}
        onClose={() => setLaunch(false)}
        setId={setId}
      />

      <div className="set-toolbar">
        <div className="tabs" role="tablist" aria-label={current.setName}>
          {(["words", "questions"] as const).map((value) => (
            <button
              key={value}
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
            >
              {t(
                value === "words"
                  ? "setDetail.wordsTab"
                  : "library.questionsTab",
              )}
            </button>
          ))}
        </div>
        <SearchField
          label={t(
            tab === "words"
              ? "setDetail.searchWords"
              : "setDetail.searchQuestions",
          )}
          value={query}
          onValueChange={setQuery}
        />
        {tab === "words" && words.length > 0 && (
          <>
            <button
              type="button"
              className="chip"
              aria-pressed={starredOnly}
              onClick={() => setStarredOnly((value) => !value)}
            >
              {t("setDetail.starredOnly")}
            </button>
            <button
              type="button"
              className="chip"
              aria-pressed={selecting}
              onClick={() => (selecting ? endSelect() : setSelecting(true))}
            >
              {t(
                selecting ? "setDetail.cancelSelect" : "setDetail.selectWords",
              )}
            </button>
          </>
        )}
      </div>
      <ContentTransition identity={tab}>
        {tab === "words" ? (
          <SetWordList
            words={visibleWords}
            setId={setId}
            returnTo={browseHref}
            filtering={filtering && words.length > 0}
            onClear={() => {
              setQuery("");
              setStarredOnly(false);
            }}
            selectable={selecting}
            selectedKeys={selected}
            onToggleSelect={toggleSelect}
          />
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

      {selecting && tab === "words" && (
        <div className="selection-bar frost" role="toolbar">
          <span className="latin">
            {t("setDetail.selectedCount", { count: selected.size })}
          </span>
          <button
            type="button"
            className="btn btn-veil"
            onClick={() =>
              setSelected(
                allVisibleSelected
                  ? new Set()
                  : new Set(visibleWords.map((word) => word.wordKey)),
              )
            }
          >
            {t(
              allVisibleSelected
                ? "setDetail.clearSelection"
                : "setDetail.selectAll",
            )}
          </button>
          <button
            type="button"
            className="btn btn-veil"
            onClick={() =>
              setSelected(
                new Set(
                  words
                    .filter((word) => state.words[word.wordKey]?.starred)
                    .map((word) => word.wordKey),
                ),
              )
            }
          >
            {t("setDetail.selectStarred")}
          </button>
          <button
            type="button"
            className="btn btn-veil"
            disabled={!selected.size}
            onClick={() => void setWordsStarred([...selected], true)}
          >
            {t("setDetail.starSelected")}
          </button>
          <button
            type="button"
            className="btn btn-veil"
            disabled={!selected.size}
            onClick={() => void setWordsStarred([...selected], false)}
          >
            {t("setDetail.unstarSelected")}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!selected.size}
            onClick={() => setCopyOpen(true)}
          >
            {t("setDetail.copyToSet")}
          </button>
        </div>
      )}
      <CopyToSetSheet
        open={copyOpen}
        onClose={() => setCopyOpen(false)}
        sourceSetId={setId}
        wordKeys={[...selected]}
        onCopied={() => {
          setCopyOpen(false);
          endSelect();
        }}
      />

      {dialogs}
    </div>
  );
}

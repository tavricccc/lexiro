import Link from "@/components/ui/app-link";
import { useEffect, useRef, useState } from "react";

import { SetWordRow, type ViewWord } from "./set-word-row";
import { StaggerItem, StaggerList } from "@/components/motion/stagger";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { EmptyState } from "@/components/ui/page-state";
import { withReturnTo } from "@/lib/browse-routes";
import { t } from "@/lib/i18n";
import { questionFormatLabel } from "@/lib/question-options";
import type { LibraryQuestion } from "@/types";

const PAGE = 60;

/**
 * A long set is drawn 60 rows at a time, as in the app; the next rows come
 * in as the end scrolls into view, or from the button under them. A new
 * search or a changed list starts again from the top.
 */
function usePaged<T>(items: T[]) {
  const [page, setPage] = useState({ items, count: PAGE });
  if (page.items !== items) setPage({ items, count: PAGE });
  const count = page.items === items ? page.count : PAGE;
  const more = () =>
    setPage((current) => ({ ...current, count: current.count + PAGE }));
  return { shown: items.slice(0, count), rest: items.length - count, more };
}

function MoreRows({ rest, onMore }: { rest: number; onMore: () => void }) {
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = sentinel.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => entries.some((entry) => entry.isIntersecting) && onMore(),
      { rootMargin: "400px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [onMore]);
  if (rest <= 0) return null;
  return (
    <div className="mt-3 flex justify-center" ref={sentinel}>
      <Button onClick={onMore} type="button" variant="ghost">
        {t("setDetail.showMore", { count: rest })}
      </Button>
    </div>
  );
}

interface SearchState {
  filtering: boolean;
  onClear: () => void;
}

function SearchEmpty({ onClear }: Pick<SearchState, "onClear">) {
  return (
    <EmptyState
      variant="filtered"
      title={t("setDetail.noSearchResults")}
      description={t("setDetail.noSearchResultsHint")}
      action={
        <Button variant="outline" onClick={onClear}>
          <Icons.cancel />
          {t("common.clearSearch")}
        </Button>
      }
    />
  );
}

export function SetWordList({
  words,
  setId,
  returnTo,
  filtering,
  onClear,
}: SearchState & {
  words: ViewWord[];
  setId: string;
  returnTo: string;
}) {
  const { shown, rest, more } = usePaged(words);
  if (!words.length)
    return filtering ? (
      <SearchEmpty onClear={onClear} />
    ) : (
      <EmptyState
        variant="filtered"
        title={t("setDetail.noWords")}
        description={t("setDetail.noWordsDescription")}
      />
    );

  return (
    <>
      <StaggerList as="ul" className="rule-card rule-list">
        {shown.map((entry) => (
          <StaggerItem as="li" key={entry.wordKey}>
            <SetWordRow entry={entry} setId={setId} returnTo={returnTo} />
          </StaggerItem>
        ))}
      </StaggerList>
      <MoreRows rest={rest} onMore={more} />
    </>
  );
}

export function SetQuestionList({
  questions,
  setId,
  returnTo,
  filtering,
  onClear,
}: SearchState & {
  questions: LibraryQuestion[];
  setId: string;
  returnTo: string;
}) {
  const { shown, rest, more } = usePaged(questions);
  if (!questions.length)
    return filtering ? (
      <SearchEmpty onClear={onClear} />
    ) : (
      <EmptyState
        variant="filtered"
        title={t("questions.empty")}
        description={t("setDetail.noQuestionsDescription")}
      />
    );

  return (
    <>
      <StaggerList as="ul" className="rule-card rule-list">
        {shown.map((question) => (
          <StaggerItem as="li" key={question.id}>
            <Link
              className="t-row flex items-center gap-3 py-[0.8125rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              href={withReturnTo(
                `/app/sets/${setId}/questions/${encodeURIComponent(question.id)}`,
                returnTo,
              )}
            >
              <span className="grid min-w-0 flex-1 gap-1">
                <span className="type-hint text-muted-foreground">
                  <span className="font-semibold text-brand">
                    {questionFormatLabel(
                      question.kind === "reading"
                        ? question.format
                        : question.questionStyle,
                    )}
                  </span>
                  {" · "}
                  {t("questions.difficulty", { level: question.difficulty })}
                  {question.kind === "reading" &&
                    ` · ${t("library.questionCount", { count: question.questions.length })}`}
                </span>
                <span className="line-clamp-3 text-[1.0625rem] font-semibold leading-6">
                  {question.kind === "reading"
                    ? question.title
                    : question.prompt}
                </span>
                {question.kind === "reading" && question.title && (
                  <span className="type-hint line-clamp-2 text-muted-foreground">
                    {question.passage}
                  </span>
                )}
              </span>
              <Icons.open
                aria-hidden
                className="size-3.5 shrink-0 text-muted-foreground/60"
              />
            </Link>
          </StaggerItem>
        ))}
      </StaggerList>
      <MoreRows rest={rest} onMore={more} />
    </>
  );
}

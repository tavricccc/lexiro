import Link from "@/components/ui/app-link";

import { SetWordRow, type ViewWord } from "./set-word-row";
import { StaggerItem, StaggerList } from "@/components/motion/stagger";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { EmptyState } from "@/components/ui/page-state";
import { questionEditHref } from "@/components/questions/question-list";
import { t } from "@/lib/i18n";
import { questionFormatLabel } from "@/lib/question-options";
import type { LibraryQuestion } from "@/types";

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
    <StaggerList as="ul" className="rule-card rule-list">
      {words.map((entry) => (
        <StaggerItem as="li" key={entry.wordKey}>
          <SetWordRow entry={entry} setId={setId} returnTo={returnTo} />
        </StaggerItem>
      ))}
    </StaggerList>
  );
}

export function SetQuestionList({
  questions,
  returnTo,
  filtering,
  onClear,
}: SearchState & { questions: LibraryQuestion[]; returnTo: string }) {
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
    <StaggerList as="ul" className="rule-card rule-list">
      {questions.map((question) => (
        <StaggerItem as="li" key={question.id}>
          <Link
            className="t-row flex items-center gap-3 py-[0.8125rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            href={questionEditHref(question, returnTo)}
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
                {question.kind === "reading" ? question.title : question.prompt}
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
  );
}

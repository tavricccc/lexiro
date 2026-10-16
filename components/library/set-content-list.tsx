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
        <StaggerItem
          as="li"
          className="py-[var(--row-padding-block)]"
          key={entry.wordKey}
        >
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
        <StaggerItem
          as="li"
          className="py-[var(--row-padding-block)]"
          key={question.id}
        >
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
            href={questionEditHref(question, returnTo)}
          >
            {question.kind === "reading" ? question.title : question.prompt}
          </Link>
        </StaggerItem>
      ))}
    </StaggerList>
  );
}

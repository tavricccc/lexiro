import { useMemo, useState } from "react";

import Link from "@/components/ui/app-link";
import { BackControl } from "@/components/ui/back-control";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { EmptyState } from "@/components/ui/page-state";
import { PageHeader } from "@/components/ui/page-header";
import { StepActions } from "@/components/ui/step-actions";
import { QuestionCard } from "@/components/practice/question-card";
import { buildQuestionGroups } from "@/components/practice/practice-content";
import type { AnsweredBlank } from "@/components/practice/passage-view";
import { questionEditHref } from "@/components/questions/question-list";
import { t } from "@/lib/i18n";
import { useLibraryStore } from "@/stores/library-store";

/**
 * One saved question to answer on its own, straight from the set's list, as
 * in the app. It is a try, not a practice session: nothing is scheduled or
 * saved, so an unfinished session elsewhere is left as it was.
 */
export function QuestionTryPage({
  setId,
  questionId,
  returnHref,
}: {
  setId: string;
  questionId: string;
  returnHref?: string;
}) {
  const state = useLibraryStore((store) => store.state);
  const question = state.questions.find((entry) => entry.id === questionId);
  // A passage brings one item per blank or question, answered in turn.
  const items = useMemo(
    () =>
      question ? (buildQuestionGroups([question], state.words)[0] ?? []) : [],
    [question, state.words],
  );
  const [index, setIndex] = useState(0);
  const [choices, setChoices] = useState<Record<string, number>>({});
  const [pending, setPending] = useState<{ id: string; choice: number } | null>(
    null,
  );
  const backHref = returnHref ?? `/app/sets/${setId}?tab=questions`;
  const item = items[index];

  if (!question || !item)
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader back={<BackControl href={backHref} />} title="" />
        <EmptyState
          variant="filtered"
          title={t("common.loadFailed")}
          description={t("setDetail.missingDescription")}
        />
      </div>
    );

  const selected = choices[item.id] ?? null;
  const answered = selected !== null;
  const last = index === items.length - 1;
  const pendingChoice = pending?.id === item.id ? pending.choice : null;
  // Blanks answered earlier in this passage show their answer in the text.
  const answeredBlanks: Record<number, AnsweredBlank> = {};
  for (const other of items)
    if (other.blank && choices[other.id] != null)
      answeredBlanks[other.blank] = {
        answer: other.options[other.answerIndex],
      };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={<BackControl href={backHref} />}
        title=""
        actions={
          <Button asChild size="icon" variant="glass">
            <Link
              aria-label={t("setDetail.edit")}
              href={questionEditHref(question, backHref)}
            >
              <Icons.edit />
            </Link>
          </Button>
        }
      />
      <QuestionCard
        key={item.id}
        item={item}
        selected={selected}
        pendingChoice={pendingChoice}
        readOnly={false}
        answeredBlanks={answeredBlanks}
        onAnswer={(choice) => {
          if (!answered) setPending({ id: item.id, choice });
        }}
      />
      <StepActions width="wide">
        {!answered ? (
          <Button
            size="lg"
            disabled={pendingChoice === null}
            onClick={() => {
              if (pendingChoice === null) return;
              setPending(null);
              setChoices((current) => ({ ...current, [item.id]: pendingChoice }));
            }}
          >
            <Icons.success />
            {t("practice.confirm")}
          </Button>
        ) : last ? (
          <Button
            size="lg"
            variant="outline"
            onClick={() => {
              setChoices({});
              setIndex(0);
            }}
          >
            <Icons.retry />
            再做一次
          </Button>
        ) : (
          <Button size="lg" onClick={() => setIndex(index + 1)}>
            {t("practice.next")}
            <Icons.next />
          </Button>
        )}
      </StepActions>
    </div>
  );
}

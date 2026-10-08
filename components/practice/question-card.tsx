"use client";

import { useId, useState } from "react";
import type { QuestionItem } from "@/components/practice/practice-content";
import {
  PassageView,
  type AnsweredBlank,
} from "@/components/practice/passage-view";
import { Button } from "@/components/ui/button";
import { LiquidTabs } from "@/components/ui/liquid-tabs";
import { Icons } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { QuestionOptions } from "./question-options";
import { QuestionFeedback } from "./question-feedback";

export function QuestionCard({
  item,
  selected,
  pendingChoice,
  busy,
  answeredBlanks,
  onAnswer,
}: {
  item: QuestionItem;
  selected: number | null;
  pendingChoice: number | null;
  busy: boolean;
  answeredBlanks: Record<number, AnsweredBlank>;
  onAnswer: (choice: number) => void;
}) {
  const [mobileView, setMobileView] = useState("question");
  const blankId = useId();
  const panelIds = {
    passage: `${blankId}-passage`,
    question: `${blankId}-question`,
  };
  const passage = item.question?.kind === "reading" ? item.question : null;
  const childIndex = passage?.questions.findIndex(
    (child) => item.id === `reading:${passage.id}:${child.id}`,
  );
  const locateBlank = () => {
    setMobileView("passage");
    requestAnimationFrame(() => {
      document
        .getElementById(blankId)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  };

  return (
    <div>
      {passage && (
        <LiquidTabs
          className="mb-5 w-full lg:hidden [&_.t-tabs]:flex [&_.t-tabs]:w-full [&_.t-tab]:flex-1"
          ariaLabel={t("practice.passageTab")}
          value={mobileView}
          onValueChange={setMobileView}
          panelIds={panelIds}
          options={[
            {
              value: "question",
              label: t("practice.questionTab"),
              icon: <Icons.practice className="size-4" />,
            },
            {
              value: "passage",
              label: t("practice.passageTab"),
              icon: <Icons.reading className="size-4" />,
            },
          ]}
        />
      )}
      <div
        className={
          passage
            ? "grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)] lg:gap-8"
            : undefined
        }
      >
        {passage && (
          <section
            id={panelIds.passage}
            role="tabpanel"
            aria-label={t("questions.passageSection")}
            className={cn(
              "min-w-0 rounded-[var(--radius-card)] bg-card p-5 sm:p-6 lg:sticky lg:top-28",
              mobileView !== "passage" && "hidden lg:block",
            )}
          >
            <h2 className="question-text mb-4 text-base font-semibold leading-6">
              {passage.title}
            </h2>
            <div
              tabIndex={0}
              className={cn(
                "overflow-y-auto overscroll-contain pr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 lg:max-h-[calc(100dvh-17rem)]",
                selected === null
                  ? "max-h-[max(12rem,calc(100dvh-25rem))]"
                  : "max-h-[max(12rem,calc(100dvh-29rem))]",
              )}
            >
              <PassageView
                activeBlank={item.blank}
                activeBlankId={blankId}
                answeredBlanks={answeredBlanks}
                passage={passage.passage}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              className="mt-4 min-h-11 w-full lg:hidden"
              onClick={() => setMobileView("question")}
            >
              <Icons.practice />
              {t("practice.backToQuestion")}
            </Button>
          </section>
        )}
        <section
          id={passage ? panelIds.question : undefined}
          role={passage ? "tabpanel" : undefined}
          aria-label={t("practice.questionTab")}
          className={cn(
            "min-w-0",
            passage && mobileView !== "question" && "hidden lg:block",
          )}
        >
          {passage && childIndex !== undefined && (
            <p className="mb-3 text-sm tabular-nums text-muted-foreground">
              {t("practice.questionPosition", {
                current: childIndex + 1,
                total: passage.questions.length,
              })}
            </p>
          )}
          <h1
            className={
              item.type === "meaning"
                ? "question-text type-page text-center"
                : "question-text text-lg font-semibold leading-8 tracking-[-0.01em]"
            }
          >
            {item.blank
              ? t("questions.blankLabel", { index: item.blank })
              : item.prompt}
          </h1>
          {item.blank && (
            <Button
              className="mt-2 min-h-11 lg:min-h-9"
              size="sm"
              variant="ghost"
              onClick={locateBlank}
            >
              <Icons.reading />
              {t("practice.locateBlank", { index: item.blank })}
            </Button>
          )}
          {item.optionBank && (
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {t("practice.sharedBankHint")}
            </p>
          )}
          <QuestionOptions
            item={item}
            selected={selected}
            pendingChoice={pendingChoice}
            busy={busy}
            onAnswer={onAnswer}
            answeredBlanks={answeredBlanks}
          />
          {busy && pendingChoice !== null && (
            <p role="status" className="mt-4 text-sm text-muted-foreground">
              {t("practice.recording")}
            </p>
          )}
          {selected !== null && (
            <QuestionFeedback item={item} selected={selected} />
          )}
        </section>
      </div>
    </div>
  );
}

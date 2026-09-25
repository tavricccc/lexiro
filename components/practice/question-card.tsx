"use client";

import { motion } from "motion/react";
import type { QuestionItem } from "@/components/practice/practice-content";
import { PassageView } from "@/components/practice/passage-view";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { StepActions } from "@/components/ui/step-actions";
import { t } from "@/lib/i18n";
import { timing } from "@/lib/motion-timing";
import { PracticeTaskLabel } from "@/components/practice/practice-task-label";

const practiceTransition = timing("control", "arrive");

export function QuestionCard({
  item,
  selected,
  busy,
  last,
  onAnswer,
  onNext,
}: {
  item: QuestionItem;
  selected: number | null;
  busy: boolean;
  last: boolean;
  onAnswer: (choice: number) => void;
  onNext: () => void;
}) {
  const answered = selected !== null;
  return (
    <>
      <section className="mt-5 rounded-2xl bg-muted/70 p-5 sm:p-7">
        {item.question.kind === "reading" ? (
          <div className="mb-6 rule-b pb-6">
            <PracticeTaskLabel task={item.type} />
            <PassageView
              activeBlank={item.blank}
              passage={item.question.passage}
            />
          </div>
        ) : (
          <PracticeTaskLabel task={item.type} />
        )}
        {/* A blank-format item has no question of its own -- the passage is the
          question, so the heading just says which blank is being filled. */}
        <h1 className="max-w-2xl text-[1.0625rem] font-semibold leading-7 tracking-[-0.01em] sm:text-lg">
          {item.blank
            ? t("questions.blankLabel", { index: item.blank })
            : item.prompt}
        </h1>
        {item.optionBank && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            {t("practice.sharedBankHint")}
          </p>
        )}
        {/* A 文意選填 bank runs to ten short words; ten full-width rows would push
          the passage off screen, so a wide bank goes two-up. */}
        <div
          className={`mt-6 grid gap-2.5${item.options.length > 5 ? " sm:grid-cols-2" : ""}`}
        >
          {item.options.map((option, optionIndex) => {
            const isCorrect = optionIndex === item.answerIndex;
            const isSelected = selected === optionIndex;
            const stateClass =
              answered && isCorrect
                ? "border-success/25 bg-success/10 text-foreground"
                : answered && isSelected
                  ? "border-destructive/30 bg-destructive/10 text-foreground"
                  : "border-border bg-card hover:border-foreground/20 hover:bg-card/80";
            const badgeClass =
              answered && isCorrect
                ? "bg-success text-success-foreground"
                : answered && isSelected
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-muted text-muted-foreground";
            return (
              <button
                key={optionIndex}
                type="button"
                disabled={answered || busy}
                onClick={() => onAnswer(optionIndex)}
                className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-sm font-medium transition-[background-color,border-color] duration-[var(--motion-control)] ease-[var(--ease-move)] disabled:cursor-default disabled:opacity-100 ${stateClass}`}
              >
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-lg text-xs font-semibold transition-colors duration-[var(--motion-control)] ease-[var(--ease-move)] ${badgeClass}`}
                >
                  {String.fromCharCode(65 + optionIndex)}
                </span>
                <span className="min-w-0 flex-1 leading-6">{option}</span>
                {answered && isCorrect && (
                  <Icons.success className="size-4 shrink-0 text-success" />
                )}
                {answered && isSelected && !isCorrect && (
                  <Icons.incorrect className="size-4 shrink-0 text-destructive" />
                )}
              </button>
            );
          })}
        </div>
        {answered && (
          <motion.div
            className="mt-6 rule-t pt-5"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={practiceTransition}
            aria-live="polite"
          >
            <p
              className={`flex items-center gap-2 text-sm font-semibold ${selected === item.answerIndex ? "text-success" : "text-destructive"}`}
            >
              {selected === item.answerIndex ? (
                <Icons.success className="size-4" />
              ) : (
                <Icons.incorrect className="size-4" />
              )}
              {selected === item.answerIndex
                ? t("practice.correct")
                : t("practice.incorrect")}
            </p>
            {selected !== item.answerIndex && (
              <p className="mt-2 text-sm text-foreground">
                {t("practice.answer", {
                  answer: item.options[item.answerIndex] ?? "",
                })}
              </p>
            )}
            {item.meaning && <p className="mt-2 type-lead">{item.meaning}</p>}
          </motion.div>
        )}
      </section>
      {answered && (
        <StepActions width="wide">
          <Button className="w-full" size="lg" disabled={busy} onClick={onNext}>
            {busy
              ? t("practice.recording")
              : t(last ? "practice.viewResult" : "practice.next")}
          </Button>
        </StepActions>
      )}
    </>
  );
}

"use client";

import { motion } from "motion/react";

import { QuestionCard } from "@/components/practice/question-card";
import type { PracticeEntry } from "@/components/practice/practice-queue";
import type { AnsweredBlank } from "@/components/practice/passage-view";
import { Button } from "@/components/ui/button";
import { BackControl } from "@/components/ui/back-control";
import { HeaderBackdrop } from "@/components/ui/header-backdrop";
import { DraftSaveStatus } from "@/components/ui/draft-save-status";
import { StepActions } from "@/components/ui/step-actions";
import { Icons } from "@/components/ui/icons";
import { t } from "@/lib/i18n";
import type { DraftPersistence } from "@/lib/draft-persistence";
import { timing } from "@/lib/motion-timing";

const practiceTransition = timing("control", "arrive");

/**
 * One entry at a time. A mixed queue changes what a step asks for between one
 * index and the next, so the card and the question live side by side here and
 * the entry decides which one is on screen.
 */
export function PracticeSessionView({
  entry,
  index,
  total,
  progressRatio,
  persistence,
  selected,
  pendingChoice,
  answeredBlanks,
  marked,
  busy,
  animateCard,
  onLeave,
  onToggleMark,
  onSkip,
  onAnswer,
  onNext,
}: {
  entry: PracticeEntry;
  index: number;
  total: number;
  progressRatio: number;
  persistence: DraftPersistence;
  selected: number | null;
  pendingChoice: number | null;
  answeredBlanks: Record<number, AnsweredBlank>;
  marked: boolean;
  busy: boolean;
  animateCard: boolean;
  onLeave: () => void;
  onToggleMark: () => void;
  onSkip: () => void;
  onAnswer: (choice: number) => void;
  onNext: () => void;
}) {
  const passage =
    entry.kind === "question" && entry.item.question?.kind === "reading"
      ? entry.item.question
      : null;
  return (
    // A session owns the whole screen, so it is a column: the material takes
    // the room it needs and the controls end up where a thumb already is,
    // instead of floating in the middle of a half-empty page.
    <div
      data-motion-view="practice-session"
      className={`mx-auto flex min-h-[calc(100dvh-6rem)] flex-col ${passage ? "max-w-6xl" : "max-w-3xl"}`}
    >
      <div className="page-header pb-3 pt-1">
        <HeaderBackdrop contained />
        <div className="flex flex-wrap items-center justify-between gap-x-3 text-sm text-muted-foreground">
          <div inert={busy} className={busy ? "opacity-50" : undefined}>
            <BackControl onClick={onLeave} />
          </div>
          <span className="tabular-nums">
            {t("practice.progress", { current: index + 1, total })}
          </span>
          <div
            className="page-action-host hidden md:flex"
            data-page-actions-host
          />
        </div>
        <div
          aria-label={t("practice.progressLabel")}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={Math.round(progressRatio * total)}
          className="mt-1 h-1 overflow-hidden rounded-full bg-border"
          role="progressbar"
        >
          <motion.div
            className="h-full origin-left rounded-full bg-primary"
            initial={false}
            animate={{ scaleX: progressRatio }}
            transition={practiceTransition}
          />
        </div>
        <div className="mt-1 text-right">
          <DraftSaveStatus status={persistence} />
        </div>
      </div>
      <motion.div
        className="flex flex-1 flex-col"
        key={passage ? `passage:${passage.id}` : entry.id}
        initial={animateCard ? { opacity: 0.72 } : false}
        animate={{ opacity: 1 }}
        transition={practiceTransition}
      >
        <div
          className={passage ? "py-4" : "my-auto py-5"}
          data-practice-question-group
        >
          <div className="mb-3 flex justify-end gap-1">
            <Button
              className="min-h-11 sm:min-h-9"
              size="sm"
              variant={marked ? "secondary" : "ghost"}
              disabled={busy}
              aria-pressed={marked}
              onClick={onToggleMark}
            >
              <Icons.mark />
              {t("practice.mark")}
            </Button>
            {selected === null && (
              <Button
                className="min-h-11 sm:min-h-9"
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={onSkip}
              >
                {busy && pendingChoice === null ? (
                  <Icons.loading className="animate-spin motion-reduce:animate-none" />
                ) : (
                  <Icons.skip />
                )}
                {t(
                  busy && pendingChoice === null
                    ? "practice.recording"
                    : "practice.skip",
                )}
              </Button>
            )}
          </div>
          <QuestionCard
            item={entry.item}
            selected={selected}
            pendingChoice={pendingChoice}
            answeredBlanks={answeredBlanks}
            busy={busy}
            onAnswer={onAnswer}
          />
        </div>
      </motion.div>
      {entry.kind === "question" && selected !== null && (
        <StepActions width="wide">
          <Button className="w-full" size="lg" disabled={busy} onClick={onNext}>
            {busy
              ? t("practice.recording")
              : t(
                  index === total - 1 ? "practice.viewResult" : "practice.next",
                )}
          </Button>
        </StepActions>
      )}
      <KeyboardHints
        optionCount={entry.item.options.length}
        answered={selected !== null}
      />
    </div>
  );
}

function KeyboardHints({
  optionCount,
  answered,
}: {
  optionCount: number;
  answered: boolean;
}) {
  return (
    <div
      aria-hidden
      className="mt-6 hidden flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground md:flex"
    >
      {!answered && (
        <ShortcutHint
          keys={optionCount > 9 ? "A – J" : `1 – ${optionCount}`}
          label={t("practice.shortcutAnswer")}
        />
      )}
      {answered && <ShortcutHint keys="Enter" label={t("practice.next")} />}
    </div>
  );
}

function ShortcutHint({ keys, label }: { keys: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <kbd className="rounded-md border bg-card px-1.5 py-0.5 font-mono text-[0.6875rem] text-foreground">
        {keys}
      </kbd>
      {label}
    </span>
  );
}

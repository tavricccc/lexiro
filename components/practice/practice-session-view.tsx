"use client";

import { motion } from "motion/react";

import { QuestionCard } from "@/components/practice/question-card";
import { PracticeTaskLabel } from "@/components/practice/practice-task-label";
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
  recordFailed = false,
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
  recordFailed?: boolean;
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
    // Keep the question directly below progress; extra viewport height never
    // pushes short questions or their answer choices downward.
    <div
      data-motion-view="practice-session"
      className={`mx-auto flex flex-col ${passage ? "max-w-6xl" : "max-w-3xl"}`}
    >
      <div className="page-header" data-practice-header>
        <HeaderBackdrop contained />
        <div className="flex items-center gap-1 text-sm text-muted-foreground md:gap-2">
          <div inert={busy} className={busy ? "opacity-50" : undefined}>
            <BackControl onClick={onLeave} label={t("practice.pause")} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="whitespace-nowrap tabular-nums">
                {t("practice.progress", { current: index + 1, total })}
              </span>
              <DraftSaveStatus
                compact
                status={persistence === "saved" ? "saved" : "idle"}
              />
            </div>
            <PracticeTaskLabel task={entry.item.type} />
          </div>
          <Button
            size="icon"
            variant={marked ? "secondary" : "ghost"}
            disabled={busy}
            aria-label={t("practice.mark")}
            aria-pressed={marked}
            title={t("practice.mark")}
            onClick={onToggleMark}
          >
            <Icons.mark aria-hidden />
          </Button>
          {selected === null && (
            <Button
              size="icon"
              variant="ghost"
              disabled={busy}
              aria-label={t(
                busy && pendingChoice === null
                  ? "practice.recording"
                  : "practice.skip",
              )}
              title={t("practice.skip")}
              onClick={onSkip}
            >
              {busy && pendingChoice === null ? (
                <Icons.loading
                  aria-hidden
                  className="animate-spin motion-reduce:animate-none"
                />
              ) : (
                <Icons.skip aria-hidden />
              )}
            </Button>
          )}
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
        {persistence === "error" && (
          <div className="mt-1">
            <DraftSaveStatus status="error" />
          </div>
        )}
      </div>
      {recordFailed && (
        <p role="alert" className="mb-4 text-sm leading-6 text-destructive">
          {t("practice.recordFailed")} {t("practice.recordRetryHint")}
        </p>
      )}
      <motion.div
        className="flex flex-col"
        key={passage ? `passage:${passage.id}` : entry.id}
        initial={animateCard ? { opacity: 0.72 } : false}
        animate={{ opacity: 1 }}
        transition={practiceTransition}
      >
        <div className="pb-4" data-practice-question-group>
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

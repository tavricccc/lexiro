"use client";

import type { ReviewRating } from "@/types";
import { motion } from "motion/react";

import { ReviewCard } from "@/components/practice/review-card";
import { QuestionCard } from "@/components/practice/question-card";
import type { PracticeEntry } from "@/components/practice/practice-queue";
import { Button } from "@/components/ui/button";
import { DraftSaveStatus } from "@/components/ui/draft-save-status";
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
  revealed,
  selected,
  marked,
  busy,
  animateCard,
  onLeave,
  onReveal,
  onRate,
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
  revealed: boolean;
  selected: number | null;
  marked: boolean;
  busy: boolean;
  animateCard: boolean;
  onLeave: () => void;
  onReveal: () => void;
  onRate: (rating: ReviewRating) => void;
  onToggleMark: () => void;
  onSkip: () => void;
  onAnswer: (choice: number) => void;
  onNext: () => void;
}) {
  const typing = entry.kind === "card" && entry.task === "spelling";
  return (
    // A session owns the whole screen, so it is a column: the material takes
    // the room it needs and the controls end up where a thumb already is,
    // instead of floating in the middle of a half-empty page.
    <div className="mx-auto flex min-h-[calc(100dvh-6rem)] max-w-3xl flex-col">
      <div className="sticky top-[var(--safe-top)] z-20 bg-[var(--surface-stage)] pb-3 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-x-3 text-sm text-muted-foreground">
          <button
            type="button"
            onClick={onLeave}
            className="-my-2 inline-flex min-h-11 items-center rounded-lg px-2 transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            {t("common.back")}
          </button>
          <span className="tabular-nums">
            {t("practice.progress", { current: index + 1, total })}
          </span>
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
        key={entry.id}
        initial={animateCard ? { opacity: 0.72 } : false}
        animate={{ opacity: 1 }}
        transition={practiceTransition}
      >
        {entry.kind === "card" ? (
          <ReviewCard
            item={entry.word}
            task={entry.task}
            revealed={revealed}
            busy={busy}
            typing={typing}
            onReveal={onReveal}
            onRate={onRate}
          />
        ) : (
          <>
            <div className="mt-4 flex justify-end gap-1">
              <Button
                className="min-h-11 sm:min-h-9"
                size="sm"
                variant={marked ? "secondary" : "ghost"}
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
                  <Icons.skip />
                  {t("practice.skip")}
                </Button>
              )}
            </div>
            <QuestionCard
              item={entry.item}
              selected={selected}
              busy={busy}
              last={index === total - 1}
              onAnswer={onAnswer}
              onNext={onNext}
            />
          </>
        )}
      </motion.div>
      <KeyboardHints
        kind={entry.kind}
        optionCount={entry.kind === "question" ? entry.item.options.length : 4}
        revealed={revealed}
        answered={selected !== null}
        typing={typing}
      />
    </div>
  );
}

function KeyboardHints({
  kind,
  optionCount,
  revealed,
  answered,
  typing,
}: {
  kind: PracticeEntry["kind"];
  optionCount: number;
  revealed: boolean;
  answered: boolean;
  typing: boolean;
}) {
  const card = kind === "card" && !typing;
  return (
    <div
      aria-hidden
      className="mt-6 hidden flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground md:flex"
    >
      {card && !revealed && (
        <ShortcutHint keys="Enter" label={t("practice.reveal")} />
      )}
      {card && revealed && (
        <ShortcutHint keys="A" label={t("practice.again")} />
      )}
      {card && revealed && <ShortcutHint keys="G" label={t("practice.good")} />}
      {kind === "question" && !answered && (
        <ShortcutHint
          keys={optionCount > 9 ? "A – J" : `1 – ${optionCount}`}
          label={t("practice.shortcutAnswer")}
        />
      )}
      {kind === "question" && answered && (
        <ShortcutHint keys="Enter" label={t("practice.next")} />
      )}
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

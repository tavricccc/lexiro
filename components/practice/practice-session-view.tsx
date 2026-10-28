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
  answeredBlanks,
  marked,
  reviewing,
  canGoBack,
  animateCard,
  backHref,
  onToggleMark,
  onSkip,
  onSelect,
  onConfirm,
  onNext,
  onPrevious,
  onForward,
}: {
  entry: PracticeEntry;
  /** Position of the entry on screen; behind the frontier while reviewing. */
  index: number;
  total: number;
  progressRatio: number;
  persistence: DraftPersistence;
  selected: number | null;
  pendingChoice: number | null;
  answeredBlanks: Record<number, AnsweredBlank>;
  marked: boolean;
  /** An earlier entry is on screen; it only shows what was recorded. */
  reviewing: boolean;
  canGoBack: boolean;
  animateCard: boolean;
  backHref: string;
  onToggleMark: () => void;
  onSkip: () => void;
  onSelect: (choice: number) => void;
  onConfirm: () => void;
  onNext: () => void;
  onPrevious: () => void;
  /** Steps one entry toward the frontier. */
  onForward: () => void;
}) {
  const passage =
    entry.kind === "question" && entry.item.question?.kind === "reading"
      ? entry.item.question
      : null;
  const answered = selected !== null;
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
          <BackControl href={backHref} icon="close" label={t("practice.exit")} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="whitespace-nowrap tabular-nums">
                {t("practice.progress", { current: index + 1, total })}
              </span>
              {reviewing ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                  {t("practice.reviewing")}
                </span>
              ) : (
                <DraftSaveStatus
                  compact
                  status={persistence === "saved" ? "saved" : "idle"}
                />
              )}
            </div>
            <PracticeTaskLabel task={entry.item.type} />
          </div>
          <Button
            size="icon"
            variant="glass"
            className={
              marked
                ? "bg-[var(--brand-50)] text-brand hover:bg-[var(--brand-50)]"
                : undefined
            }
            aria-label={t("practice.mark")}
            aria-pressed={marked}
            title={t("practice.mark")}
            onClick={onToggleMark}
          >
            <Icons.mark aria-hidden weight={marked ? "fill" : "regular"} />
          </Button>
          {!reviewing && !answered && (
            <Button
              size="icon"
              variant="glass"
              aria-label={t("practice.skip")}
              title={t("practice.skip")}
              onClick={onSkip}
            >
              <Icons.skip aria-hidden />
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
      <motion.div
        className="flex flex-col"
        key={passage ? `passage:${passage.id}` : entry.id}
        // The next question comes in from the side it is going: forward.
        initial={animateCard ? { opacity: 0, x: 24 } : false}
        animate={{ opacity: 1, x: 0 }}
        transition={timing("nav", "arrive")}
      >
        <div className="pb-4" data-practice-question-group>
          <QuestionCard
            item={entry.item}
            selected={selected}
            pendingChoice={reviewing ? null : pendingChoice}
            answeredBlanks={answeredBlanks}
            readOnly={reviewing}
            onAnswer={onSelect}
          />
        </div>
      </motion.div>
      <StepActions width="wide">
        <div className="flex gap-2">
          {canGoBack && (
            <Button
              className="shrink-0"
              size="lg"
              variant="secondary"
              onClick={onPrevious}
            >
              <Icons.back aria-hidden />
              {t("practice.previous")}
            </Button>
          )}
          {reviewing ? (
            <Button className="flex-1" size="lg" onClick={onForward}>
              {t("practice.forward")}
              <Icons.next aria-hidden />
            </Button>
          ) : answered ? (
            <Button className="flex-1" size="lg" onClick={onNext}>
              {t(index === total - 1 ? "practice.viewResult" : "practice.next")}
              {index === total - 1 ? (
                <Icons.finish aria-hidden />
              ) : (
                <Icons.advance aria-hidden />
              )}
            </Button>
          ) : (
            <Button
              className="flex-1"
              size="lg"
              disabled={pendingChoice === null}
              onClick={onConfirm}
            >
              <Icons.success aria-hidden />
              {t("practice.confirm")}
            </Button>
          )}
        </div>
      </StepActions>
      <KeyboardHints
        optionCount={entry.item.options.length}
        answered={answered}
        reviewing={reviewing}
        canGoBack={canGoBack}
      />
    </div>
  );
}

function KeyboardHints({
  optionCount,
  answered,
  reviewing,
  canGoBack,
}: {
  optionCount: number;
  answered: boolean;
  reviewing: boolean;
  canGoBack: boolean;
}) {
  return (
    <div
      aria-hidden
      className="mt-6 hidden flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground md:flex"
    >
      {!answered && !reviewing && (
        <>
          <ShortcutHint
            keys={optionCount > 9 ? "A – J" : `1 – ${optionCount}`}
            label={t("practice.shortcutAnswer")}
          />
          <ShortcutHint keys="Enter" label={t("practice.shortcutConfirm")} />
        </>
      )}
      {answered && !reviewing && (
        <ShortcutHint keys="Enter" label={t("practice.next")} />
      )}
      {reviewing && <ShortcutHint keys="→" label={t("practice.forward")} />}
      {canGoBack && (
        <ShortcutHint keys="←" label={t("practice.shortcutPrevious")} />
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

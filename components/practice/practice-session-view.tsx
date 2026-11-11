import { motion } from "motion/react";

import { QuestionCard } from "@/components/practice/question-card";
import { PracticeTaskLabel } from "@/components/practice/practice-task-label";
import type { PracticeEntry } from "@/components/practice/practice-queue";
import type { AnsweredBlank } from "@/components/practice/passage-view";
import { Button } from "@/components/ui/button";
import { BackControl } from "@/components/ui/back-control";
import { DraftSaveStatus } from "@/components/ui/draft-save-status";
import { Icons } from "@/components/ui/icons";
import { t } from "@/lib/i18n";
import type { DraftPersistence } from "@/lib/draft-persistence";
import { timing } from "@/lib/motion-timing";

/**
 * One entry at a time. A mixed queue changes what a step asks for between one
 * index and the next, so the card and the question live side by side here and
 * the entry decides which one is on screen.
 */
export function PracticeSessionView({
  entry,
  outcomes,
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
  outcomes?: Array<boolean | null>;
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
  const passage = entry.item.question?.kind === "reading";
  const answered = selected !== null;
  return (
    <div className="focus" data-motion-view="practice-session">
      <div className="focus-top">
        <BackControl href={backHref} icon="close" label={t("practice.exit")} />
        <div
          className="steps"
          role="progressbar"
          aria-label={t("practice.progressLabel")}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={Math.round(progressRatio * total)}
        >
          {Array.from({ length: total }, (_, n) => (
            <i
              key={n}
              className={
                n < index
                  ? outcomes?.[n] === false
                    ? "no"
                    : "ok"
                  : n === index
                    ? "now"
                    : ""
              }
            />
          ))}
        </div>
        <span className="latin practice-counter">
          {index + 1}/{total}
        </span>
        <Button
          size="icon"
          variant="glass"
          aria-label={t("practice.mark")}
          aria-pressed={marked}
          onClick={onToggleMark}
        >
          <Icons.mark weight="regular" />
        </Button>
      </div>
      <div
        className="focus-body"
        style={passage ? { maxWidth: 1120, alignContent: "start" } : undefined}
      >
        <div className="rowx">
          <PracticeTaskLabel task={entry.item.type} />
          {reviewing && <span className="chip">{t("practice.reviewing")}</span>}
        </div>
        <motion.div
          key={
            entry.item.question?.kind === "reading"
              ? `passage:${entry.item.question.id}`
              : entry.id
          }
          initial={animateCard ? { opacity: 0, x: 32 } : false}
          animate={{ opacity: 1, x: 0 }}
          transition={timing("nav", "nav")}
        >
          <QuestionCard
            item={entry.item}
            selected={selected}
            pendingChoice={reviewing ? null : pendingChoice}
            answeredBlanks={answeredBlanks}
            readOnly={reviewing}
            onAnswer={onSelect}
          />
        </motion.div>
        {persistence === "error" && <DraftSaveStatus status="error" />}
      </div>
      <div className="focus-foot">
        <div>
          {canGoBack && (
            <Button variant="secondary" size="lg" onClick={onPrevious}>
              {t("practice.previous")}
            </Button>
          )}
          {reviewing ? (
            <Button size="lg" onClick={onForward}>
              {t("practice.forward")}
            </Button>
          ) : answered ? (
            <Button size="lg" onClick={onNext}>
              {t(index === total - 1 ? "practice.viewResult" : "practice.next")}
              <Icons.next />
            </Button>
          ) : (
            <>
              <Button variant="glass" size="lg" onClick={onSkip}>
                {t("practice.skip")}
              </Button>
              <Button
                className="btn-ink"
                size="lg"
                disabled={pendingChoice === null}
                onClick={onConfirm}
              >
                {t("practice.confirm")}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

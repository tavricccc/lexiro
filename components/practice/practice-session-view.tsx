"use client";

import type { ReviewRating, StudyWord, WorkspacePracticeMode } from "@/types";
import { Bookmark, Check, SkipForward, Volume2, X } from "lucide-react";
import { motion } from "motion/react";

import type { QuestionItem } from "@/components/practice/practice-content";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

const practiceTransition = { duration: 0.16, ease: [0.22, 1, 0.36, 1] as const };

export function PracticeSessionView({
  mode,
  index,
  total,
  progressRatio,
  review,
  question,
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
  mode: WorkspacePracticeMode;
  index: number;
  total: number;
  progressRatio: number;
  review?: StudyWord;
  question?: QuestionItem;
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
  const activeId = mode === "review" ? review?.id : question?.id;
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between text-sm text-muted-foreground">
        <button type="button" onClick={onLeave} className="rounded-lg px-1 py-1 transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40">
          {t("common.back")}
        </button>
        <span className="tabular-nums">{t("practice.progress", { current: index + 1, total })}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-border" aria-hidden>
        <motion.div className="h-full origin-left rounded-full bg-primary" initial={false} animate={{ scaleX: progressRatio }} transition={practiceTransition} />
      </div>
      <motion.div
        key={`${mode}:${activeId ?? index}`}
        initial={animateCard ? { opacity: 0.72, y: 7 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={practiceTransition}
      >
        {mode === "review" && review ? (
          <ReviewCard item={review} revealed={revealed} busy={busy} onReveal={onReveal} onRate={onRate} />
        ) : question ? (
          <>
            <div className="mt-4 flex justify-end gap-1">
              <Button size="sm" variant={marked ? "secondary" : "ghost"} onClick={onToggleMark}>
                <Bookmark className="size-4" />{t("practice.mark")}
              </Button>
              {selected === null && (
                <Button size="sm" variant="ghost" disabled={busy} onClick={onSkip}>
                  <SkipForward className="size-4" />{t("practice.skip")}
                </Button>
              )}
            </div>
            <QuestionCard item={question} selected={selected} busy={busy} last={index === total - 1} onAnswer={onAnswer} onNext={onNext} />
          </>
        ) : null}
      </motion.div>
    </div>
  );
}

function ReviewCard({ item, revealed, busy, onReveal, onRate }: { item: StudyWord; revealed: boolean; busy: boolean; onReveal: () => void; onRate: (rating: ReviewRating) => void }) {
  const speak = () => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(item.word));
  };
  return (
    <section className="mt-6 rounded-2xl bg-muted/70 px-5 py-9 text-center sm:px-8 sm:py-11">
      <button type="button" aria-label={t("practice.speak")} onClick={speak} className="mx-auto mb-5 grid size-10 place-items-center rounded-full bg-card text-primary shadow-[var(--shadow-control)] transition-transform duration-150 active:scale-[.94]">
        <Volume2 className="size-4" />
      </button>
      <h1 className="text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">{item.word}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{item.pos}</p>
      {revealed ? (
        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={practiceTransition}>
          <div className="mx-auto my-7 h-px max-w-sm bg-primary/10" />
          <p className="text-lg font-semibold tracking-[-0.01em]">{item.meaning}</p>
          {item.example && <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-muted-foreground">{item.example}</p>}
          <div className="mx-auto mt-8 grid max-w-sm grid-cols-2 gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => onRate("again")}>{t("practice.again")}</Button>
            <Button disabled={busy} onClick={() => onRate("good")}>{busy ? t("practice.recording") : t("practice.good")}</Button>
          </div>
        </motion.div>
      ) : (
        <Button className="mt-9" onClick={onReveal}>{t("practice.reveal")}</Button>
      )}
    </section>
  );
}

function QuestionCard({ item, selected, busy, last, onAnswer, onNext }: { item: QuestionItem; selected: number | null; busy: boolean; last: boolean; onAnswer: (choice: number) => void; onNext: () => void }) {
  const answered = selected !== null;
  return (
    <section className="mt-5 rounded-2xl bg-muted/70 p-5 sm:p-7">
      {item.question.kind === "reading" && (
        <div className="mb-6 border-b pb-6">
          <p className="whitespace-pre-line text-sm leading-7 text-muted-foreground">{item.question.passage}</p>
        </div>
      )}
      <h1 className="max-w-2xl text-[1.0625rem] font-semibold leading-7 tracking-[-0.01em] sm:text-lg">{item.prompt}</h1>
      <div className="mt-6 grid gap-2.5">
        {item.options.map((option, optionIndex) => {
          const isCorrect = optionIndex === item.answerIndex;
          const isSelected = selected === optionIndex;
          const stateClass = answered && isCorrect
            ? "border-success/25 bg-success/10 text-foreground"
            : answered && isSelected
              ? "border-destructive/30 bg-destructive/10 text-foreground"
              : "border-border bg-card hover:border-foreground/20 hover:bg-card/80";
          const badgeClass = answered && isCorrect
            ? "bg-success text-white"
            : answered && isSelected
              ? "bg-destructive text-white"
              : "bg-muted text-muted-foreground";
          return (
            <button
              key={optionIndex}
              type="button"
              disabled={answered || busy}
              onClick={() => onAnswer(optionIndex)}
              className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-sm font-medium transition-[background-color,border-color,transform] duration-150 active:scale-[.99] disabled:cursor-default disabled:opacity-100 ${stateClass}`}
            >
              <span className={`grid size-7 shrink-0 place-items-center rounded-lg text-xs font-semibold transition-colors duration-150 ${badgeClass}`}>{String.fromCharCode(65 + optionIndex)}</span>
              <span className="min-w-0 flex-1 leading-6">{option}</span>
              {answered && isCorrect && <Check className="size-4 shrink-0 text-success" />}
              {answered && isSelected && !isCorrect && <X className="size-4 shrink-0 text-destructive" />}
            </button>
          );
        })}
      </div>
      {answered && (
        <motion.div className="mt-6 border-t pt-5" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={practiceTransition} aria-live="polite">
          <p className={`flex items-center gap-2 text-sm font-semibold ${selected === item.answerIndex ? "text-success" : "text-destructive"}`}>
            {selected === item.answerIndex ? <Check className="size-4" /> : <X className="size-4" />}
            {selected === item.answerIndex ? t("practice.correct") : t("practice.incorrect")}
          </p>
          {selected !== item.answerIndex && <p className="mt-2 text-sm text-foreground">{t("practice.answer", { answer: item.options[item.answerIndex] ?? "" })}</p>}
          {item.meaning && <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.meaning}</p>}
          <div className="mt-5 flex justify-end">
            <Button className="w-full sm:w-auto" disabled={busy} onClick={onNext}>
              {busy ? t("practice.recording") : t(last ? "practice.viewResult" : "practice.next")}
            </Button>
          </div>
        </motion.div>
      )}
    </section>
  );
}

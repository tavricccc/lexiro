"use client";

import type { PracticeTask, ReviewRating, StudyWord } from "@/types";
import { motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { t } from "@/lib/i18n";
import { timing } from "@/lib/motion-timing";
import { PracticeTaskLabel } from "@/components/practice/practice-task-label";

const practiceTransition = timing("control", "arrive");

const SWIPE_THRESHOLD = 72;

export function ReviewCard({
  item,
  task,
  revealed,
  busy,
  typing,
  onReveal,
  onRate,
}: {
  item: StudyWord;
  task: PracticeTask;
  revealed: boolean;
  busy: boolean;
  typing: boolean;
  onReveal: () => void;
  onRate: (rating: ReviewRating) => void;
}) {
  const reduceMotion = useReducedMotion();
  const draggable = revealed && !busy && !reduceMotion;
  const x = useMotionValue(0);
  const againOpacity = useTransform(x, [-SWIPE_THRESHOLD, -16], [1, 0]);
  const goodOpacity = useTransform(x, [16, SWIPE_THRESHOLD], [0, 1]);
  const [typedValue, setTypedValue] = useState("");
  const [typedResult, setTypedResult] = useState<
    "correct" | "incorrect" | null
  >(null);
  const speak = () => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(item.word);
    utterance.lang = "en-US";
    window.speechSynthesis.speak(utterance);
  };
  const submitTyped = () => {
    if (!typedValue.trim() || typedResult || busy) return;
    const matches =
      typedValue.trim().toLocaleLowerCase() ===
      item.word.trim().toLocaleLowerCase();
    setTypedResult(matches ? "correct" : "incorrect");
    onReveal();
  };
  const showWord = !typing || revealed;
  const actions =
    typing && !revealed ? (
      <button
        className="mx-auto block py-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        onClick={onReveal}
        type="button"
      >
        {t("practice.typingShowAnswer")}
      </button>
    ) : revealed ? (
      <>
        {/* The only pair of buttons in the app that belongs side by side: two
          halves of one judgement, and the same two directions as the swipe. */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            disabled={busy}
            onClick={() => onRate("again")}
            size="lg"
            variant="secondary"
          >
            {t("practice.again")}
          </Button>
          <Button disabled={busy} onClick={() => onRate("good")} size="lg">
            {busy ? t("practice.recording") : t("practice.good")}
          </Button>
        </div>
        {!reduceMotion && (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            {t("practice.swipeHint")}
          </p>
        )}
      </>
    ) : (
      <Button className="w-full" onClick={onReveal} size="lg">
        {t("practice.reveal")}
      </Button>
    );
  return (
    <div className="flex flex-1 flex-col">
      <motion.div
        className="relative mt-6"
        style={draggable ? { x, cursor: "grab" } : undefined}
        drag={draggable ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.5}
        dragMomentum={false}
        onDragEnd={(_, info) => {
          if (info.offset.x < -SWIPE_THRESHOLD) onRate("again");
          else if (info.offset.x > SWIPE_THRESHOLD) onRate("good");
        }}
      >
        <motion.span
          aria-hidden
          style={{ opacity: againOpacity }}
          className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-destructive px-2.5 py-1 text-xs font-semibold text-destructive-foreground"
        >
          {t("practice.again")}
        </motion.span>
        <motion.span
          aria-hidden
          style={{ opacity: goodOpacity }}
          className="pointer-events-none absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-success px-2.5 py-1 text-xs font-semibold text-success-foreground"
        >
          {t("practice.good")}
        </motion.span>
        <section className="rounded-2xl bg-muted/70 px-5 py-9 text-center sm:px-8 sm:py-11">
          <PracticeTaskLabel task={task} />
          {showWord && (
            <>
              <button
                type="button"
                aria-label={t("practice.speak")}
                onClick={speak}
                className="mx-auto mb-5 grid size-11 place-items-center rounded-full bg-card text-primary shadow-[var(--shadow-control)] focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <Icons.speak />
              </button>
              <h1 className="type-page">{item.word}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{item.pos}</p>
            </>
          )}
          {typing && !revealed ? (
            <>
              <h1 className="type-page">{item.meaning}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{item.pos}</p>
              <form
                className="mx-auto mt-8 flex max-w-sm gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  submitTyped();
                }}
              >
                <input
                  autoFocus
                  value={typedValue}
                  onChange={(event) => setTypedValue(event.target.value)}
                  placeholder={t("practice.typingPlaceholder")}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  disabled={busy}
                  aria-label={t("practice.typingPlaceholder")}
                  className="h-11 min-w-0 flex-1 rounded-xl border bg-card px-3.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                />
                <Button type="submit" disabled={busy || !typedValue.trim()}>
                  {t("practice.check")}
                </Button>
              </form>
            </>
          ) : revealed ? (
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={practiceTransition}
            >
              {typing && typedResult && (
                <p
                  className={`mt-6 text-sm font-semibold ${typedResult === "correct" ? "text-success" : "text-destructive"}`}
                  aria-live="polite"
                >
                  {typedResult === "correct"
                    ? t("practice.typingCorrect")
                    : `${t("practice.typingIncorrect")} ${item.word}`}
                </p>
              )}
              <div
                className={`mx-auto h-px max-w-sm bg-primary/10 ${typing ? "my-5" : "my-7"}`}
              />
              <p className="text-lg font-semibold tracking-[-0.01em]">
                {item.meaning}
              </p>
              {item.example && (
                <p className="mx-auto mt-4 max-w-xl type-lead">
                  {item.example}
                </p>
              )}
            </motion.div>
          ) : null}
        </section>
      </motion.div>
      <div className="mt-auto pt-7">{actions}</div>
    </div>
  );
}

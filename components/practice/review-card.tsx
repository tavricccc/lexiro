"use client";

import type { ReviewRating, StudyWord } from "@/types";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { StepActions } from "@/components/ui/step-actions";
import { t } from "@/lib/i18n";
import { PracticeTaskLabel } from "./practice-task-label";

/** Spelling is judged by the entered answer, never by a memory self-rating. */
export function ReviewCard({
  item,
  revealed,
  busy,
  last,
  selected,
  onChecked,
  onReveal,
  onRate,
}: {
  item: StudyWord;
  revealed: boolean;
  busy: boolean;
  last: boolean;
  selected: number | null;
  onChecked: (correct: boolean) => void;
  onReveal: () => void;
  onRate: (rating: ReviewRating) => void;
}) {
  const [typedValue, setTypedValue] = useState("");
  const correct = selected === 0;
  const submit = () => {
    if (!typedValue.trim() || revealed || busy) return;
    onChecked(
      typedValue.trim().toLocaleLowerCase() ===
        item.word.trim().toLocaleLowerCase(),
    );
    onReveal();
  };
  const speak = () => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(item.word);
    utterance.lang = "en-US";
    window.speechSynthesis.speak(utterance);
  };
  return (
    <>
      <section className="my-auto rounded-[var(--radius-card)] bg-card px-5 py-8 text-center sm:px-8 sm:py-10">
        <PracticeTaskLabel task="spelling" />
        <h1 className="type-page">{item.meaning}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{item.pos}</p>
        {!revealed ? (
          <>
            <form
              className="mx-auto mt-8 flex max-w-sm gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                submit();
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
                className="h-11 min-w-0 flex-1 rounded-[var(--radius-control)] border bg-background px-4 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
              />
              <Button type="submit" disabled={busy || !typedValue.trim()}>
                {t("practice.check")}
              </Button>
            </form>
            <button
              className="mx-auto mt-4 block min-h-11 rounded-[var(--radius-control)] px-3 py-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              onClick={() => {
                onChecked(false);
                onReveal();
              }}
              type="button"
              disabled={busy}
            >
              {t("practice.typingShowAnswer")}
            </button>
          </>
        ) : (
          <div className="mt-6 rule-t pt-5" aria-live="polite">
            <p
              className={`text-sm font-semibold ${correct ? "text-success" : "text-destructive"}`}
            >
              {correct
                ? t("practice.typingCorrect")
                : `${t("practice.typingIncorrect")} ${item.word}`}
            </p>
            <p className="mt-4 text-lg font-semibold">{item.word}</p>
            {typedValue && !correct && (
              <p className="mt-2 text-sm text-muted-foreground">{typedValue}</p>
            )}
            {item.example && <p className="mt-3 type-lead">{item.example}</p>}
            <button
              type="button"
              aria-label={t("practice.speak")}
              onClick={speak}
              className="mx-auto mt-5 grid size-11 place-items-center rounded-full bg-card text-primary focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <Icons.speak />
            </button>
          </div>
        )}
      </section>
      {revealed && (
        <StepActions width="wide">
          <Button
            className="w-full"
            disabled={busy}
            onClick={() => onRate(correct ? "good" : "again")}
            size="lg"
          >
            {busy
              ? t("practice.recording")
              : t(last ? "practice.viewResult" : "practice.next")}
          </Button>
        </StepActions>
      )}
    </>
  );
}

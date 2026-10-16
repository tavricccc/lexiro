"use client";

import { useEffect, useRef, useState } from "react";

import { PassageView } from "@/components/practice/passage-view";
import { Icons } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import type { RoomState } from "@/lib/room-client";
import { PlayerList } from "./room-lobby";

function useSecondsLeft(endsAt: number | null, offset: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  if (endsAt === null) return 0;
  return Math.max(0, Math.ceil((endsAt - (now + offset)) / 1000));
}

export function QuestionStage({
  state,
  offset,
  onAnswer,
}: {
  state: RoomState;
  offset: number;
  onAnswer: (choice: number) => boolean;
}) {
  const question = state.question;
  const reveal = state.reveal;
  const [pending, setPending] = useState<number | null>(null);
  const [pressed, setPressed] = useState<number | null>(null);
  const press = useRef<{ pointer: number; index: number } | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const secondsLeft = useSecondsLeft(state.endsAt, offset);
  const locked = state.yourChoice !== null || reveal !== null;

  const choose = (index: number) => {
    if (locked || pending !== null) return;
    setPending(index);
    onAnswer(index);
  };

  // A new question starts at its own top, but only when the reader had
  // scrolled past it; otherwise the page stays exactly where it is.
  useEffect(() => {
    const top = stage.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) stage.current?.scrollIntoView({ block: "start" });
  }, []);

  // A tap counts only when the finger is still on the option as it lifts, so
  // sliding off cancels. It fires on release, same as a click always did.
  const within = (event: React.PointerEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return (
      event.clientX >= box.left &&
      event.clientX <= box.right &&
      event.clientY >= box.top &&
      event.clientY <= box.bottom
    );
  };
  const tapHandlers = (index: number) => ({
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      press.current = { pointer: event.pointerId, index };
      setPressed(index);
    },
    onPointerMove: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (press.current?.pointer !== event.pointerId) return;
      setPressed(within(event) ? index : null);
    },
    onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (press.current?.pointer !== event.pointerId) return;
      press.current = null;
      setPressed(null);
      if (within(event)) choose(index);
    },
    onPointerCancel: () => {
      press.current = null;
      setPressed(null);
    },
    onPointerLeave: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (press.current?.pointer === event.pointerId) setPressed(null);
    },
    // Pointers are handled above; a click with no pointer is the keyboard.
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
      if (event.detail === 0) choose(index);
    },
  });

  useEffect(() => {
    if (locked || !question) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const digit = Number(event.key);
      if (digit >= 1 && digit <= question.options.length) {
        if (pending === null) {
          setPending(digit - 1);
          onAnswer(digit - 1);
        }
        event.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locked, onAnswer, pending, question]);

  if (!question) return null;
  const otherBlanks = Object.entries(state.revealedBlanks).filter(
    ([blank]) => Number(blank) !== question.blank,
  );
  const usedBy = (option: string) =>
    question.sharedBank
      ? otherBlanks.find(([, answer]) => answer === option)?.[0]
      : undefined;
  const answeredBlanks = Object.fromEntries(
    Object.entries(state.revealedBlanks).map(([blank, answer]) => [
      blank,
      { answer },
    ]),
  );
  const connected = state.players.filter((player) => player.connected);
  const mine = reveal?.gained[state.you];
  const correctChoice =
    state.yourChoice !== null && reveal?.accepted.includes(state.yourChoice);

  return (
    <div ref={stage} className="scroll-mt-4 space-y-5">
      {/* The pill and bar stay put through the reveal so nothing below jumps;
          during the reveal they count down to the next question. */}
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="tabular-nums text-muted-foreground">
          {t("rooms.question", {
            current: state.index + 1,
            total: state.total,
          })}
        </span>
        <span
          aria-live="off"
          className={cn(
            "rounded-full px-3 py-1 font-semibold tabular-nums",
            !reveal && secondsLeft <= 5
              ? "bg-destructive/15 text-destructive"
              : "bg-muted",
          )}
        >
          {reveal
            ? t("rooms.nextIn", { seconds: secondsLeft })
            : t("rooms.secondsLeft", { seconds: secondsLeft })}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-200 ease-linear",
            reveal ? "bg-muted-foreground/40" : "bg-primary",
          )}
          style={{
            width: `${state.duration ? Math.min(100, (secondsLeft * 1000 * 100) / state.duration) : 0}%`,
          }}
        />
      </div>

      <div
        className={
          question.passage
            ? "grid items-start gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]"
            : undefined
        }
      >
        {question.passage && (
          <section className="max-h-[50dvh] overflow-y-auto rounded-[var(--radius-card)] bg-card p-5 lg:max-h-[calc(100dvh-14rem)]">
            <h2 className="question-text mb-3 font-semibold">
              {question.passage.title}
            </h2>
            <PassageView
              activeBlank={question.blank}
              answeredBlanks={answeredBlanks}
              passage={question.passage.text}
            />
          </section>
        )}
        <section className="min-w-0">
          <h1
            className={
              question.type === "meaning"
                ? "question-text type-page text-left"
                : "question-text text-[1.0625rem] font-semibold leading-[1.75] tracking-normal text-foreground/90 [word-spacing:0.02em]"
            }
          >
            {question.blank
              ? t("questions.blankLabel", { index: question.blank })
              : question.prompt}
          </h1>
          <div
            className={cn(
              "mt-5 grid gap-2.5",
              question.options.length > 5 && "sm:grid-cols-2",
            )}
          >
            {question.options.map((option, index) => {
              const used = usedBy(option);
              const accepted = reveal?.accepted.includes(index);
              const chosen = state.yourChoice === index;
              const isPending = !locked && pending === index;
              const result = !reveal
                ? undefined
                : chosen
                  ? accepted
                    ? "correct"
                    : "wrong"
                  : accepted
                    ? "revealed"
                    : undefined;
              return (
                <button
                  key={index}
                  type="button"
                  data-result={result}
                  aria-pressed={chosen || isPending}
                  disabled={locked || used !== undefined}
                  {...tapHandlers(index)}
                  className={cn(
                    "t-answer touch-manipulation select-none",
                    "flex min-h-14 w-full items-center gap-3 rounded-[var(--radius-control)] border px-4 py-3 text-left text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
                    reveal && accepted
                      ? "border-success/40 bg-success/10"
                      : reveal && chosen
                        ? "border-destructive/40 bg-destructive/10"
                        : chosen || isPending
                          ? "border-primary bg-primary/10"
                          : pressed === index && !locked
                            ? "border-primary/60 bg-primary/5"
                            : used !== undefined
                              ? "border-border/70 bg-muted/30 text-muted-foreground"
                              : "border-border/70 bg-card hover:border-primary/50",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold transition-colors duration-[var(--motion-control)]",
                      reveal && accepted
                        ? "bg-success text-success-foreground"
                        : reveal && chosen
                          ? "bg-destructive text-destructive-foreground"
                          : chosen || isPending
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground",
                    )}
                  >
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span className="min-w-0 flex-1 break-words leading-6">
                    {option}
                    {used !== undefined && (
                      <span className="block text-sm text-muted-foreground">
                        {t("practice.usedInBlank", { index: used })}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {!reveal && state.yourChoice !== null && (
            <p
              className="t-result-in mt-5 text-center text-muted-foreground"
              role="status"
            >
              {t("rooms.answered")}
            </p>
          )}
          {!reveal && (
            <p className="mt-2 text-center text-sm tabular-nums text-muted-foreground">
              {t("rooms.answeredCount", {
                count: connected.filter((player) => player.answered).length,
                total: connected.length,
              })}
            </p>
          )}

          {reveal && (
            <div className="mt-5 space-y-3" role="status">
              <p
                className={cn(
                  "t-result-in relative flex items-center justify-center gap-2 text-center text-lg font-semibold",
                  correctChoice
                    ? "text-success"
                    : state.yourChoice === null
                      ? "text-muted-foreground"
                      : "text-destructive",
                )}
              >
                {state.yourChoice !== null &&
                  (correctChoice ? (
                    <Icons.success
                      aria-hidden
                      className="t-answer-mark size-5"
                    />
                  ) : (
                    <Icons.incorrect
                      aria-hidden
                      className="t-answer-mark size-5"
                    />
                  ))}
                {state.yourChoice === null
                  ? t("rooms.missed")
                  : correctChoice
                    ? t("rooms.correct", { points: mine ?? 0 })
                    : t("rooms.wrong")}
                {correctChoice && (mine ?? 0) > 0 && (
                  <span
                    aria-hidden
                    className="t-points-float absolute inset-x-0 -top-4 text-center text-base text-success"
                  >
                    +{mine}
                  </span>
                )}
              </p>
              {reveal.explanation && (
                <p className="t-result-in rounded-[var(--radius-control)] bg-muted/50 p-4 text-sm leading-6 [animation-delay:var(--motion-touch)]">
                  {reveal.explanation}
                </p>
              )}
            </div>
          )}
        </section>
      </div>

      {/* One list through both phases, so at the reveal scores count up
          and players glide to their new ranks in place. */}
      <section className="rounded-[var(--radius-card)] bg-card p-5">
        <h2 className="type-section">
          {reveal
            ? t("rooms.scoreboard")
            : t("rooms.players", { count: state.players.length })}
        </h2>
        <PlayerList state={state} showScore showAnswered={!reveal} />
      </section>
    </div>
  );
}

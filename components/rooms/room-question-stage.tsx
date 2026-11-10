import Link from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { Ring } from "@/components/redesign/primitives";
import { useEffect, useRef, useState } from "react";

import { PassageView } from "@/components/practice/passage-view";
import { Icons } from "@/components/ui/icons";
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
  onLeave,
}: {
  onLeave?: () => void;
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
    if (locked) return;
    setPending(index);
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
      if (event.key === "Enter" && pending !== null) {
        event.preventDefault();
        onAnswer(pending);
        return;
      }
      const digit = Number(event.key);
      if (digit >= 1 && digit <= question.options.length) {
        if (pending === null) {
          setPending(digit - 1);
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
  return (
    <div ref={stage} className="focus">
      <div className="focus-top">
        {onLeave ? <button className="btn btn-icon btn-glass" aria-label={t("rooms.endGame")} onClick={onLeave}><Icons.cancel /></button> : <Link className="btn btn-icon btn-glass" href="/app/rooms" aria-label={t("rooms.leave")}><Icons.cancel /></Link>}
        <div className="steps">
          {Array.from({ length: state.total }, (_, i) => (
            <i
              key={i}
              className={
                i < state.index ? "ok" : i === state.index ? "now" : ""
              }
            />
          ))}
        </div>
        <Ring
          value={
            state.duration ? ((secondsLeft * 1000) / state.duration) * 100 : 0
          }
          className="timer"
        >
          <b>{secondsLeft}</b>
        </Ring>
      </div>
      <div
        className="focus-body"
        style={{ maxWidth: 1120, alignContent: "start" }}
      >
        <div className="split">
          <div className="stack">
            {question.passage && (
              <article className="tile">
                <PassageView
                  activeBlank={question.blank}
                  answeredBlanks={answeredBlanks}
                  passage={question.passage.text}
                />
              </article>
            )}
            <div className="prompt">
              <h1 className="stem">{question.prompt}</h1>
            </div>
            <div className="opts">
              {question.options.map((option, index) => {
                const used = usedBy(option);
                const chosen = state.yourChoice === index;
                const accepted = reveal?.accepted.includes(index);
                return (
                  <button
                    key={index}
                    type="button"
                    className="opt"
                    aria-pressed={chosen || pending === index}
                    aria-checked={chosen || pending === index}
                    data-state={
                      reveal
                        ? accepted
                          ? "right"
                          : chosen
                            ? "wrong"
                            : "dim"
                        : undefined
                    }
                    data-result={
                      reveal
                        ? accepted
                          ? "correct"
                          : chosen
                            ? "wrong"
                            : undefined
                        : undefined
                    }
                    data-pressed={pressed === index}
                    disabled={locked || used !== undefined}
                    {...tapHandlers(index)}
                  >
                    <kbd>{String.fromCharCode(65 + index)}</kbd>
                    <span className="grow">{option}</span>
                  </button>
                );
              })}
            </div>
            {reveal && (
              <div
                className={`verdict ${state.yourChoice !== null && reveal.accepted.includes(state.yourChoice) ? "is-right" : "is-wrong"}`}
                role="status"
              >
                <b>
                  {state.yourChoice !== null &&
                  reveal.accepted.includes(state.yourChoice)
                    ? t("practice.correct")
                    : t("practice.incorrect")}
                </b>
                <p>{reveal.explanation}</p>
              </div>
            )}
          </div>
          <PlayerList state={state} showScore showAnswered={!reveal} />
        </div>
      </div>
      <div className="focus-foot">
        <div>
          <Button
            className="btn-ink"
            size="lg"
            disabled={locked || pending === null}
            onClick={() => {
              if (pending !== null) onAnswer(pending);
            }}
          >
            {t("practice.confirm")}
          </Button>
        </div>
      </div>
    </div>
  );
}

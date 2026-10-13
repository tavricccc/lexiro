"use client";

import Link from "@/components/ui/app-link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PassageView } from "@/components/practice/passage-view";
import { BackControl } from "@/components/ui/back-control";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { SignInRequired } from "@/components/ui/sign-in-required";
import { LibraryListSkeleton } from "@/components/ui/workspace-skeleton";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import type { RoomPlayer, RoomState } from "@/lib/room-client";
import { useCloudStore } from "@/stores/cloud-store";
import { playerName } from "./rooms-page";
import { useRoom, type RoomConnection } from "./use-room";

/** A live room. Everything on screen comes from the server's latest state. */
export function RoomPage({ code }: { code: string }) {
  const ready = useCloudStore((store) => store.ready);
  const user = useCloudStore((store) => store.user);
  if (!ready) return <LibraryListSkeleton />;
  if (!user)
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader
          back={<BackControl href="/app/rooms" />}
          title={t("rooms.title")}
        />
        <SignInRequired message={t("rooms.signInRequired")} />
      </div>
    );
  return <LiveRoom code={code} name={playerName(user)} />;
}

function LiveRoom({ code, name }: { code: string; name: string }) {
  const { state, connection, error, offset, send } = useRoom(code, name, true);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const back = <BackControl href="/app/rooms" label={t("rooms.leave")} />;

  if (connection === "closed" && (!state || error))
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader back={back} title={t("rooms.title")} />
        <section className="rounded-[var(--radius-card)] bg-card p-6 text-center">
          <Icons.error aria-hidden className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3">{error || t("rooms.notFound")}</p>
          <Button asChild className="mt-5" variant="secondary">
            <Link href="/app/rooms">{t("rooms.leave")}</Link>
          </Button>
        </section>
      </div>
    );
  if (!state)
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader back={back} title={t("rooms.title")} />
        <p className="text-center text-muted-foreground" role="status">
          {t("rooms.connecting")}
        </p>
      </div>
    );

  const isHost = state.you === state.hostUid;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={back}
        title={state.title}
        actions={
          isHost && state.phase !== "ended" ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirmEnd(true)}
            >
              <Icons.cancel />
              {t("rooms.endGame")}
            </Button>
          ) : undefined
        }
      />
      <ConnectionNotice connection={connection} />
      <ConfirmDialog
        confirmLabel={t("rooms.endGame")}
        description={t("rooms.endConfirm")}
        onConfirm={() => {
          send({ type: "end" });
          setConfirmEnd(false);
        }}
        onOpenChange={setConfirmEnd}
        open={confirmEnd}
        title={t("rooms.endGame")}
        tone="danger"
      />
      {state.phase === "lobby" && (
        <Lobby state={state} isHost={isHost} onStart={() => send({ type: "start" })} />
      )}
      {(state.phase === "question" || state.phase === "reveal") && (
        <QuestionStage
          key={state.index}
          state={state}
          offset={offset}
          onAnswer={(choice) =>
            send({ type: "answer", index: state.index, choice })
          }
        />
      )}
      {state.phase === "ended" && <Finished state={state} />}
    </div>
  );
}

function ConnectionNotice({ connection }: { connection: RoomConnection }) {
  if (connection === "open" || connection === "closed") return null;
  return (
    <p
      className="mb-4 flex items-center justify-center gap-2 rounded-full bg-muted px-4 py-2 text-sm text-muted-foreground"
      role="status"
    >
      <Icons.loading aria-hidden className="size-4 animate-spin" />
      {connection === "reconnecting" ? t("rooms.reconnecting") : t("rooms.connecting")}
    </p>
  );
}

function Lobby({
  state,
  isHost,
  onStart,
}: {
  state: RoomState;
  isHost: boolean;
  onStart: () => void;
}) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(state.code);
      toast.success(t("rooms.copied"));
    } catch {
      // Clipboard can be blocked; the code is on screen to read out anyway.
    }
  };
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <section className="rounded-[var(--radius-card)] bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">{t("rooms.shareCode")}</p>
        <p
          className="mt-2 font-mono text-4xl font-semibold tracking-[0.3em]"
          data-testid="room-code"
        >
          {state.code}
        </p>
        <Button className="mt-4" size="sm" variant="secondary" onClick={() => void copy()}>
          <Icons.copy />
          {t("rooms.copyCode")}
        </Button>
      </section>
      <section className="rounded-[var(--radius-card)] bg-card p-5">
        <h2 className="type-section">
          {t("rooms.players", { count: state.players.length })}
        </h2>
        <PlayerList state={state} />
      </section>
      {isHost ? (
        <div className="space-y-2 text-center">
          {state.players.length < 2 && (
            <p className="text-sm text-muted-foreground">{t("rooms.needPlayers")}</p>
          )}
          <Button className="w-full" size="lg" onClick={onStart}>
            <Icons.start />
            {t("rooms.start")}
          </Button>
        </div>
      ) : (
        <p className="text-center text-muted-foreground" role="status">
          {t("rooms.waitingHost")}
        </p>
      )}
    </div>
  );
}

function PlayerList({
  state,
  showScore = false,
  showAnswered = false,
}: {
  state: RoomState;
  showScore?: boolean;
  showAnswered?: boolean;
}) {
  return (
    <ol className="mt-3 divide-y divide-border/60">
      {state.players.map((player, rank) => (
        <li
          key={player.uid}
          className={cn(
            "flex items-center gap-3 py-2.5",
            !player.connected && "text-muted-foreground",
          )}
        >
          {showScore && (
            <span className="w-6 text-center text-sm font-semibold tabular-nums">
              {rank + 1}
            </span>
          )}
          <span className="min-w-0 flex-1 truncate">
            {player.name}
            <PlayerTags player={player} state={state} />
          </span>
          {showAnswered && player.answered && (
            <Icons.success aria-label={t("rooms.answered")} className="size-4 text-success" />
          )}
          {showScore && (
            <span className="text-sm font-semibold tabular-nums">
              {t("rooms.points", { points: player.score })}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

function PlayerTags({ player, state }: { player: RoomPlayer; state: RoomState }) {
  const tags = [
    player.uid === state.you && t("rooms.you"),
    player.uid === state.hostUid && t("rooms.host"),
    !player.connected && t("rooms.offline"),
  ].filter(Boolean);
  if (!tags.length) return null;
  return (
    <span className="ml-2 text-xs text-muted-foreground">{tags.join(" · ")}</span>
  );
}

function useSecondsLeft(endsAt: number | null, offset: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  if (endsAt === null) return 0;
  return Math.max(0, Math.ceil((endsAt - (now + offset)) / 1000));
}

function QuestionStage({
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
  const secondsLeft = useSecondsLeft(state.endsAt, offset);
  const locked = state.yourChoice !== null || reveal !== null;

  const confirm = () => {
    if (pending === null || locked) return;
    onAnswer(pending);
  };

  useEffect(() => {
    if (locked || !question) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const digit = Number(event.key);
      if (digit >= 1 && digit <= question.options.length) {
        setPending(digit - 1);
        event.preventDefault();
      } else if (event.key === "Enter" && pending !== null) {
        onAnswer(pending);
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
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="tabular-nums text-muted-foreground">
          {t("rooms.question", { current: state.index + 1, total: state.total })}
        </span>
        {!reveal && (
          <span
            aria-live="off"
            className={cn(
              "rounded-full px-3 py-1 font-semibold tabular-nums",
              secondsLeft <= 5 ? "bg-destructive/15 text-destructive" : "bg-muted",
            )}
          >
            {t("rooms.secondsLeft", { seconds: secondsLeft })}
          </span>
        )}
      </div>
      {!reveal && state.duration && state.endsAt && (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-200 ease-linear"
            style={{
              width: `${Math.min(100, (secondsLeft * 1000 * 100) / state.duration)}%`,
            }}
          />
        </div>
      )}

      <div
        className={
          question.passage
            ? "grid items-start gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]"
            : undefined
        }
      >
        {question.passage && (
          <section className="max-h-[50dvh] overflow-y-auto rounded-[var(--radius-card)] bg-card p-5 lg:max-h-[calc(100dvh-14rem)]">
            <h2 className="question-text mb-3 font-semibold">{question.passage.title}</h2>
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
                ? "question-text type-page text-center"
                : "question-text text-lg font-semibold leading-8"
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
              return (
                <button
                  key={index}
                  type="button"
                  aria-pressed={chosen || isPending}
                  disabled={locked || used !== undefined}
                  onClick={() => setPending(index)}
                  className={cn(
                    "flex min-h-14 w-full items-center gap-3 rounded-[var(--radius-control)] border px-4 py-3 text-left text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
                    reveal && accepted
                      ? "border-success/40 bg-success/10"
                      : reveal && chosen
                        ? "border-destructive/40 bg-destructive/10"
                        : chosen || isPending
                          ? "border-primary bg-primary/10"
                          : used !== undefined
                            ? "border-border/70 bg-muted/30 text-muted-foreground"
                            : "border-border/70 bg-card hover:border-primary/50",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold",
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

          {!reveal && state.yourChoice === null && (
            <Button
              className="mt-5 w-full"
              size="lg"
              disabled={pending === null}
              onClick={confirm}
            >
              <Icons.success />
              {t("rooms.confirm")}
            </Button>
          )}
          {!reveal && state.yourChoice !== null && (
            <p className="mt-5 text-center text-muted-foreground" role="status">
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
                  "text-center text-lg font-semibold",
                  correctChoice ? "text-success" : "text-muted-foreground",
                )}
              >
                {state.yourChoice === null
                  ? t("rooms.missed")
                  : correctChoice
                    ? t("rooms.correct", { points: mine ?? 0 })
                    : t("rooms.wrong")}
              </p>
              {reveal.explanation && (
                <p className="rounded-[var(--radius-control)] bg-muted/50 p-4 text-sm leading-6">
                  {reveal.explanation}
                </p>
              )}
            </div>
          )}
        </section>
      </div>

      {reveal && (
        <section className="rounded-[var(--radius-card)] bg-card p-5">
          <h2 className="type-section">{t("rooms.scoreboard")}</h2>
          <PlayerList state={state} showScore />
        </section>
      )}
      {!reveal && (
        <section className="rounded-[var(--radius-card)] bg-card p-5">
          <h2 className="type-section">
            {t("rooms.players", { count: state.players.length })}
          </h2>
          <PlayerList state={state} showAnswered />
        </section>
      )}
    </div>
  );
}

function Finished({ state }: { state: RoomState }) {
  const winner = state.players[0];
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <section className="rounded-[var(--radius-card)] bg-card p-6 text-center">
        <Icons.levelUp aria-hidden className="mx-auto size-10 text-primary" />
        <h2 className="type-section mt-3">{t("rooms.final")}</h2>
        {winner && (
          <p className="mt-1 text-lg font-semibold">
            {winner.name} · {t("rooms.points", { points: winner.score })}
          </p>
        )}
      </section>
      <section className="rounded-[var(--radius-card)] bg-card p-5">
        <PlayerList state={state} showScore />
      </section>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button asChild size="lg" variant="secondary">
          <Link href="/app/rooms">
            <Icons.back />
            {t("rooms.leave")}
          </Link>
        </Button>
        <Button asChild size="lg">
          <Link href="/app/rooms/new">
            <Icons.create />
            {t("rooms.newRoom")}
          </Link>
        </Button>
      </div>
    </div>
  );
}

"use client";

import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";

import { CountUp } from "@/components/motion/animated-number";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { timing } from "@/lib/motion-timing";
import type { RoomPlayer, RoomState } from "@/lib/room-client";

export function Lobby({
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
          className="t-celebrate mt-2 font-mono text-4xl font-semibold tracking-[0.3em]"
          data-testid="room-code"
        >
          {state.code}
        </p>
        <Button
          className="mt-4"
          size="sm"
          variant="secondary"
          onClick={() => void copy()}
        >
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
            <p className="text-sm text-muted-foreground">
              {t("rooms.needPlayers")}
            </p>
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

export function PlayerList({
  state,
  showScore = false,
  showAnswered = false,
}: {
  state: RoomState;
  showScore?: boolean;
  showAnswered?: boolean;
}) {
  return (
    // Players glide to their new rank when scores land, and someone joining
    // slides in; the list a screen opens with is drawn as is.
    <ol className="mt-3">
      <AnimatePresence initial={false}>
        {state.players.map((player, rank) => (
          <motion.li
            key={player.uid}
            layout="position"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={timing("nav")}
            className={cn(
              "flex items-center gap-3 border-border/60 py-2.5 [&:not(:first-child)]:border-t",
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
              <Icons.success
                aria-label={t("rooms.answered")}
                className="t-answer-mark size-4 text-success"
              />
            )}
            {showScore && (
              <span className="text-sm font-semibold">
                <CountUp format={formatPoints} value={player.score} />
              </span>
            )}
          </motion.li>
        ))}
      </AnimatePresence>
    </ol>
  );
}

const formatPoints = (points: number) => t("rooms.points", { points });

function PlayerTags({
  player,
  state,
}: {
  player: RoomPlayer;
  state: RoomState;
}) {
  const tags = [
    player.uid === state.you && t("rooms.you"),
    player.uid === state.hostUid && t("rooms.host"),
    !player.connected && t("rooms.offline"),
  ].filter(Boolean);
  if (!tags.length) return null;
  return (
    <span className="ml-2 text-xs text-muted-foreground">
      {tags.join(" · ")}
    </span>
  );
}

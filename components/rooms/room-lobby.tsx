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
    <div className="stack" style={{ maxWidth: 860, marginInline: "auto" }}>
      <section
        className="hero"
        style={{ textAlign: "center", justifyItems: "center" }}
      >
        <p>{t("redesign.roomCode")}</p>
        <p className="big-code" data-testid="room-code">
          {state.code}
        </p>
        <div className="hero-acts">
          <Button variant="ghost" className="btn-onforest" onClick={() => void copy()}>
            <Icons.copy />
            {t("redesign.copy")}
          </Button>
          <Button
            variant="ghost" className="btn-onforest"
            onClick={() => {
              if (navigator.share)
                void navigator
                  .share({ title: state.title, url: location.href })
                  .catch(() => undefined);
              else void copy();
            }}
          >
            <Icons.shareLink />
            {t("redesign.share")}
          </Button>
        </div>
      </section>
      <h2 className="t-section">
        {t("rooms.players", { count: state.players.length })}
      </h2>
      <PlayerList state={state} />
      <section className="tile between">
        <b>{state.title}</b>
        <span className="latin">
          {state.total} {t("redesign.countUnit")}
        </span>
      </section>
      {isHost ? (
        <Button size="lg" onClick={onStart}>
          <Icons.start />
          {t("rooms.start")}
        </Button>
      ) : (
        <p role="status">{t("rooms.waitingHost")}</p>
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
    <ol className={showScore ? "board" : "players"}>
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
              showScore
                ? `p ${player.uid === state.you ? "me" : ""}`
                : "player",
              !player.connected && "text-muted-foreground",
            )}
          >
            <span
              className={`avatar hue-${["mint", "rose", "sky", "amber"][rank % 4]}`}
            >
              {player.name[0]}
            </span>
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
